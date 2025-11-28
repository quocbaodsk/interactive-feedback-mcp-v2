/**
 * Security Layer for Interactive Feedback MCP
 * Handles command validation, input sanitization, and access controls
 */

import { join } from 'path';
import { readFileSync } from 'fs';
import Joi from 'joi';
import { validatePath, isAllowedFileExtension, isBlockedFile, sanitizeForLog } from '../shared/utils.js';

/**
 * Security Manager Class
 * Centralized security controls and validation
 */
export class SecurityManager {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.whitelistConfig = null;
        this.defaultConfig = null;
        
        this.loadConfigurations();
        this.setupValidationSchemas();
    }

    /**
     * Load security configurations
     */
    loadConfigurations() {
        try {
            const whitelistPath = join(this.projectRoot, 'config', 'commands-whitelist.json');
            const defaultConfigPath = join(this.projectRoot, 'config', 'default-config.json');
            
            this.whitelistConfig = JSON.parse(readFileSync(whitelistPath, 'utf8'));
            this.defaultConfig = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to load security configurations: ${error.message}`);
        }
    }

    /**
     * Setup Joi validation schemas
     */
    setupValidationSchemas() {
        this.schemas = {
            command: Joi.string()
                .min(1)
                .max(this.whitelistConfig.maxCommandLength || 500)
                .pattern(/^[a-zA-Z0-9\s\-_\.\/\\:='"@#]+$/)
                .required(),
            
            filePath: Joi.string()
                .min(1)
                .max(2048)
                .pattern(/^[a-zA-Z0-9\s\-_\.\/\\]+$/)
                .required(),
            
            projectDirectory: Joi.string()
                .min(1)
                .max(2048)
                .required(),
            
            summary: Joi.string()
                .max(10000)
                .allow(''),
            
            feedback: Joi.string()
                .max(50000)
                .allow('')
        };
    }

    /**
     * Validate command against whitelist and security rules
     * @param {string} command - Command to validate
     * @returns {{isValid: boolean, error?: string, sanitizedCommand?: string}} Validation result
     */
    validateCommand(command) {
        try {
            // Basic input validation
            const { error } = this.schemas.command.validate(command);
            if (error) {
                return { isValid: false, error: 'Invalid command format' };
            }

            // Check against forbidden patterns first
            if (this.containsForbiddenPattern(command)) {
                return { isValid: false, error: 'Command contains forbidden patterns' };
            }

            // Check against whitelist
            if (!this.isCommandWhitelisted(command)) {
                return { isValid: false, error: 'Command not in whitelist' };
            }

            // Sanitize command for execution
            const sanitizedCommand = this.sanitizeCommand(command);

            return {
                isValid: true,
                sanitizedCommand,
                originalCommand: command
            };

        } catch (error) {
            return { isValid: false, error: `Command validation error: ${error.message}` };
        }
    }

    /**
     * Check if command contains forbidden patterns
     * @param {string} command - Command to check
     * @returns {boolean} True if contains forbidden patterns
     */
    containsForbiddenPattern(command) {
        const forbiddenPatterns = this.whitelistConfig.forbiddenPatterns || [];
        
        return forbiddenPatterns.some(pattern => {
            const regex = new RegExp(pattern, 'i');
            return regex.test(command);
        });
    }

    /**
     * Check if command is whitelisted
     * @param {string} command - Command to check
     * @returns {boolean} True if command is allowed
     */
    isCommandWhitelisted(command) {
        const { allowedCommands, commandPatterns } = this.whitelistConfig;
        const cmdLower = command.toLowerCase().trim();

        // Check against simple allowed commands
        const allAllowedCommands = [
            ...(allowedCommands.development || []),
            ...(allowedCommands.build || []),
            ...(allowedCommands.git || [])
        ];

        // Check exact matches first
        if (allAllowedCommands.some(allowed => cmdLower.startsWith(allowed.toLowerCase()))) {
            return true;
        }

        // Check against command patterns
        if (commandPatterns) {
            for (const [category, pattern] of Object.entries(commandPatterns)) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(command)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Sanitize command for safe execution
     * @param {string} command - Command to sanitize
     * @returns {string} Sanitized command
     */
    sanitizeCommand(command) {
        return command
            .trim()
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .replace(/[;&|`$()]/g, '') // Remove shell metacharacters
            .substring(0, this.whitelistConfig.maxCommandLength || 500);
    }

    /**
     * Validate directory path for secure access
     * @param {string} dirPath - Directory path to validate
     * @param {string} basePath - Base path to validate against
     * @returns {{isValid: boolean, normalizedPath?: string, error?: string}} Validation result
     */
    validateDirectoryPath(dirPath, basePath) {
        try {
            // Handle empty string or root directory
            if (!dirPath || dirPath === '' || dirPath === '.') {
                return {
                    isValid: true,
                    normalizedPath: ''
                };
            }

            // Basic input validation for directories
            const dirPathSchema = this.schemas.filePath; // Reuse file path schema
            const { error } = dirPathSchema.validate(dirPath);
            if (error) {
                return { isValid: false, error: 'Invalid directory path format' };
            }

            // Path traversal protection
            const pathResult = validatePath(dirPath, basePath);
            if (!pathResult.isValid) {
                return pathResult;
            }

            return {
                isValid: true,
                normalizedPath: pathResult.normalizedPath
            };

        } catch (error) {
            return { isValid: false, error: `Directory path validation error: ${error.message}` };
        }
    }

    /**
     * Validate file path for secure access
     * @param {string} filePath - File path to validate
     * @param {string} basePath - Base path to validate against
     * @returns {{isValid: boolean, normalizedPath?: string, error?: string}} Validation result
     */
    validateFilePath(filePath, basePath) {
        try {
            // Basic input validation
            const { error } = this.schemas.filePath.validate(filePath);
            if (error) {
                return { isValid: false, error: 'Invalid file path format' };
            }

            // Path traversal protection
            const pathResult = validatePath(filePath, basePath);
            if (!pathResult.isValid) {
                return pathResult;
            }

            const filename = filePath.split(/[/\\]/).pop();
            
            // Check if file is blocked
            if (this.isFileBlocked(filename)) {
                return { isValid: false, error: 'File access denied' };
            }

            // Check file extension
            if (!this.isFileExtensionAllowed(filename)) {
                return { isValid: false, error: 'File type not allowed' };
            }

            return {
                isValid: true,
                normalizedPath: pathResult.normalizedPath,
                filename
            };

        } catch (error) {
            return { isValid: false, error: `File path validation error: ${error.message}` };
        }
    }

    /**
     * Check if file is blocked
     * @param {string} filename - Filename to check
     * @returns {boolean} True if file should be blocked
     */
    isFileBlocked(filename) {
        const blockedFiles = this.defaultConfig.files?.blockedFiles || [];
        return isBlockedFile(filename, blockedFiles);
    }

    /**
     * Check if file extension is allowed
     * @param {string} filename - Filename to check
     * @returns {boolean} True if extension is allowed
     */
    isFileExtensionAllowed(filename) {
        const allowedExtensions = this.defaultConfig.files?.allowedExtensions || [];
        return isAllowedFileExtension(filename, allowedExtensions);
    }

    /**
     * Validate MCP request data
     * @param {Object} requestData - Request data to validate
     * @returns {{isValid: boolean, sanitizedData?: Object, error?: string}} Validation result
     */
    validateMCPRequest(requestData) {
        try {
            const { project_directory, summary } = requestData;

            // Validate project directory
            if (project_directory) {
                const { error } = this.schemas.projectDirectory.validate(project_directory);
                if (error) {
                    return { isValid: false, error: 'Invalid project directory format' };
                }
            }

            // Validate summary
            if (summary !== undefined) {
                const { error } = this.schemas.summary.validate(summary);
                if (error) {
                    return { isValid: false, error: 'Invalid summary format' };
                }
            }

            return {
                isValid: true,
                sanitizedData: {
                    project_directory: project_directory ? this.sanitizeInput(project_directory) : undefined,
                    summary: summary ? this.sanitizeInput(summary) : undefined
                }
            };

        } catch (error) {
            return { isValid: false, error: `MCP request validation error: ${error.message}` };
        }
    }

    /**
     * Validate feedback input
     * @param {string} feedback - Feedback text to validate
     * @returns {{isValid: boolean, sanitizedFeedback?: string, error?: string}} Validation result
     */
    validateFeedback(feedback) {
        try {
            const { error } = this.schemas.feedback.validate(feedback);
            if (error) {
                return { isValid: false, error: 'Invalid feedback format' };
            }

            return {
                isValid: true,
                sanitizedFeedback: this.sanitizeInput(feedback)
            };

        } catch (error) {
            return { isValid: false, error: `Feedback validation error: ${error.message}` };
        }
    }

    /**
     * Sanitize general input text
     * @param {string} input - Input to sanitize
     * @returns {string} Sanitized input
     */
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }

        return input
            .trim()
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }

    /**
     * Generate security audit log entry
     * @param {string} action - Action being performed
     * @param {Object} details - Additional details
     * @returns {Object} Audit log entry
     */
    createAuditLogEntry(action, details = {}) {
        return {
            timestamp: new Date().toISOString(),
            action,
            details: {
                ...details,
                userAgent: details.userAgent ? this.sanitizeInput(details.userAgent) : undefined,
                remoteAddress: details.remoteAddress || 'localhost',
                command: details.command ? sanitizeForLog(details.command) : undefined
            },
            level: details.level || 'info'
        };
    }

    /**
     * Check rate limiting (basic implementation)
     * @param {string} identifier - Client identifier (IP, session, etc.)
     * @returns {{allowed: boolean, resetTime?: number}} Rate limit result
     */
    checkRateLimit(identifier) {
        // Simple in-memory rate limiting implementation
        // In production, this should use Redis or similar
        if (!this.rateLimitStore) {
            this.rateLimitStore = new Map();
        }

        const now = Date.now();
        const windowMs = this.defaultConfig.security?.rateLimitWindowMs || 900000; // 15 minutes
        const maxRequests = this.defaultConfig.security?.rateLimitMaxRequests || 100;

        const key = `rate_limit_${identifier}`;
        const record = this.rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

        // Reset if window has passed
        if (now > record.resetTime) {
            record.count = 0;
            record.resetTime = now + windowMs;
        }

        // Check if limit exceeded
        if (record.count >= maxRequests) {
            return { allowed: false, resetTime: record.resetTime };
        }

        // Increment count
        record.count++;
        this.rateLimitStore.set(key, record);

        return { allowed: true };
    }

    /**
     * Get security configuration
     * @returns {Object} Security configuration
     */
    getSecurityConfig() {
        return {
            maxCommandLength: this.whitelistConfig.maxCommandLength,
            maxExecutionTimeSeconds: this.whitelistConfig.maxExecutionTimeSeconds,
            allowedFileExtensions: this.defaultConfig.files?.allowedExtensions,
            blockedFiles: this.defaultConfig.files?.blockedFiles,
            rateLimitConfig: {
                windowMs: this.defaultConfig.security?.rateLimitWindowMs,
                maxRequests: this.defaultConfig.security?.rateLimitMaxRequests
            }
        };
    }
}
