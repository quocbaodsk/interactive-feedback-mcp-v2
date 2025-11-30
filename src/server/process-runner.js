/**
 * Secure Process Runner for Interactive Feedback MCP
 * Handles safe command execution with security validation and monitoring
 */

import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import { getLogger } from '../shared/logger.js'
import { generateUUID, getCurrentTimestamp, getShellConfig } from '../shared/utils.js'
import { SecurityManager } from './security.js'

/**
 * Secure Process Runner Class
 * Executes commands with security validation and monitoring
 */
export class ProcessRunner extends EventEmitter {
  constructor(projectRoot, config = {}) {
    super()

    this.projectRoot = projectRoot
    this.config = {
      maxConcurrentProcesses: config.maxConcurrentProcesses || 3,
      defaultTimeoutMs: config.defaultTimeoutMs || 300000, // 5 minutes
      maxOutputSize: config.maxOutputSize || 1048576, // 1MB
      ...config,
    }

    // Initialize security and logging
    this.security = new SecurityManager(projectRoot)
    this.logger = getLogger(projectRoot)

    // Process management
    this.activeProcesses = new Map()
    this.processCounter = 0

    this.logger.info('ProcessRunner initialized', {
      maxConcurrentProcesses: this.config.maxConcurrentProcesses,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
    })
  }

  /**
   * Execute command with security validation
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeCommand(command, options = {}) {
    const executionId = generateUUID()
    const startTime = Date.now()

    try {
      // Security validation
      const validationResult = this.security.validateCommand(command)
      if (!validationResult.isValid) {
        this.logger.warn('Command validation failed', {
          command: command.substring(0, 100),
          error: validationResult.error,
          executionId,
        })

        this.logger.audit('command_rejected', {
          command: command.substring(0, 100),
          reason: validationResult.error,
          executionId,
        })

        throw new Error(`Security validation failed: ${validationResult.error}`)
      }

      // Check concurrent process limit
      if (this.activeProcesses.size >= this.config.maxConcurrentProcesses) {
        throw new Error(`Maximum concurrent processes limit reached (${this.config.maxConcurrentProcesses})`)
      }

      // Setup execution context
      const context = {
        executionId,
        command: validationResult.sanitizedCommand,
        originalCommand: validationResult.originalCommand,
        startTime,
        workingDirectory: options.cwd || this.projectRoot,
        timeoutMs: options.timeout || this.config.defaultTimeoutMs,
      }

      this.logger.info('Starting command execution', {
        command: validationResult.sanitizedCommand,
        executionId,
        workingDirectory: context.workingDirectory,
      })

      this.logger.audit('command_started', {
        command: validationResult.sanitizedCommand,
        executionId,
        workingDirectory: context.workingDirectory,
      })

      // Execute command
      const result = await this.runProcess(context)

      const duration = Date.now() - startTime
      this.logger.info('Command completed successfully', {
        executionId,
        duration,
        outputSize: result.output.length,
      })

      this.logger.audit('command_completed', {
        executionId,
        duration,
        success: true,
        exitCode: result.exitCode,
      })

      return {
        success: true,
        executionId,
        command: validationResult.sanitizedCommand,
        output: result.output,
        exitCode: result.exitCode,
        duration,
        timestamp: getCurrentTimestamp(),
      }
    } catch (error) {
      const duration = Date.now() - startTime

      this.logger.error('Command execution failed', {
        executionId,
        error: error.message,
        duration,
      })

      this.logger.audit('command_failed', {
        executionId,
        error: error.message,
        duration,
      })

      return {
        success: false,
        executionId,
        command: command.substring(0, 100),
        error: error.message,
        duration,
        timestamp: getCurrentTimestamp(),
      }
    }
  }

  /**
   * Run process with monitoring and limits
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Process result
   */
  async runProcess(context) {
    return new Promise((resolve, reject) => {
      const { executionId, command, workingDirectory, timeoutMs } = context

      // Get platform-specific shell configuration
      const shellConfig = getShellConfig()

      // Spawn process
      const childProcess = spawn(shellConfig.shell, [...shellConfig.args, command], {
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.getSecureEnvironment(),
      })

      // Track active process
      const processInfo = {
        process: childProcess,
        startTime: Date.now(),
        command,
        executionId,
      }

      this.activeProcesses.set(executionId, processInfo)

      // Setup output collection
      let stdout = ''
      let stderr = ''
      let outputSize = 0
      let isTimedOut = false

      // Setup timeout
      const timeout = setTimeout(() => {
        isTimedOut = true
        this.killProcess(executionId, 'TIMEOUT')
        reject(new Error(`Command execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      // Handle stdout
      childProcess.stdout.on('data', data => {
        const chunk = data.toString()
        outputSize += chunk.length

        if (outputSize > this.config.maxOutputSize) {
          this.killProcess(executionId, 'OUTPUT_LIMIT')
          reject(new Error(`Output size limit exceeded (${this.config.maxOutputSize} bytes)`))
          return
        }

        stdout += chunk
        this.emit('output', { executionId, type: 'stdout', data: chunk })
      })

      // Handle stderr
      childProcess.stderr.on('data', data => {
        const chunk = data.toString()
        outputSize += chunk.length

        if (outputSize > this.config.maxOutputSize) {
          this.killProcess(executionId, 'OUTPUT_LIMIT')
          reject(new Error(`Output size limit exceeded (${this.config.maxOutputSize} bytes)`))
          return
        }

        stderr += chunk
        this.emit('output', { executionId, type: 'stderr', data: chunk })
      })

      // Handle process close
      childProcess.on('close', exitCode => {
        clearTimeout(timeout)
        this.activeProcesses.delete(executionId)

        if (!isTimedOut) {
          const output = stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '')
          resolve({
            output,
            exitCode: exitCode || 0,
            stdout,
            stderr,
          })
        }
      })

      // Handle process error
      childProcess.on('error', error => {
        clearTimeout(timeout)
        this.activeProcesses.delete(executionId)

        if (!isTimedOut) {
          reject(new Error(`Process error: ${error.message}`))
        }
      })

      // Handle process spawn error
      childProcess.on('spawn', () => {
        this.logger.debug('Process spawned successfully', {
          executionId,
          pid: childProcess.pid,
        })
      })
    })
  }

  /**
   * Kill process by execution ID
   * @param {string} executionId - Execution ID
   * @param {string} reason - Reason for killing
   */
  killProcess(executionId, reason = 'MANUAL') {
    const processInfo = this.activeProcesses.get(executionId)
    if (!processInfo) {
      this.logger.warn('Attempt to kill non-existent process', { executionId })
      return false
    }

    try {
      const { process: childProcess, command } = processInfo

      this.logger.info('Killing process', {
        executionId,
        reason,
        pid: childProcess.pid,
      })

      this.logger.audit('process_killed', {
        executionId,
        reason,
        pid: childProcess.pid,
      })

      // Kill process tree
      this.killProcessTree(childProcess.pid)

      // Remove from active processes
      this.activeProcesses.delete(executionId)

      return true
    } catch (error) {
      this.logger.error('Failed to kill process', {
        executionId,
        error: error.message,
      })
      return false
    }
  }

  /**
   * Kill process tree (cross-platform)
   * @param {number} pid - Process ID
   */
  killProcessTree(pid) {
    try {
      if (process.platform === 'win32') {
        // Windows: use taskkill
        spawn('taskkill', ['/pid', pid.toString(), '/t', '/f'], {
          stdio: 'ignore',
          detached: true,
        })
      } else {
        // Unix: kill process group
        try {
          process.kill(-pid, 'SIGTERM')
          // If SIGTERM doesn't work, use SIGKILL after delay
          setTimeout(() => {
            try {
              process.kill(-pid, 'SIGKILL')
            } catch (e) {
              // Process might already be dead
            }
          }, 5000)
        } catch (e) {
          // Fallback: kill process directly
          process.kill(pid, 'SIGKILL')
        }
      }
    } catch (error) {
      this.logger.error('Failed to kill process tree', {
        pid,
        error: error.message,
      })
    }
  }

  /**
   * Get secure environment variables for child processes
   * @returns {Object} Environment variables
   */
  getSecureEnvironment() {
    // Start with minimal environment
    const secureEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      SHELL: process.env.SHELL,
      TERM: process.env.TERM || 'xterm',
      LANG: process.env.LANG || 'en_US.UTF-8',
    }

    // Add platform-specific variables
    if (process.platform === 'win32') {
      secureEnv.USERPROFILE = process.env.USERPROFILE
      secureEnv.APPDATA = process.env.APPDATA
      secureEnv.COMSPEC = process.env.COMSPEC
      secureEnv.SYSTEMROOT = process.env.SYSTEMROOT
    }

    return secureEnv
  }

  /**
   * Get all active processes
   * @returns {Array} Active processes info
   */
  getActiveProcesses() {
    return Array.from(this.activeProcesses.values()).map(info => ({
      executionId: info.executionId,
      command: info.command,
      startTime: info.startTime,
      pid: info.process.pid,
      duration: Date.now() - info.startTime,
    }))
  }

  /**
   * Kill all active processes
   * @param {string} reason - Reason for killing all processes
   */
  killAllProcesses(reason = 'SHUTDOWN') {
    const activeIds = Array.from(this.activeProcesses.keys())

    this.logger.info('Killing all active processes', {
      count: activeIds.length,
      reason,
    })

    for (const executionId of activeIds) {
      this.killProcess(executionId, reason)
    }
  }

  /**
   * Get execution statistics
   * @returns {Object} Execution statistics
   */
  getStatistics() {
    return {
      activeProcesses: this.activeProcesses.size,
      maxConcurrentProcesses: this.config.maxConcurrentProcesses,
      totalExecutions: this.processCounter,
      uptime: process.uptime(),
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.logger.info('ProcessRunner cleanup started')

    // Kill all active processes
    this.killAllProcesses('CLEANUP')

    // Remove all listeners
    this.removeAllListeners()

    this.logger.info('ProcessRunner cleanup completed')
  }
}
