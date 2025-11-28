/**
 * Secure File Browser for Interactive Feedback MCP
 * Handles safe file system navigation with security controls
 */

import fs from 'fs-extra';
import { join, resolve, relative, extname, basename } from 'path';
import { formatBytes } from '../shared/utils.js';

/**
 * Secure File Browser Class
 * Provides file system navigation with security validation
 */
export class FileBrowser {
    constructor(projectRoot, dependencies = {}) {
        this.projectRoot = projectRoot;
        this.security = dependencies.security;
        this.logger = dependencies.logger;
        
        // Load configuration
        this.config = {
            maxFileSize: 1048576, // 1MB default
            maxFilesPerRequest: 50,
            allowedExtensions: [
                '.js', '.mjs', '.json', '.md', '.txt', '.yml', '.yaml',
                '.html', '.css', '.ts', '.jsx', '.tsx', '.vue', '.py',
                '.sh', '.bat', '.cmd', '.gitignore', '.env.example'
            ],
            blockedFiles: [
                '.env', '.env.local', '.env.production', '.env.development',
                'id_rsa', 'id_ed25519', '*.pem', '*.key', '*.crt', '*.p12',
                'config.ini', 'database.conf', 'secrets.json', 'credentials.json'
            ],
            hiddenDirectories: [
                'node_modules', '.git', '.svn', '.hg', 'dist', 'build',
                '__pycache__', '.pytest_cache', '.coverage', 'coverage'
            ]
        };
        
        this.logger.info('FileBrowser initialized with security controls');
    }

    /**
     * Browse directory contents with security validation
     * @param {string} requestedPath - Relative path to browse
     * @param {string} projectDirectory - Base project directory
     * @returns {Promise<Object>} Browse result
     */
    async browseDirectory(requestedPath = '', projectDirectory = this.projectRoot) {
        try {
            // Validate and normalize the requested path for directory browsing
            const pathValidation = this.security.validateDirectoryPath(requestedPath, projectDirectory);
            if (!pathValidation.isValid) {
                this.logger.warn('Directory path validation failed', {
                    requestedPath,
                    error: pathValidation.error
                });
                
                return {
                    success: false,
                    error: pathValidation.error
                };
            }

            const fullPath = join(projectDirectory, pathValidation.normalizedPath);
            
            // Check if path exists
            if (!await fs.pathExists(fullPath)) {
                return {
                    success: false,
                    error: 'Path not found'
                };
            }

            // Check if it's a directory
            const stats = await fs.stat(fullPath);
            if (!stats.isDirectory()) {
                return {
                    success: false,
                    error: 'Path is not a directory'
                };
            }

            this.logger.debug('Browsing directory', {
                requestedPath,
                fullPath: fullPath.substring(0, 100)
            });

            // Read directory contents
            const items = await fs.readdir(fullPath, { withFileTypes: true });
            
            // Process and filter items
            const processedItems = await this.processDirectoryItems(items, fullPath, pathValidation.normalizedPath);
            
            // Apply security filtering
            const filteredItems = this.applySecurityFiltering(processedItems);
            
            // Limit results
            const limitedItems = filteredItems.slice(0, this.config.maxFilesPerRequest);
            
            this.logger.audit('directory_browsed', {
                path: pathValidation.normalizedPath,
                totalItems: items.length,
                filteredItems: filteredItems.length,
                returnedItems: limitedItems.length
            });

            return {
                success: true,
                currentPath: pathValidation.normalizedPath,
                parentPath: this.getParentPath(pathValidation.normalizedPath),
                items: limitedItems,
                totalItems: filteredItems.length,
                hasMore: filteredItems.length > this.config.maxFilesPerRequest
            };

        } catch (error) {
            this.logger.error('Directory browsing failed', {
                requestedPath,
                error: error.message
            });
            
            return {
                success: false,
                error: 'Failed to browse directory'
            };
        }
    }

    /**
     * Process directory items and get metadata
     * @param {Dirent[]} items - Directory entries
     * @param {string} fullPath - Full directory path
     * @param {string} relativePath - Relative path from project root
     * @returns {Promise<Array>} Processed items
     */
    async processDirectoryItems(items, fullPath, relativePath) {
        const processedItems = [];

        for (const item of items) {
            try {
                const itemPath = join(fullPath, item.name);
                const stats = await fs.stat(itemPath);
                
                const processedItem = {
                    name: item.name,
                    type: item.isDirectory() ? 'directory' : 'file',
                    path: relativePath ? `${relativePath}/${item.name}` : item.name,
                    size: stats.size,
                    formattedSize: formatBytes(stats.size),
                    modified: stats.mtime.toISOString(),
                    permissions: this.getPermissionsString(stats.mode),
                    isReadable: this.isFileReadable(stats),
                    extension: item.isFile() ? extname(item.name).toLowerCase() : null
                };

                // Add additional metadata for files
                if (item.isFile()) {
                    processedItem.isTextFile = this.isTextFile(processedItem.extension);
                    processedItem.isBinary = !processedItem.isTextFile;
                    processedItem.canView = this.canViewFile(item.name, processedItem.extension, stats.size);
                }

                processedItems.push(processedItem);
                
            } catch (error) {
                // Log error but continue processing other items
                this.logger.warn('Failed to process directory item', {
                    itemName: item.name,
                    error: error.message
                });
            }
        }

        return processedItems;
    }

    /**
     * Apply security filtering to directory items
     * @param {Array} items - Items to filter
     * @returns {Array} Filtered items
     */
    applySecurityFiltering(items) {
        return items.filter(item => {
            // Check if file is blocked
            if (this.security.isFileBlocked(item.name, this.config.blockedFiles)) {
                this.logger.debug('File blocked by security policy', { fileName: item.name });
                return false;
            }

            // Check if directory should be hidden
            if (item.type === 'directory' && this.config.hiddenDirectories.includes(item.name)) {
                this.logger.debug('Directory hidden by policy', { directoryName: item.name });
                return false;
            }

            // Check file extension for files
            if (item.type === 'file' && !this.security.isFileExtensionAllowed(item.name, this.config.allowedExtensions)) {
                this.logger.debug('File extension not allowed', { fileName: item.name, extension: item.extension });
                return false;
            }

            // Check file size
            if (item.type === 'file' && item.size > this.config.maxFileSize * 10) { // 10x limit for listing
                this.logger.debug('File too large for listing', { fileName: item.name, size: item.size });
                return false;
            }

            // Skip hidden files (starting with .)
            if (item.name.startsWith('.') && !this.isAllowedHiddenFile(item.name)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Get file content with security validation
     * @param {string} filePath - Relative file path
     * @param {string} projectDirectory - Base project directory
     * @returns {Promise<Object>} File content result
     */
    async getFileContent(filePath, projectDirectory = this.projectRoot) {
        try {
            // Validate file path
            const pathValidation = this.security.validateFilePath(filePath, projectDirectory);
            if (!pathValidation.isValid) {
                return {
                    success: false,
                    error: pathValidation.error
                };
            }

            const fullPath = join(projectDirectory, pathValidation.normalizedPath);
            
            // Check if file exists
            if (!await fs.pathExists(fullPath)) {
                return {
                    success: false,
                    error: 'File not found'
                };
            }

            // Check if it's a file
            const stats = await fs.stat(fullPath);
            if (!stats.isFile()) {
                return {
                    success: false,
                    error: 'Path is not a file'
                };
            }

            const fileName = basename(fullPath);
            const extension = extname(fileName).toLowerCase();

            // Security checks
            if (this.security.isFileBlocked(fileName, this.config.blockedFiles)) {
                this.logger.warn('Blocked file access attempt', { filePath });
                return {
                    success: false,
                    error: 'File access denied'
                };
            }

            if (!this.security.isFileExtensionAllowed(fileName, this.config.allowedExtensions)) {
                return {
                    success: false,
                    error: 'File type not allowed'
                };
            }

            // Check file size
            if (stats.size > this.config.maxFileSize) {
                return {
                    success: false,
                    error: `File too large (max ${formatBytes(this.config.maxFileSize)})`
                };
            }

            // Check if file is readable
            if (!this.isFileReadable(stats)) {
                return {
                    success: false,
                    error: 'File is not readable'
                };
            }

            // Read file content
            let content;
            let encoding = 'utf8';
            
            if (this.isTextFile(extension)) {
                content = await fs.readFile(fullPath, 'utf8');
            } else {
                // For binary files, return base64 or just metadata
                encoding = 'base64';
                content = await fs.readFile(fullPath, 'base64');
                
                // Limit binary file content
                if (content.length > 100000) { // ~75KB in base64
                    content = content.substring(0, 100000) + '... (truncated)';
                }
            }

            this.logger.audit('file_accessed', {
                filePath: pathValidation.normalizedPath,
                fileSize: stats.size,
                encoding
            });

            return {
                success: true,
                filePath: pathValidation.normalizedPath,
                fileName,
                content,
                encoding,
                size: stats.size,
                formattedSize: formatBytes(stats.size),
                modified: stats.mtime.toISOString(),
                extension,
                isTextFile: this.isTextFile(extension),
                lineCount: encoding === 'utf8' ? content.split('\n').length : null
            };

        } catch (error) {
            this.logger.error('Failed to get file content', {
                filePath,
                error: error.message
            });
            
            return {
                success: false,
                error: 'Failed to read file content'
            };
        }
    }

    /**
     * Get parent path
     * @param {string} currentPath - Current path
     * @returns {string|null} Parent path or null if at root
     */
    getParentPath(currentPath) {
        if (!currentPath || currentPath === '' || currentPath === '.') {
            return null;
        }
        
        const parts = currentPath.split('/').filter(part => part.length > 0);
        if (parts.length <= 1) {
            return '';
        }
        
        return parts.slice(0, -1).join('/');
    }

    /**
     * Check if file extension indicates a text file
     * @param {string} extension - File extension
     * @returns {boolean} True if text file
     */
    isTextFile(extension) {
        const textExtensions = [
            '.txt', '.md', '.json', '.js', '.mjs', '.ts', '.jsx', '.tsx',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.xml', '.yml', '.yaml', '.toml', '.ini', '.conf',
            '.sh', '.bash', '.bat', '.cmd', '.ps1',
            '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
            '.cs', '.go', '.rs', '.swift', '.kt', '.scala',
            '.sql', '.graphql', '.proto', '.dockerfile',
            '.gitignore', '.gitattributes', '.editorconfig',
            '.env.example', '.env.template'
        ];
        
        return textExtensions.includes(extension);
    }

    /**
     * Check if file can be viewed based on security policies
     * @param {string} fileName - File name
     * @param {string} extension - File extension
     * @param {number} size - File size
     * @returns {boolean} True if file can be viewed
     */
    canViewFile(fileName, extension, size) {
        // Size check
        if (size > this.config.maxFileSize) {
            return false;
        }
        
        // Security checks
        if (this.security.isFileBlocked(fileName, this.config.blockedFiles)) {
            return false;
        }
        
        if (!this.security.isFileExtensionAllowed(fileName, this.config.allowedExtensions)) {
            return false;
        }
        
        return true;
    }

    /**
     * Check if file is readable
     * @param {fs.Stats} stats - File stats
     * @returns {boolean} True if readable
     */
    isFileReadable(stats) {
        // Basic permission check (this is simplified)
        const mode = stats.mode;
        const ownerRead = (mode & parseInt('400', 8)) !== 0;
        const groupRead = (mode & parseInt('040', 8)) !== 0;
        const otherRead = (mode & parseInt('004', 8)) !== 0;
        
        return ownerRead || groupRead || otherRead;
    }

    /**
     * Get permissions string from file mode
     * @param {number} mode - File mode
     * @returns {string} Permissions string
     */
    getPermissionsString(mode) {
        const perms = [];
        
        // Owner permissions
        perms.push((mode & parseInt('400', 8)) ? 'r' : '-');
        perms.push((mode & parseInt('200', 8)) ? 'w' : '-');
        perms.push((mode & parseInt('100', 8)) ? 'x' : '-');
        
        // Group permissions
        perms.push((mode & parseInt('040', 8)) ? 'r' : '-');
        perms.push((mode & parseInt('020', 8)) ? 'w' : '-');
        perms.push((mode & parseInt('010', 8)) ? 'x' : '-');
        
        // Other permissions
        perms.push((mode & parseInt('004', 8)) ? 'r' : '-');
        perms.push((mode & parseInt('002', 8)) ? 'w' : '-');
        perms.push((mode & parseInt('001', 8)) ? 'x' : '-');
        
        return perms.join('');
    }

    /**
     * Check if hidden file is allowed
     * @param {string} fileName - File name starting with .
     * @returns {boolean} True if allowed
     */
    isAllowedHiddenFile(fileName) {
        const allowedHiddenFiles = [
            '.gitignore', '.gitattributes', '.editorconfig',
            '.env.example', '.env.template', '.env.schema',
            '.eslintrc.json', '.prettierrc', '.babelrc',
            '.nvmrc', '.node-version'
        ];
        
        return allowedHiddenFiles.includes(fileName);
    }

    /**
     * Get file browser statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            config: {
                maxFileSize: this.config.maxFileSize,
                maxFilesPerRequest: this.config.maxFilesPerRequest,
                allowedExtensions: this.config.allowedExtensions.length,
                blockedFiles: this.config.blockedFiles.length
            }
        };
    }
}
