/**
 * Logging System for Interactive Feedback MCP
 * Handles application logs, audit logs, and security events
 */

import fs from 'fs-extra'
import path from 'path'
import { ensureDirectory, getCurrentTimestamp } from './utils.js'

/**
 * Logger Class with rotation and security audit capabilities
 */
export class Logger {
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot
    this.config = {
      maxLogFileSize: config.maxLogFileSize || 10485760, // 10MB
      maxLogFiles: config.maxLogFiles || 5,
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,
      enableAudit: config.enableAudit !== false,
      logLevel: config.logLevel || 'info',
    }

    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    }

    this.currentLevel = this.logLevels[this.config.logLevel] || 2
    this.setupLogDirectories()
  }

  /**
   * Setup log directories
   */
  async setupLogDirectories() {
    try {
      this.logsDir = path.join(this.projectRoot, 'storage', 'logs')
      await ensureDirectory(this.logsDir)

      this.appLogPath = path.join(this.logsDir, 'app.log')
      this.auditLogPath = path.join(this.logsDir, 'audit.log')
      this.errorLogPath = path.join(this.logsDir, 'error.log')
    } catch (error) {
      console.error('Failed to setup log directories:', error.message)
    }
  }

  /**
   * Log message with specified level
   * @param {string} level - Log level (error, warn, info, debug)
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    if (this.logLevels[level] > this.currentLevel) {
      return // Skip if below current log level
    }

    const logEntry = {
      timestamp: getCurrentTimestamp(),
      level: level.toUpperCase(),
      message: this.sanitizeLogMessage(message),
      meta: this.sanitizeLogMeta(meta),
      pid: process.pid,
    }

    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(logEntry)
    }

    // File output - only for errors
    if (this.config.enableFile && level === 'error') {
      this.logToFile(logEntry)
    }
  }

  /**
   * Info level logging
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.log('info', message, meta)
  }

  /**
   * Warning level logging
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta)
  }

  /**
   * Error level logging
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    this.log('error', message, meta)

    // Also log to dedicated error log
    if (this.config.enableFile) {
      this.logToErrorFile({
        timestamp: getCurrentTimestamp(),
        message: this.sanitizeLogMessage(message),
        meta: this.sanitizeLogMeta(meta),
        stack: meta.error?.stack || meta.stack,
      })
    }
  }

  /**
   * Debug level logging
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta)
  }

  /**
   * Security audit logging
   * @param {string} action - Security action
   * @param {Object} details - Action details
   */
  audit(action, details = {}) {
    if (!this.config.enableAudit) return

    const auditEntry = {
      timestamp: getCurrentTimestamp(),
      type: 'AUDIT',
      action: this.sanitizeLogMessage(action),
      details: this.sanitizeLogMeta(details),
      session: details.session || 'unknown',
      remoteAddr: details.remoteAddr || 'localhost',
      userAgent: details.userAgent ? this.sanitizeUserAgent(details.userAgent) : 'unknown',
    }

    // Skip console output for audit when in MCP mode to prevent JSON parsing errors
    if (this.config.enableConsole && this.currentLevel >= 3 && !process.env.MCP_LOG_LEVEL) {
      console.log(`🔍 [AUDIT] ${auditEntry.action}`, auditEntry.details)
    }

    // File output for audit
    if (this.config.enableFile) {
      this.logToAuditFile(auditEntry)
    }
  }

  /**
   * Log to console with formatting
   * @param {Object} logEntry - Log entry object
   */
  logToConsole(logEntry) {
    // Skip console logging entirely when in MCP mode to prevent JSON parsing errors
    if (process.env.MCP_LOG_LEVEL || !this.config.enableConsole) {
      return
    }

    const { timestamp, level, message, meta } = logEntry
    const timeStr = new Date(timestamp).toLocaleTimeString()

    // Skip color coding when in MCP mode
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m', // Yellow
      INFO: '\x1b[36m', // Cyan
      DEBUG: '\x1b[37m', // White
    }

    const reset = '\x1b[0m'
    const color = colors[level] || reset

    let output = `${color}[${timeStr}] ${level}${reset} ${message}`

    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`
    }

    console.log(output)
  }

  /**
   * Log to application log file
   * @param {Object} logEntry - Log entry object
   */
  async logToFile(logEntry) {
    try {
      if (!this.appLogPath) return

      const logLine = JSON.stringify(logEntry) + '\n'

      // Check file size and rotate if necessary
      await this.rotateLogIfNeeded(this.appLogPath)

      await fs.appendFile(this.appLogPath, logLine)
    } catch (error) {
      console.error('Failed to write to log file:', error.message)
    }
  }

  /**
   * Log to error log file
   * @param {Object} errorEntry - Error entry object
   */
  async logToErrorFile(errorEntry) {
    try {
      if (!this.errorLogPath) return

      const logLine = JSON.stringify(errorEntry) + '\n'

      await this.rotateLogIfNeeded(this.errorLogPath)
      await fs.appendFile(this.errorLogPath, logLine)
    } catch (error) {
      console.error('Failed to write to error log file:', error.message)
    }
  }

  /**
   * Log to audit log file
   * @param {Object} auditEntry - Audit entry object
   */
  async logToAuditFile(auditEntry) {
    try {
      if (!this.auditLogPath) return

      const logLine = JSON.stringify(auditEntry) + '\n'

      await this.rotateLogIfNeeded(this.auditLogPath)
      await fs.appendFile(this.auditLogPath, logLine)
    } catch (error) {
      console.error('Failed to write to audit log file:', error.message)
    }
  }

  /**
   * Rotate log file if it exceeds size limit
   * @param {string} logFilePath - Path to log file
   */
  async rotateLogIfNeeded(logFilePath) {
    try {
      if (!(await fs.pathExists(logFilePath))) return

      const stats = await fs.stat(logFilePath)
      if (stats.size < this.config.maxLogFileSize) return

      // Rotate log files
      const baseName = path.basename(logFilePath, path.extname(logFilePath))
      const extension = path.extname(logFilePath)
      const dir = path.dirname(logFilePath)

      // Remove oldest log file if it exists
      const oldestLog = path.join(dir, `${baseName}.${this.config.maxLogFiles}${extension}`)
      if (await fs.pathExists(oldestLog)) {
        await fs.unlink(oldestLog)
      }

      // Shift log files
      for (let i = this.config.maxLogFiles - 1; i >= 1; i--) {
        const currentLog = path.join(dir, `${baseName}.${i}${extension}`)
        const nextLog = path.join(dir, `${baseName}.${i + 1}${extension}`)

        if (await fs.pathExists(currentLog)) {
          await fs.move(currentLog, nextLog)
        }
      }

      // Move current log to .1
      const rotatedLog = path.join(dir, `${baseName}.1${extension}`)
      await fs.move(logFilePath, rotatedLog)
    } catch (error) {
      console.error('Failed to rotate log file:', error.message)
    }
  }

  /**
   * Sanitize log message to prevent log injection
   * @param {string} message - Message to sanitize
   * @returns {string} Sanitized message
   */
  sanitizeLogMessage(message) {
    if (!message || typeof message !== 'string') {
      return String(message || '')
    }

    return message
      .replace(/[\r\n]/g, ' ') // Replace line breaks with spaces
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 1000) // Limit message length
  }

  /**
   * Sanitize log metadata
   * @param {Object} meta - Metadata to sanitize
   * @returns {Object} Sanitized metadata
   */
  sanitizeLogMeta(meta) {
    if (!meta || typeof meta !== 'object') {
      return {}
    }

    const sanitized = {}

    for (const [key, value] of Object.entries(meta)) {
      if (key === 'password' || key === 'token' || key === 'secret' || key === 'apiKey') {
        sanitized[key] = '***'
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeLogMessage(value)
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = JSON.stringify(value).substring(0, 500)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  /**
   * Sanitize user agent string
   * @param {string} userAgent - User agent string
   * @returns {string} Sanitized user agent
   */
  sanitizeUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
      return 'unknown'
    }

    return userAgent.replace(/[\r\n]/g, '').substring(0, 200)
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  async getLogStats() {
    try {
      const stats = {}

      if (await fs.pathExists(this.appLogPath)) {
        const appStats = await fs.stat(this.appLogPath)
        stats.appLog = {
          size: appStats.size,
          modified: appStats.mtime,
        }
      }

      if (await fs.pathExists(this.auditLogPath)) {
        const auditStats = await fs.stat(this.auditLogPath)
        stats.auditLog = {
          size: auditStats.size,
          modified: auditStats.mtime,
        }
      }

      if (await fs.pathExists(this.errorLogPath)) {
        const errorStats = await fs.stat(this.errorLogPath)
        stats.errorLog = {
          size: errorStats.size,
          modified: errorStats.mtime,
        }
      }

      return stats
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Clean old temporary files and expired logs
   */
  async cleanup() {
    try {
      // This would implement cleanup logic for expired logs
      this.info('Logger cleanup completed')
    } catch (error) {
      this.error('Logger cleanup failed', { error: error.message })
    }
  }
}

// Create default logger instance
let defaultLogger = null

/**
 * Get or create default logger instance
 * @param {string} projectRoot - Project root path
 * @param {Object} config - Logger configuration
 * @returns {Logger} Logger instance
 */
export function getLogger(projectRoot = process.env.PROJECT_ROOT, config = {}) {
  if (!defaultLogger && projectRoot) {
    defaultLogger = new Logger(projectRoot, config)
  }
  return defaultLogger
}

export default { Logger, getLogger }
