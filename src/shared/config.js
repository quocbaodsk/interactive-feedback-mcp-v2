/**
 * Local Configuration Management for Interactive Feedback MCP
 * Handles project-specific configurations with local storage
 */

import { createHash } from 'crypto'
import fs from 'fs-extra'
import { basename, join } from 'path'
import { getLogger } from './logger.js'
import { ensureDirectory, getCurrentTimestamp } from './utils.js'

/**
 * Configuration Manager Class
 * Manages local configuration storage and retrieval
 */
export class ConfigManager {
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot
    this.logger = getLogger(projectRoot)

    // Configuration paths
    this.storageDir = join(projectRoot, 'storage', 'configs')
    this.defaultConfigPath = join(projectRoot, 'config', 'default-config.json')
    this.migratedConfigsDir = join(this.storageDir, 'migrated')

    // Configuration cache
    this.configCache = new Map()
    this.defaultConfig = null

    // Initialize storage
    this.initializeStorage()

    this.logger.info('ConfigManager initialized', {
      storageDir: this.storageDir,
    })
  }

  /**
   * Initialize configuration storage directories
   */
  async initializeStorage() {
    try {
      await ensureDirectory(this.storageDir)
      await ensureDirectory(this.migratedConfigsDir)

      // Load default configuration
      if (await fs.pathExists(this.defaultConfigPath)) {
        this.defaultConfig = await fs.readJson(this.defaultConfigPath)
      } else {
        this.logger.warn('Default configuration file not found', {
          path: this.defaultConfigPath,
        })
        this.defaultConfig = this.getHardcodedDefaults()
      }
    } catch (error) {
      this.logger.error('Failed to initialize configuration storage', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Get hardcoded default configuration as fallback
   * @returns {Object} Default configuration
   */
  getHardcodedDefaults() {
    return {
      server: {
        port: 3636,
        host: '127.0.0.1',
        maxConnections: 10,
        requestTimeoutMs: 30000,
      },
      security: {
        enableRateLimit: true,
        rateLimitWindowMs: 900000,
        rateLimitMaxRequests: 100,
        enableCSRFProtection: true,
        enableHelmet: true,
      },
      files: {
        allowedExtensions: ['.js', '.mjs', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.css', '.ts', '.jsx', '.tsx', '.vue', '.py', '.sh', '.bat', '.cmd', '.ps1', '.gitignore', '.env.example'],
        blockedFiles: ['.env', '.env.local', '.env.production', '.env.development', 'id_rsa', 'id_ed25519', '*.pem', '*.key', '*.crt', '*.p12'],
        maxFileSize: 1048576,
        maxFilesPerRequest: 50,
      },
      commands: {
        enableExecution: true,
        maxConcurrentCommands: 3,
        defaultTimeoutMs: 300000,
        maxOutputSize: 1048576,
      },
      storage: {
        tempFileExpiryHours: 1,
        maxLogFileSize: 10485760,
        maxLogFiles: 5,
        configBackupCount: 3,
      },
      ui: {
        theme: 'dark',
        autoFocus: true,
        commandHistorySize: 50,
        enableNotifications: true,
      },
    }
  }

  /**
   * Generate unique config file path for project
   * @param {string} projectDirectory - Project directory path
   * @returns {string} Config file path
   */
  getProjectConfigPath(projectDirectory) {
    const projectHash = createHash('md5').update(projectDirectory).digest('hex').substring(0, 8)

    const projectName = basename(projectDirectory) || 'unknown'
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_')

    return join(this.storageDir, `${safeProjectName}_${projectHash}.json`)
  }

  /**
   * Load configuration for project
   * @param {string} projectDirectory - Project directory path
   * @returns {Promise<Object>} Project configuration
   */
  async loadProjectConfig(projectDirectory) {
    try {
      const configPath = this.getProjectConfigPath(projectDirectory)
      const cacheKey = configPath

      // Check cache first
      if (this.configCache.has(cacheKey)) {
        const cached = this.configCache.get(cacheKey)
        // Return cache if not expired (5 minutes)
        if (Date.now() - cached.timestamp < 300000) {
          return cached.config
        }
      }

      let projectConfig = {}

      if (await fs.pathExists(configPath)) {
        projectConfig = await fs.readJson(configPath)

        this.logger.debug('Project configuration loaded', {
          projectDirectory,
          configPath,
        })
      } else {
        this.logger.debug('No existing project configuration found', {
          projectDirectory,
          configPath,
        })
      }

      // Merge with defaults
      const mergedConfig = this.mergeConfigurations(this.getDefaultConfig(), projectConfig)

      // Cache the result
      this.configCache.set(cacheKey, {
        config: mergedConfig,
        timestamp: Date.now(),
      })

      return mergedConfig
    } catch (error) {
      this.logger.error('Failed to load project configuration', {
        projectDirectory,
        error: error.message,
      })

      // Return default configuration as fallback
      return this.getDefaultConfig()
    }
  }

  /**
   * Save project configuration
   * @param {string} projectDirectory - Project directory path
   * @param {Object} config - Configuration to save
   * @returns {Promise<boolean>} Success status
   */
  async saveProjectConfig(projectDirectory, config) {
    try {
      const configPath = this.getProjectConfigPath(projectDirectory)

      // Validate configuration
      const validatedConfig = this.validateConfiguration(config)

      // Add metadata
      const configWithMeta = {
        ...validatedConfig,
        _meta: {
          projectDirectory,
          createdAt: validatedConfig._meta?.createdAt || getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
          version: '2.0.0',
        },
      }

      // Create backup if config exists
      await this.createConfigBackup(configPath)

      // Save configuration
      await fs.writeJson(configPath, configWithMeta, { spaces: 2 })

      // Update cache
      const cacheKey = configPath
      this.configCache.set(cacheKey, {
        config: configWithMeta,
        timestamp: Date.now(),
      })

      this.logger.info('Project configuration saved', {
        projectDirectory,
        configPath,
      })

      this.logger.audit('config_saved', {
        projectDirectory,
        configPath,
      })

      return true
    } catch (error) {
      this.logger.error('Failed to save project configuration', {
        projectDirectory,
        error: error.message,
      })

      return false
    }
  }

  /**
   * Delete project configuration
   * @param {string} projectDirectory - Project directory path
   * @returns {Promise<boolean>} Success status
   */
  async deleteProjectConfig(projectDirectory) {
    try {
      const configPath = this.getProjectConfigPath(projectDirectory)

      if (await fs.pathExists(configPath)) {
        // Create backup before deletion
        await this.createConfigBackup(configPath, 'deleted')

        // Delete configuration file
        await fs.unlink(configPath)

        // Remove from cache
        this.configCache.delete(configPath)

        this.logger.info('Project configuration deleted', {
          projectDirectory,
          configPath,
        })

        this.logger.audit('config_deleted', {
          projectDirectory,
          configPath,
        })

        return true
      } else {
        this.logger.warn('Attempted to delete non-existent configuration', {
          projectDirectory,
          configPath,
        })
        return false
      }
    } catch (error) {
      this.logger.error('Failed to delete project configuration', {
        projectDirectory,
        error: error.message,
      })

      return false
    }
  }

  /**
   * Create configuration backup
   * @param {string} configPath - Configuration file path
   * @param {string} suffix - Backup suffix (default: 'backup')
   */
  async createConfigBackup(configPath, suffix = 'backup') {
    try {
      if (!(await fs.pathExists(configPath))) {
        return
      }

      const backupDir = join(this.storageDir, 'backups')
      await ensureDirectory(backupDir)

      const fileName = basename(configPath, '.json')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `${fileName}_${suffix}_${timestamp}.json`
      const backupPath = join(backupDir, backupFileName)

      await fs.copy(configPath, backupPath)

      this.logger.debug('Configuration backup created', {
        originalPath: configPath,
        backupPath,
      })

      // Clean old backups
      await this.cleanOldBackups(backupDir, fileName)
    } catch (error) {
      this.logger.warn('Failed to create configuration backup', {
        configPath,
        error: error.message,
      })
    }
  }

  /**
   * Clean old configuration backups
   * @param {string} backupDir - Backup directory
   * @param {string} fileName - Base file name
   */
  async cleanOldBackups(backupDir, fileName) {
    try {
      const files = await fs.readdir(backupDir)
      const backupFiles = files
        .filter(file => file.startsWith(fileName) && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: join(backupDir, file),
          stats: null,
        }))

      // Get file stats
      for (const file of backupFiles) {
        try {
          file.stats = await fs.stat(file.path)
        } catch (error) {
          // Skip files that can't be read
        }
      }

      // Sort by modification time (newest first)
      backupFiles
        .filter(file => file.stats)
        .sort((a, b) => b.stats.mtime - a.stats.mtime)
        .slice(this.defaultConfig.storage?.configBackupCount || 3) // Keep only N newest
        .forEach(async file => {
          try {
            await fs.unlink(file.path)
            this.logger.debug('Old backup deleted', { backupPath: file.path })
          } catch (error) {
            this.logger.warn('Failed to delete old backup', {
              backupPath: file.path,
              error: error.message,
            })
          }
        })
    } catch (error) {
      this.logger.warn('Failed to clean old backups', {
        backupDir,
        error: error.message,
      })
    }
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validated configuration
   */
  validateConfiguration(config) {
    const validated = {}

    // Validate server config
    if (config.server) {
      validated.server = {
        port: this.validatePort(config.server.port) || 3636,
        host: this.validateHost(config.server.host) || '127.0.0.1',
        maxConnections: this.validateNumber(config.server.maxConnections, 1, 100) || 10,
        requestTimeoutMs: this.validateNumber(config.server.requestTimeoutMs, 1000, 300000) || 30000,
      }
    }

    // Validate commands config
    if (config.commands) {
      validated.commands = {
        enableExecution: Boolean(config.commands.enableExecution),
        maxConcurrentCommands: this.validateNumber(config.commands.maxConcurrentCommands, 1, 10) || 3,
        defaultTimeoutMs: this.validateNumber(config.commands.defaultTimeoutMs, 1000, 600000) || 300000,
        maxOutputSize: this.validateNumber(config.commands.maxOutputSize, 1024, 10485760) || 1048576,
      }
    }

    // Validate UI config
    if (config.ui) {
      validated.ui = {
        theme: ['dark', 'light'].includes(config.ui.theme) ? config.ui.theme : 'dark',
        autoFocus: Boolean(config.ui.autoFocus),
        commandHistorySize: this.validateNumber(config.ui.commandHistorySize, 10, 200) || 50,
        enableNotifications: Boolean(config.ui.enableNotifications),
      }
    }

    // Copy other properties (with basic sanitization)
    for (const [key, value] of Object.entries(config)) {
      if (!validated[key] && typeof value === 'object' && value !== null) {
        validated[key] = JSON.parse(JSON.stringify(value)) // Deep clone
      } else if (!validated[key] && typeof value !== 'function') {
        validated[key] = value
      }
    }

    return validated
  }

  /**
   * Validate port number
   * @param {*} port - Port to validate
   * @returns {number|null} Valid port or null
   */
  validatePort(port) {
    const num = parseInt(port)
    return num >= 1024 && num <= 65535 ? num : null
  }

  /**
   * Validate host string
   * @param {*} host - Host to validate
   * @returns {string|null} Valid host or null
   */
  validateHost(host) {
    if (typeof host !== 'string') return null

    // Allow localhost, 127.0.0.1, or 0.0.0.0
    const validHosts = ['localhost', '127.0.0.1', '0.0.0.0']
    return validHosts.includes(host) ? host : null
  }

  /**
   * Validate number within range
   * @param {*} value - Value to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number|null} Valid number or null
   */
  validateNumber(value, min, max) {
    const num = parseInt(value)
    return !isNaN(num) && num >= min && num <= max ? num : null
  }

  /**
   * Merge configurations with deep merge
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigurations(defaultConfig, userConfig) {
    const merged = { ...defaultConfig }

    for (const [key, value] of Object.entries(userConfig)) {
      if (key === '_meta') {
        merged[key] = value
        continue
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = {
          ...(merged[key] || {}),
          ...value,
        }
      } else {
        merged[key] = value
      }
    }

    return merged
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return this.defaultConfig || this.getHardcodedDefaults()
  }

  /**
   * List all project configurations
   * @returns {Promise<Array>} List of project configurations
   */
  async listProjectConfigs() {
    try {
      const files = await fs.readdir(this.storageDir)
      const configFiles = files.filter(file => file.endsWith('.json') && !file.includes('backup'))

      const configs = []

      for (const file of configFiles) {
        try {
          const configPath = join(this.storageDir, file)
          const config = await fs.readJson(configPath)

          configs.push({
            fileName: file,
            projectDirectory: config._meta?.projectDirectory || 'unknown',
            createdAt: config._meta?.createdAt,
            updatedAt: config._meta?.updatedAt,
            version: config._meta?.version,
          })
        } catch (error) {
          this.logger.warn('Failed to read config file', {
            file,
            error: error.message,
          })
        }
      }

      return configs
    } catch (error) {
      this.logger.error('Failed to list project configurations', {
        error: error.message,
      })

      return []
    }
  }

  /**
   * Get configuration statistics
   * @returns {Object} Configuration statistics
   */
  getStatistics() {
    return {
      cacheSize: this.configCache.size,
      storageDir: this.storageDir,
      hasDefaultConfig: Boolean(this.defaultConfig),
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.configCache.clear()
    this.logger.debug('Configuration cache cleared')
  }
}
