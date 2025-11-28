/**
 * Migration Tools for Interactive Feedback MCP
 * Handles migration from old version to secure version
 */

import fs from 'fs-extra';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { getCurrentTimestamp, ensureDirectory } from './utils.js';
import { getLogger } from './logger.js';

/**
 * Migration Manager Class
 * Handles migration from old global storage to new local storage
 */
export class MigrationManager {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.logger = getLogger(projectRoot);
        
        // Old and new paths
        this.oldConfigDir = join(homedir(), '.interactive-feedback-mcp');
        this.newConfigDir = join(projectRoot, 'storage', 'configs');
        this.migrationLogPath = join(projectRoot, 'storage', 'migration.log');
        
        this.logger.info('MigrationManager initialized', {
            oldConfigDir: this.oldConfigDir,
            newConfigDir: this.newConfigDir
        });
    }

    /**
     * Check if migration is needed
     * @returns {Promise<Object>} Migration status
     */
    async checkMigrationStatus() {
        try {
            const oldExists = await fs.pathExists(this.oldConfigDir);
            const migrationLogExists = await fs.pathExists(this.migrationLogPath);
            
            if (!oldExists) {
                return {
                    needed: false,
                    reason: 'No old configuration directory found',
                    oldConfigDir: this.oldConfigDir
                };
            }

            if (migrationLogExists) {
                const migrationLog = await fs.readJson(this.migrationLogPath);
                return {
                    needed: false,
                    reason: 'Migration already completed',
                    completedAt: migrationLog.completedAt,
                    migratedFiles: migrationLog.migratedFiles
                };
            }

            // Check for old config files
            const oldFiles = await this.findOldConfigFiles();
            
            return {
                needed: oldFiles.length > 0,
                reason: `Found ${oldFiles.length} configuration file(s) to migrate`,
                oldFiles: oldFiles.map(f => ({
                    name: f.name,
                    size: f.size,
                    modified: f.modified
                }))
            };

        } catch (error) {
            this.logger.error('Failed to check migration status', {
                error: error.message
            });
            
            return {
                needed: false,
                reason: 'Error checking migration status',
                error: error.message
            };
        }
    }

    /**
     * Perform migration from old to new system
     * @param {Object} options - Migration options
     * @returns {Promise<Object>} Migration result
     */
    async performMigration(options = {}) {
        const migrationId = createHash('md5').update(Date.now().toString()).digest('hex').substring(0, 8);
        const startTime = Date.now();
        
        this.logger.info('Starting configuration migration', {
            migrationId,
            oldConfigDir: this.oldConfigDir,
            newConfigDir: this.newConfigDir
        });

        try {
            // Ensure new config directory exists
            await ensureDirectory(this.newConfigDir);
            
            // Find old configuration files
            const oldFiles = await this.findOldConfigFiles();
            
            if (oldFiles.length === 0) {
                return {
                    success: true,
                    message: 'No files to migrate',
                    migratedFiles: []
                };
            }

            // Migrate each file
            const migrationResults = [];
            for (const file of oldFiles) {
                const result = await this.migrateConfigFile(file, options);
                migrationResults.push(result);
                
                if (result.success) {
                    this.logger.info('Config file migrated successfully', {
                        oldPath: file.path,
                        newPath: result.newPath
                    });
                } else {
                    this.logger.warn('Config file migration failed', {
                        oldPath: file.path,
                        error: result.error
                    });
                }
            }

            const successfulMigrations = migrationResults.filter(r => r.success);
            const failedMigrations = migrationResults.filter(r => !r.success);

            // Create migration log
            const migrationLog = {
                migrationId,
                startTime: new Date(startTime).toISOString(),
                completedAt: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                totalFiles: oldFiles.length,
                migratedFiles: successfulMigrations.length,
                failedFiles: failedMigrations.length,
                results: migrationResults,
                version: '2.0.0'
            };

            await fs.writeJson(this.migrationLogPath, migrationLog, { spaces: 2 });

            this.logger.info('Migration completed', {
                migrationId,
                totalFiles: oldFiles.length,
                migratedFiles: successfulMigrations.length,
                failedFiles: failedMigrations.length,
                duration: migrationLog.duration
            });

            this.logger.audit('migration_completed', {
                migrationId,
                totalFiles: oldFiles.length,
                migratedFiles: successfulMigrations.length
            });

            return {
                success: true,
                migrationId,
                message: `Successfully migrated ${successfulMigrations.length} of ${oldFiles.length} configuration files`,
                totalFiles: oldFiles.length,
                migratedFiles: successfulMigrations.length,
                failedFiles: failedMigrations.length,
                results: migrationResults,
                duration: migrationLog.duration
            };

        } catch (error) {
            this.logger.error('Migration failed', {
                migrationId,
                error: error.message,
                duration: Date.now() - startTime
            });

            return {
                success: false,
                migrationId,
                message: 'Migration failed',
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Find old configuration files
     * @returns {Promise<Array>} Array of old config files
     */
    async findOldConfigFiles() {
        try {
            if (!await fs.pathExists(this.oldConfigDir)) {
                return [];
            }

            const files = await fs.readdir(this.oldConfigDir);
            const configFiles = [];

            for (const filename of files) {
                if (filename.endsWith('.json') && !filename.includes('backup')) {
                    const filePath = join(this.oldConfigDir, filename);
                    const stats = await fs.stat(filePath);
                    
                    configFiles.push({
                        name: filename,
                        path: filePath,
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    });
                }
            }

            return configFiles;

        } catch (error) {
            this.logger.error('Failed to find old config files', {
                error: error.message,
                oldConfigDir: this.oldConfigDir
            });
            return [];
        }
    }

    /**
     * Migrate a single configuration file
     * @param {Object} file - File info object
     * @param {Object} options - Migration options
     * @returns {Promise<Object>} Migration result
     */
    async migrateConfigFile(file, options = {}) {
        try {
            // Read old configuration
            const oldConfig = await fs.readJson(file.path);
            
            // Extract project directory from filename or config
            const projectDirectory = this.extractProjectDirectory(file.name, oldConfig);
            
            // Transform configuration to new format
            const newConfig = this.transformConfiguration(oldConfig, projectDirectory);
            
            // Generate new config file path
            const newConfigPath = this.generateNewConfigPath(projectDirectory);
            
            // Check if new config already exists
            if (await fs.pathExists(newConfigPath) && !options.overwrite) {
                return {
                    success: false,
                    oldPath: file.path,
                    newPath: newConfigPath,
                    error: 'New configuration file already exists (use --overwrite to replace)'
                };
            }

            // Create backup of old config
            if (options.createBackup !== false) {
                await this.createBackup(file.path);
            }

            // Write new configuration
            await fs.writeJson(newConfigPath, newConfig, { spaces: 2 });

            return {
                success: true,
                oldPath: file.path,
                newPath: newConfigPath,
                projectDirectory,
                configSize: JSON.stringify(newConfig).length
            };

        } catch (error) {
            return {
                success: false,
                oldPath: file.path,
                error: error.message
            };
        }
    }

    /**
     * Extract project directory from filename or config
     * @param {string} filename - Configuration filename
     * @param {Object} config - Configuration object
     * @returns {string} Project directory
     */
    extractProjectDirectory(filename, config) {
        // Try to extract from config first
        if (config.projectDirectory) {
            return config.projectDirectory;
        }
        
        // Try to extract from filename (format: project_hash.json)
        const match = filename.match(/^(.+)_[a-f0-9]{8}\.json$/);
        if (match) {
            const projectName = match[1].replace(/_/g, '/'); // Restore path separators
            return projectName;
        }
        
        // Fallback to filename without extension
        return filename.replace('.json', '').replace(/_/g, '/');
    }

    /**
     * Transform old configuration format to new format
     * @param {Object} oldConfig - Old configuration
     * @param {string} projectDirectory - Project directory
     * @returns {Object} New configuration
     */
    transformConfiguration(oldConfig, projectDirectory) {
        const newConfig = {
            // Core settings
            run_command: oldConfig.run_command || '',
            execute_automatically: Boolean(oldConfig.execute_automatically),
            command_section_visible: Boolean(oldConfig.command_section_visible),
            
            // UI settings
            ui: {
                theme: 'dark',
                autoFocus: true,
                commandHistorySize: 50,
                enableNotifications: true
            },
            
            // Window geometry (if available)
            window_geometry: oldConfig.window_geometry || null,
            
            // Migration metadata
            _meta: {
                migratedFrom: 'v1.x',
                projectDirectory,
                migratedAt: getCurrentTimestamp(),
                originalConfig: oldConfig, // Keep original for reference
                version: '2.0.0'
            }
        };

        // Copy any additional properties that might be useful
        for (const [key, value] of Object.entries(oldConfig)) {
            if (!newConfig[key] && typeof value !== 'function') {
                newConfig[key] = value;
            }
        }

        return newConfig;
    }

    /**
     * Generate new configuration file path
     * @param {string} projectDirectory - Project directory
     * @returns {string} New config file path
     */
    generateNewConfigPath(projectDirectory) {
        const projectHash = createHash('md5')
            .update(projectDirectory)
            .digest('hex')
            .substring(0, 8);
        
        const projectName = require('path').basename(projectDirectory) || 'unknown';
        const safeProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
        
        return join(this.newConfigDir, `${safeProjectName}_${projectHash}.json`);
    }

    /**
     * Create backup of old configuration file
     * @param {string} oldPath - Old config file path
     */
    async createBackup(oldPath) {
        try {
            const backupDir = join(this.oldConfigDir, 'backups');
            await ensureDirectory(backupDir);
            
            const filename = require('path').basename(oldPath, '.json');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = join(backupDir, `${filename}_backup_${timestamp}.json`);
            
            await fs.copy(oldPath, backupPath);
            
            this.logger.debug('Created backup of old config', {
                oldPath,
                backupPath
            });

        } catch (error) {
            this.logger.warn('Failed to create backup', {
                oldPath,
                error: error.message
            });
        }
    }

    /**
     * Clean up old configuration files after successful migration
     * @param {Object} migrationResult - Migration result
     * @param {Object} options - Cleanup options
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupOldConfigs(migrationResult, options = {}) {
        if (!migrationResult.success || options.keepOldFiles) {
            return { success: false, reason: 'Migration not successful or cleanup disabled' };
        }

        try {
            const cleanupResults = [];
            
            for (const result of migrationResult.results) {
                if (result.success && await fs.pathExists(result.oldPath)) {
                    try {
                        // Move to archive instead of deleting
                        const archiveDir = join(this.oldConfigDir, 'archived');
                        await ensureDirectory(archiveDir);
                        
                        const filename = require('path').basename(result.oldPath);
                        const archivePath = join(archiveDir, `${filename}_archived_${Date.now()}`);
                        
                        await fs.move(result.oldPath, archivePath);
                        
                        cleanupResults.push({
                            success: true,
                            oldPath: result.oldPath,
                            archivePath
                        });
                        
                    } catch (error) {
                        cleanupResults.push({
                            success: false,
                            oldPath: result.oldPath,
                            error: error.message
                        });
                    }
                }
            }

            this.logger.info('Old configuration cleanup completed', {
                totalFiles: cleanupResults.length,
                archivedFiles: cleanupResults.filter(r => r.success).length
            });

            return {
                success: true,
                totalFiles: cleanupResults.length,
                archivedFiles: cleanupResults.filter(r => r.success).length,
                results: cleanupResults
            };

        } catch (error) {
            this.logger.error('Cleanup failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get migration log
     * @returns {Promise<Object|null>} Migration log or null
     */
    async getMigrationLog() {
        try {
            if (await fs.pathExists(this.migrationLogPath)) {
                return await fs.readJson(this.migrationLogPath);
            }
            return null;
        } catch (error) {
            this.logger.error('Failed to read migration log', { error: error.message });
            return null;
        }
    }

    /**
     * Verify migration integrity
     * @returns {Promise<Object>} Verification result
     */
    async verifyMigration() {
        try {
            const migrationLog = await this.getMigrationLog();
            if (!migrationLog) {
                return { success: false, reason: 'No migration log found' };
            }

            const verificationResults = [];
            
            for (const result of migrationLog.results) {
                if (result.success) {
                    const newFileExists = await fs.pathExists(result.newPath);
                    verificationResults.push({
                        oldPath: result.oldPath,
                        newPath: result.newPath,
                        verified: newFileExists
                    });
                }
            }

            const verifiedCount = verificationResults.filter(r => r.verified).length;
            
            return {
                success: true,
                totalMigrated: migrationLog.migratedFiles,
                verified: verifiedCount,
                isComplete: verifiedCount === migrationLog.migratedFiles,
                results: verificationResults
            };

        } catch (error) {
            this.logger.error('Migration verification failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
}
