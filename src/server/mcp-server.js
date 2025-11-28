/**
 * MCP Protocol Server - Secure Implementation
 * Handles Model Context Protocol communication with AI assistants
 */

import { EventEmitter } from 'events'
import fs from 'fs-extra'
import { join } from 'path'
import { getLogger } from '../shared/logger.js'
import { generateUUID } from '../shared/utils.js'
import { SecurityManager } from './security.js'

/**
 * Secure MCP Server Class
 * Implements MCP Protocol with security validation and audit logging
 */
export class MCPServer extends EventEmitter {
  constructor(projectRoot, config = {}) {
    super()

    this.projectRoot = projectRoot
    this.config = config
    this.initialized = false
    this.clientCapabilities = null
    this.sessionId = generateUUID()

    // Initialize security and logging
    this.security = new SecurityManager(projectRoot)
    this.logger = getLogger(projectRoot, config.logging)

    // Server capabilities
    this.serverCapabilities = {
      tools: {
        listChanged: false,
      },
    }

    // Server info
    this.serverInfo = {
      name: 'interactive-feedback-mcp-secure',
      version: '2.0.0',
    }

    // Available tools
    this.tools = {
      interactive_feedback: {
        name: 'interactive_feedback',
        description: 'Request secure interactive feedback for a given project directory and summary',
        inputSchema: {
          type: 'object',
          properties: {
            project_directory: {
              type: 'string',
              description: 'Path to the project directory',
            },
            summary: {
              type: 'string',
              description: 'Summary of the request or context',
            },
          },
          required: ['project_directory', 'summary'],
        },
      },
    }

    this.logger.info('MCP Server initialized', {
      sessionId: this.sessionId,
      projectRoot: this.projectRoot,
    })
  }

  /**
   * Start MCP Server and listen for requests
   */
  start() {
    // Setup stdin encoding
    process.stdin.setEncoding('utf8')

    // Listen for stdin data events
    process.stdin.on('data', async data => {
      await this.handleStdinData(data)
    })

    // Handle process termination
    this.setupProcessHandlers()

    this.logger.info('MCP Server listening on stdio', { sessionId: this.sessionId })
  }

  /**
   * Handle stdin data with proper error handling
   * @param {string} data - Raw stdin data
   */
  async handleStdinData(data) {
    try {
      const lines = data.trim().split('\n')

      for (const line of lines) {
        if (line.trim()) {
          await this.processRequest(line)
        }
      }
    } catch (error) {
      this.logger.error('Failed to process stdin data', {
        error: error.message,
        sessionId: this.sessionId,
      })

      // Send generic error response
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
          data: 'Invalid request format',
        },
      }
      this.sendResponse(errorResponse)
    }
  }

  /**
   * Process individual MCP request
   * @param {string} requestLine - JSON request line
   */
  async processRequest(requestLine) {
    let request

    try {
      request = JSON.parse(requestLine)
    } catch (error) {
      this.logger.error('JSON parse error', {
        error: error.message,
        requestLine: requestLine.substring(0, 100),
        sessionId: this.sessionId,
      })

      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
          data: 'Invalid JSON',
        },
      }
      this.sendResponse(errorResponse)
      return
    }

    // Log incoming request (without sensitive data)
    this.logger.debug('Received MCP request', {
      method: request.method,
      id: request.id,
      sessionId: this.sessionId,
    })

    // Audit log for security
    this.security.createAuditLogEntry('mcp_request', {
      method: request.method,
      id: request.id,
      sessionId: this.sessionId,
    })

    try {
      const response = await this.handleRequest(request)
      if (response) {
        this.sendResponse(response)
      }
    } catch (error) {
      this.logger.error('Request handling error', {
        error: error.message,
        method: request.method,
        id: request.id,
        sessionId: this.sessionId,
      })

      const errorResponse = {
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Request processing failed',
        },
      }
      this.sendResponse(errorResponse)
    }
  }

  /**
   * Handle MCP request with security validation
   * @param {Object} request - MCP request object
   * @returns {Object|null} MCP response object or null for notifications
   */
  async handleRequest(request) {
    // Validate JSON-RPC 2.0 format
    if (request.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Invalid JSON-RPC version',
        },
      }
    }

    switch (request.method) {
      case 'initialize':
        return await this.handleInitialize(request)

      case 'initialized':
        // Notification - no response needed
        this.handleInitialized(request)
        return null

      case 'tools/list':
        return this.handleToolsList(request)

      case 'tools/call':
        return await this.handleToolsCall(request)

      default:
        this.logger.warn('Unknown method requested', {
          method: request.method,
          sessionId: this.sessionId,
        })

        return {
          jsonrpc: '2.0',
          id: request.id || null,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Unknown method: ${request.method}`,
          },
        }
    }
  }

  /**
   * Handle initialize request with security validation
   * @param {Object} request - Initialize request
   * @returns {Object} Initialize response
   */
  async handleInitialize(request) {
    try {
      const { params } = request

      // Store client capabilities
      this.clientCapabilities = params?.capabilities || {}

      // Audit log initialization
      this.logger.audit('mcp_initialize', {
        clientInfo: params?.clientInfo,
        capabilities: Object.keys(this.clientCapabilities),
        sessionId: this.sessionId,
      })

      this.logger.info('MCP client initialized', {
        clientInfo: params?.clientInfo,
        sessionId: this.sessionId,
      })

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: this.serverCapabilities,
          serverInfo: this.serverInfo,
        },
      }
    } catch (error) {
      this.logger.error('Initialize request failed', {
        error: error.message,
        sessionId: this.sessionId,
      })

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Initialize failed',
        },
      }
    }
  }

  /**
   * Handle initialized notification
   * @param {Object} request - Initialized notification
   */
  handleInitialized(request) {
    this.initialized = true
    this.logger.info('MCP initialization completed', { sessionId: this.sessionId })

    this.logger.audit('mcp_initialized', {
      sessionId: this.sessionId,
    })
  }

  /**
   * Handle tools/list request
   * @param {Object} request - Tools list request
   * @returns {Object} Tools list response
   */
  handleToolsList(request) {
    try {
      const tools = Object.values(this.tools)

      this.logger.debug('Tools list requested', {
        toolCount: tools.length,
        sessionId: this.sessionId,
      })

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools,
        },
      }
    } catch (error) {
      this.logger.error('Tools list request failed', {
        error: error.message,
        sessionId: this.sessionId,
      })

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Tools list failed',
        },
      }
    }
  }

  /**
   * Handle tools/call request with security validation
   * @param {Object} request - Tools call request
   * @returns {Object} Tools call response
   */
  async handleToolsCall(request) {
    try {
      const { name: toolName, arguments: toolArgs } = request.params

      // Validate tool exists
      if (!this.tools[toolName]) {
        this.logger.warn('Unknown tool requested', {
          toolName,
          sessionId: this.sessionId,
        })

        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: 'Invalid params',
            data: `Unknown tool: ${toolName}`,
          },
        }
      }

      // Security validation of tool arguments
      const validationResult = this.security.validateMCPRequest(toolArgs)
      if (!validationResult.isValid) {
        this.logger.warn('Tool arguments validation failed', {
          toolName,
          error: validationResult.error,
          sessionId: this.sessionId,
        })

        this.logger.audit('tool_call_rejected', {
          toolName,
          reason: validationResult.error,
          sessionId: this.sessionId,
        })

        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: 'Invalid params',
            data: validationResult.error,
          },
        }
      }

      // Audit log tool call
      this.logger.audit('tool_call_started', {
        toolName,
        projectDirectory: validationResult.sanitizedData.project_directory,
        sessionId: this.sessionId,
      })

      // Execute tool with sanitized data
      const result = await this.executeTool(toolName, validationResult.sanitizedData)

      this.logger.info('Tool executed successfully', {
        toolName,
        sessionId: this.sessionId,
      })

      this.logger.audit('tool_call_completed', {
        toolName,
        success: true,
        sessionId: this.sessionId,
      })

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      }
    } catch (error) {
      this.logger.error('Tool execution failed', {
        error: error.message,
        toolName: request.params?.name,
        sessionId: this.sessionId,
      })

      this.logger.audit('tool_call_failed', {
        toolName: request.params?.name,
        error: error.message,
        sessionId: this.sessionId,
      })

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Tool execution failed',
        },
      }
    }
  }

  /**
   * Execute tool with given arguments
   * @param {string} toolName - Name of tool to execute
   * @param {Object} sanitizedArgs - Validated and sanitized arguments
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, sanitizedArgs) {
    switch (toolName) {
      case 'interactive_feedback':
        return await this.executeInteractiveFeedback(sanitizedArgs)
      default:
        throw new Error(`Tool not implemented: ${toolName}`)
    }
  }

  /**
   * Execute interactive feedback tool
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Feedback result
   */
  async executeInteractiveFeedback(args) {
    const { project_directory, summary } = args

    this.logger.info('Starting interactive feedback session', {
      projectDirectory: project_directory,
      sessionId: this.sessionId,
    })

    try {
      // Launch feedback UI and wait for user response
      const feedbackResult = await this.launchFeedbackUI(project_directory, summary)

      this.logger.info('Interactive feedback completed', {
        sessionId: this.sessionId,
        feedbackLength: feedbackResult.interactive_feedback?.length || 0,
      })

      // Log what we're about to return to AI
      const returnData = {
        command_logs: feedbackResult.command_logs || 'Interactive feedback completed',
        interactive_feedback: feedbackResult.interactive_feedback || 'No feedback provided',
        session_id: this.sessionId,
        security_status: 'All validations passed',
        session_completed: true,
        timestamp: feedbackResult.timestamp || new Date().toISOString(),
      }

      this.logger.info('Returning feedback to AI', {
        interactive_feedback: returnData.interactive_feedback.substring(0, 100) + '...',
        feedbackLength: returnData.interactive_feedback.length,
        sessionId: this.sessionId,
      })

      return returnData
    } catch (error) {
      this.logger.error('Failed to get interactive feedback', {
        error: error.message,
        sessionId: this.sessionId,
      })

      return {
        command_logs: `Error: ${error.message}`,
        interactive_feedback: 'Failed to get interactive feedback',
        session_id: this.sessionId,
        security_status: 'Error occurred',
        error: error.message,
      }
    }
  }

  /**
   * Launch feedback UI and wait for user response
   * @param {string} projectDirectory - Project directory path
   * @param {string} summary - Summary of the request
   * @returns {Promise<Object>} Feedback result from UI
   */
  async launchFeedbackUI(projectDirectory, summary) {
    const { tmpdir } = await import('os')
    const { randomUUID } = await import('crypto')

    // Create temporary file for result
    const tempDir = tmpdir()
    const uuid = randomUUID()
    const outputFile = join(tempDir, `feedback-${uuid}.json`)

    try {
      // Get path to feedback UI server
      const feedbackUIPath = join(this.projectRoot, 'src', 'feedback-ui-server.js')

      // Prepare arguments for feedback UI process
      const args = [feedbackUIPath, '--project-directory', projectDirectory, '--summary', summary, '--output-file', outputFile]

      this.logger.info('Spawning feedback UI process', {
        command: 'node',
        args: args.slice(1), // Don't log the script path for cleaner logs
        sessionId: this.sessionId,
      })

      // Spawn Feedback UI process
      const { spawn } = await import('child_process')
      const childProcess = spawn('node', args, {
        stdio: ['ignore', 'ignore', 'inherit'], // Show stderr for debugging
        detached: false,
      })

      // Wait for process completion
      await new Promise((resolve, reject) => {
        childProcess.on('close', code => {
          if (code === 0) {
            this.logger.info('Feedback UI process completed successfully', {
              sessionId: this.sessionId,
            })
            resolve()
          } else {
            this.logger.error('Feedback UI process failed', {
              exitCode: code,
              sessionId: this.sessionId,
            })
            reject(new Error(`Feedback UI process exited with code ${code}`))
          }
        })

        childProcess.on('error', error => {
          this.logger.error('Feedback UI process error', {
            error: error.message,
            sessionId: this.sessionId,
          })
          reject(error)
        })
      })

      // Read result from temp file with retry logic
      let result
      let attempts = 0
      const maxAttempts = 10

      while (attempts < maxAttempts) {
        try {
          // Wait a bit before first attempt to ensure file is flushed
          await new Promise(resolve => setTimeout(resolve, 500))

          // Check if file exists first
          const exists = await fs.pathExists(outputFile)
          if (!exists) {
            throw new Error('Output file does not exist yet')
          }

          // Try to read the file
          result = await fs.readJson(outputFile)

          // Verify the content is valid
          if (!result || !result.interactive_feedback) {
            throw new Error('Output file content is invalid or incomplete')
          }

          this.logger.info('Successfully read feedback file', {
            attempt: attempts + 1,
            sessionId: this.sessionId,
          })
          break
        } catch (error) {
          attempts++
          if (attempts >= maxAttempts) {
            // Log the file content for debugging
            try {
              const fileContent = await fs.readFile(outputFile, 'utf8')
              this.logger.error('Final file content on read failure', {
                content: fileContent,
                sessionId: this.sessionId,
              })
            } catch (readError) {
              this.logger.error('Could not read file content', {
                error: readError.message,
                sessionId: this.sessionId,
              })
            }
            throw new Error(`Failed to read feedback result after ${maxAttempts} attempts: ${outputFile}: ${error.message}`)
          }
          this.logger.debug('Retry reading feedback file', {
            attempt: attempts,
            error: error.message,
            sessionId: this.sessionId,
          })
          await new Promise(resolve => setTimeout(resolve, 800))
        }
      }

      this.logger.info('Feedback result loaded', {
        hasResult: !!result,
        feedbackLength: result.interactive_feedback?.length || 0,
        sessionId: this.sessionId,
      })

      // Cleanup temp file
      await fs.unlink(outputFile)

      return result
    } catch (error) {
      // Cleanup temp file if error occurs
      try {
        await fs.unlink(outputFile)
      } catch (cleanupError) {
        // Ignore cleanup errors
        this.logger.debug('Cleanup error ignored', {
          error: cleanupError.message,
          sessionId: this.sessionId,
        })
      }

      this.logger.error('Failed to launch feedback UI', {
        error: error.message,
        sessionId: this.sessionId,
      })

      throw error
    }
  }

  /**
   * Open browser (cross-platform)
   * @param {string} url - URL to open
   */
  async openBrowser(url) {
    try {
      const { spawn } = await import('child_process')
      let command, args

      switch (process.platform) {
        case 'darwin': // macOS
          command = 'open'
          args = [url]
          break
        case 'win32': // Windows
          command = 'cmd'
          args = ['/c', 'start', '""', url]
          break
        default: // Linux and others
          command = 'xdg-open'
          args = [url]
          break
      }

      spawn(command, args, { detached: true, stdio: 'ignore' })
      this.logger.info('Browser opened', { url, sessionId: this.sessionId })
    } catch (error) {
      throw new Error(`Could not open browser: ${error.message}`)
    }
  }

  /**
   * Get current feedback session data
   * @returns {Object|null} Current session data
   */
  getCurrentFeedbackSession() {
    return this.currentFeedbackSession || null
  }

  /**
   * Send response to stdout
   * @param {Object} response - Response object
   */
  sendResponse(response) {
    try {
      const responseText = JSON.stringify(response)
      process.stdout.write(responseText + '\n')

      this.logger.debug('Sent MCP response', {
        method: response.result ? 'success' : 'error',
        id: response.id,
        sessionId: this.sessionId,
      })
    } catch (error) {
      this.logger.error('Failed to send response', {
        error: error.message,
        sessionId: this.sessionId,
      })
    }
  }

  /**
   * Setup process event handlers
   */
  setupProcessHandlers() {
    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, shutting down gracefully', { sessionId: this.sessionId })
      this.shutdown()
    })

    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, shutting down gracefully', { sessionId: this.sessionId })
      this.shutdown()
    })
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    this.logger.info('MCP Server shutting down', { sessionId: this.sessionId })

    this.logger.audit('mcp_shutdown', {
      sessionId: this.sessionId,
      uptime: process.uptime(),
    })

    // Cleanup resources
    this.removeAllListeners()

    process.exit(0)
  }

  /**
   * Get server status
   * @returns {Object} Server status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      sessionId: this.sessionId,
      uptime: process.uptime(),
      toolsAvailable: Object.keys(this.tools).length,
      securityConfig: this.security.getSecurityConfig(),
    }
  }
}
