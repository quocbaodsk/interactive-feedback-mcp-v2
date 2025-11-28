/**
 * Shared Utilities for Interactive Feedback MCP
 * Common helper functions used across the application
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Generate a secure random UUID
 * @returns {string} Random UUID
 */
export function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Create a hash from input string
 * @param {string} input - Input string to hash
 * @param {number} length - Length of hash to return (default: 8)
 * @returns {string} Hash string
 */
export function createHash(input, length = 8) {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, length);
}

/**
 * Get first line from text
 * @param {string} text - Input text
 * @returns {string} First line trimmed
 */
export function firstLine(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    return text.split('\n')[0].trim();
}

/**
 * Validate and normalize file path
 * @param {string} filePath - Input file path
 * @param {string} basePath - Base path to validate against
 * @returns {{isValid: boolean, normalizedPath: string, error?: string}} Validation result
 */
export function validatePath(filePath, basePath) {
    try {
        if (!filePath || typeof filePath !== 'string') {
            return { isValid: false, normalizedPath: '', error: 'Invalid file path' };
        }

        // Normalize path separators
        const normalizedInput = filePath.replace(/\\/g, '/');
        const fullPath = path.join(basePath, normalizedInput);
        
        // Security check: ensure path is within base directory
        const resolvedPath = path.resolve(fullPath);
        const resolvedBasePath = path.resolve(basePath);
        
        if (!resolvedPath.startsWith(resolvedBasePath)) {
            return { isValid: false, normalizedPath: '', error: 'Path outside base directory' };
        }

        return { isValid: true, normalizedPath: path.relative(basePath, resolvedPath) };
    } catch (error) {
        return { isValid: false, normalizedPath: '', error: error.message };
    }
}

/**
 * Sanitize command string for logging
 * @param {string} command - Command to sanitize
 * @returns {string} Sanitized command
 */
export function sanitizeForLog(command) {
    if (!command) return '';
    
    // Remove potential sensitive information patterns
    return command
        .replace(/--password[=\s]+[^\s]+/gi, '--password=***')
        .replace(/--token[=\s]+[^\s]+/gi, '--token=***')
        .replace(/--key[=\s]+[^\s]+/gi, '--key=***')
        .replace(/--secret[=\s]+[^\s]+/gi, '--secret=***');
}

/**
 * Check if file extension is allowed
 * @param {string} filename - Filename to check
 * @param {string[]} allowedExtensions - Array of allowed extensions
 * @returns {boolean} True if extension is allowed
 */
export function isAllowedFileExtension(filename, allowedExtensions) {
    if (!filename || !Array.isArray(allowedExtensions)) return false;
    
    const ext = path.extname(filename).toLowerCase();
    return allowedExtensions.includes(ext);
}

/**
 * Check if file should be blocked
 * @param {string} filename - Filename to check
 * @param {string[]} blockedFiles - Array of blocked file patterns
 * @returns {boolean} True if file should be blocked
 */
export function isBlockedFile(filename, blockedFiles) {
    if (!filename || !Array.isArray(blockedFiles)) return false;
    
    const lowerFilename = filename.toLowerCase();
    
    return blockedFiles.some(pattern => {
        if (pattern.includes('*')) {
            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexPattern}$`, 'i');
            return regex.test(lowerFilename);
        }
        return lowerFilename === pattern.toLowerCase();
    });
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Create directory structure if it doesn't exist
 * @param {string} dirPath - Directory path to create
 */
export async function ensureDirectory(dirPath) {
    try {
        await fs.ensureDir(dirPath);
    } catch (error) {
        throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
}

/**
 * Safe JSON parse with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed object or default value
 */
export function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return defaultValue;
    }
}

/**
 * Get current timestamp in ISO format
 * @returns {string} ISO timestamp
 */
export function getCurrentTimestamp() {
    return new Date().toISOString();
}

/**
 * Check if running on Windows
 * @returns {boolean} True if Windows platform
 */
export function isWindows() {
    return process.platform === 'win32';
}

/**
 * Get safe command shell based on platform
 * @returns {{shell: string, args: string[]}} Shell configuration
 */
export function getShellConfig() {
    return isWindows() 
        ? { shell: 'cmd.exe', args: ['/c'] }
        : { shell: '/bin/bash', args: ['-c'] };
}

/**
 * Get project root directory from import.meta.url
 * @param {string} importMetaUrl - import.meta.url from calling module
 * @returns {string} Project root path
 */
export function getProjectRoot(importMetaUrl) {
    const __filename = fileURLToPath(importMetaUrl);
    const __dirname = dirname(__filename);
    
    // If called from a file in project root (like test-startup.js), return its directory
    if (importMetaUrl.includes('/new_remake/test-')) {
        return __dirname;
    }
    
    // For files in src/shared/, navigate up to project root
    if (importMetaUrl.includes('/src/shared/')) {
        return dirname(dirname(__dirname));
    }
    
    // For files in src/ subdirectories, navigate up to project root
    if (importMetaUrl.includes('/src/')) {
        return dirname(dirname(__dirname));
    }
    
    // Default fallback
    return __dirname;
}

export default {
    generateUUID,
    createHash,
    firstLine,
    validatePath,
    sanitizeForLog,
    isAllowedFileExtension,
    isBlockedFile,
    formatBytes,
    debounce,
    ensureDirectory,
    safeJsonParse,
    getCurrentTimestamp,
    isWindows,
    getShellConfig,
    getProjectRoot
};
