#!/usr/bin/env node

/**
 * Interactive Feedback UI Server
 * Spawned by MCP server to handle user feedback workflow
 * Based on hehe folder implementation
 */

import { spawn } from 'child_process'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs-extra'
import { createServer } from 'http'
import multer from 'multer'
import OpenAI from 'openai'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '..')

// Load environment variables
dotenv.config({ path: join(PROJECT_ROOT, '.env') })

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2)
  const parsed = {}

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    const value = args[i + 1]

    if (key && key.startsWith('--')) {
      parsed[key.substring(2).replace(/-/g, '_')] = value || true
    }
  }

  return parsed
}

/**
 * Feedback UI Server Class
 * Handles interactive feedback workflow
 */
class FeedbackUIServer {
  constructor(projectDirectory, summary, outputFile) {
    this.projectDirectory = projectDirectory
    this.summary = summary
    this.outputFile = outputFile
    this.feedbackResult = null
    this.feedbackWriteFailed = false
    this.serverClosing = false
    this.server = null
    this.wss = null
    this.port = 3800 + Math.floor(Math.random() * 100) // Random port
    this.commandProcess = null
    this.commandLogs = ''

    // Express app setup
    this.app = express()
    this.app.use(express.json())

    // Enable CORS for local development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })

    this.app.use(express.static(join(PROJECT_ROOT, 'public')))

    // Configure multer for file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
      },
    })

    // Initialize OpenAI client for speech-to-text
    this.openai = null
    this.initializeOpenAIClient()

    this.setupRoutes()
  }

  /**
   * Initialize OpenAI client with proper error handling
   */
  initializeOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.log('⚠️  OpenAI API key not found. Speech-to-Text feature disabled.')
      return
    }

    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      console.error('❌ Invalid OpenAI API key format')
      return
    }

    try {
      this.openai = new OpenAI({ apiKey })
      console.log('✅ OpenAI client initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI client:', error.message)
    }
  }

  /**
   * Setup Express routes (following hehe pattern)
   */
  setupRoutes() {
    // GET /api/config - Load config (hehe pattern)
    this.app.get('/api/config', (req, res) => {
      console.log('📊 Config request received')
      const responseData = {
        projectDirectory: this.projectDirectory,
        prompt: this.summary,
        config: {
          enableFeatures: true,
          theme: 'dark',
          command: '',
          autoExecute: false,
          commandSectionVisible: false,
        },
      }
      console.log('📤 Sending config response:', responseData)
      res.json(responseData)
    })

    // POST /api/config - Save config
    this.app.post('/api/config', async (req, res) => {
      try {
        console.log('💾 Config save request:', req.body)
        res.json({ success: true })
      } catch (error) {
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // POST /api/run-command - Run command
    this.app.post('/api/run-command', async (req, res) => {
      try {
        const { command } = req.body
        console.log('🚀 Running command:', command)

        if (this.commandProcess) {
          return res.status(400).json({
            success: false,
            error: 'A command is already running',
          })
        }

        this.commandLogs = ''
        this.commandProcess = spawn(command, [], {
          cwd: this.projectDirectory,
          shell: true,
        })

        this.commandProcess.stdout.on('data', data => {
          const output = data.toString()
          this.commandLogs += output
          this.broadcastToClients({ type: 'log', data: output })
        })

        this.commandProcess.stderr.on('data', data => {
          const output = data.toString()
          this.commandLogs += output
          this.broadcastToClients({ type: 'log', data: output })
        })

        this.commandProcess.on('close', code => {
          console.log(`Command exited with code ${code}`)
          this.commandProcess = null
          this.broadcastToClients({
            type: 'processStatus',
            data: { running: false, exitCode: code },
          })
        })

        res.json({ success: true })
        this.broadcastToClients({
          type: 'processStatus',
          data: { running: true },
        })
      } catch (error) {
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // POST /api/stop-command - Stop command
    this.app.post('/api/stop-command', (req, res) => {
      try {
        if (this.commandProcess) {
          this.commandProcess.kill()
          this.commandProcess = null
          res.json({ success: true })
        } else {
          res.json({ success: false, error: 'No command is running' })
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // GET /api/browse-files - Browse project files
    this.app.get('/api/browse-files', async (req, res) => {
      try {
        const { path: requestedPath = '' } = req.query
        const fullPath = join(this.projectDirectory, requestedPath)

        // Security check
        const resolvedPath = join(fullPath)
        const resolvedProjectDir = join(this.projectDirectory)

        if (!resolvedPath.startsWith(resolvedProjectDir)) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
          })
        }

        // Check if path exists
        if (!(await fs.pathExists(fullPath))) {
          return res.status(404).json({
            success: false,
            error: 'Path not found',
          })
        }

        // Read directory
        const items = await fs.readdir(fullPath, { withFileTypes: true })

        const fileItems = items
          .filter(item => !item.name.startsWith('.'))
          .map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: join(requestedPath, item.name).replace(/\\/g, '/'),
          }))
          .sort((a, b) => {
            if (a.type === 'directory' && b.type === 'file') return -1
            if (a.type === 'file' && b.type === 'directory') return 1
            return a.name.localeCompare(b.name)
          })

        res.json({
          success: true,
          currentPath: requestedPath,
          items: fileItems,
        })
      } catch (error) {
        console.error('Error browsing files:', error)
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // POST /api/speech-to-text - Convert audio to text
    this.app.post('/api/speech-to-text', this.upload.single('audio'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No audio file provided',
          })
        }

        if (!this.openai) {
          return res.status(500).json({
            success: false,
            error: 'OpenAI API key not configured',
          })
        }

        // Create temporary file
        const tempDir = join(PROJECT_ROOT, 'storage', 'temp')
        await fs.ensureDir(tempDir)

        const tempFilePath = join(tempDir, `audio_${Date.now()}.webm`)
        await fs.writeFile(tempFilePath, req.file.buffer)

        try {
          const transcription = await this.openai.audio.transcriptions.create({
            file: await fs.createReadStream(tempFilePath),
            model: 'whisper-1',
            language: process.env.WHISPER_LANGUAGE || 'vi',
          })

          await fs.remove(tempFilePath)

          res.json({
            success: true,
            text: transcription.text,
          })
        } catch (openaiError) {
          await fs.remove(tempFilePath).catch(() => {})
          console.error('OpenAI API error:', openaiError)
          res.status(500).json({
            success: false,
            error: 'Failed to transcribe audio: ' + openaiError.message,
          })
        }
      } catch (error) {
        console.error('Speech-to-text error:', error)
        res.status(500).json({
          success: false,
          error: 'Internal server error: ' + error.message,
        })
      }
    })

    // POST /api/submit-feedback - Submit user feedback (hehe pattern)
    this.app.post('/api/submit-feedback', async (req, res) => {
      try {
        console.log('📝 Feedback submission received:', req.body)
        const { feedback } = req.body

        if (!feedback || feedback.trim() === '') {
          console.log('❌ Empty feedback received')
          return res.status(400).json({
            success: false,
            error: 'Feedback is required',
          })
        }

        // Store feedback result
        this.feedbackResult = {
          command_logs: this.commandLogs || 'Interactive feedback session completed successfully',
          interactive_feedback: feedback.trim(),
          session_completed: true,
          timestamp: new Date().toISOString(),
        }

        console.log('💾 Saving feedback result:', this.feedbackResult)

        // Write to output file if specified
        if (this.outputFile) {
          let writeAttempts = 0
          const maxWriteAttempts = 3
          let lastError = null

          while (writeAttempts < maxWriteAttempts) {
            try {
              console.log(`📄 Writing to output file (attempt ${writeAttempts + 1}/${maxWriteAttempts}):`, this.outputFile)

              // Write the file with explicit encoding
              const jsonContent = JSON.stringify(this.feedbackResult, null, 2)
              await fs.writeFile(this.outputFile, jsonContent, { encoding: 'utf8', flag: 'w' })

              // Wait a bit to ensure OS flushes to disk
              await new Promise(resolve => setTimeout(resolve, 100))

              // CRITICAL: Verify file was written correctly by reading it back
              const exists = await fs.pathExists(this.outputFile)
              if (!exists) {
                throw new Error('Output file not found after write')
              }

              // Read the raw file content
              const fileContent = await fs.readFile(this.outputFile, 'utf8')
              if (!fileContent || fileContent.trim().length === 0) {
                throw new Error('Output file is empty')
              }

              // Verify the content is valid JSON by parsing it
              const writtenContent = JSON.parse(fileContent)
              if (!writtenContent || !writtenContent.interactive_feedback) {
                throw new Error('Output file content is invalid or missing feedback')
              }

              console.log('✅ Output file written and verified with valid content')
              console.log(`   File size: ${fileContent.length} bytes`)
              break // Success!
            } catch (writeError) {
              writeAttempts++
              lastError = writeError
              console.error(`❌ Error writing output file (attempt ${writeAttempts}/${maxWriteAttempts}):`, writeError.message)

              if (writeAttempts >= maxWriteAttempts) {
                // Mark this feedback as failed so process exits with error
                this.feedbackWriteFailed = true
                throw lastError
              }

              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }
        }

        console.log('✅ Feedback received and saved')

        // IMPORTANT: Send response with proper headers and wait for it to be sent
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')

        const responseData = { success: true }
        const responseJson = JSON.stringify(responseData)

        console.log('📤 Sending response to client:', responseJson)

        // Send response and wait for it to finish
        res.write(responseJson)
        res.end()

        console.log('✅ Response sent successfully')

        // DON'T close server immediately - let connection finish gracefully
        // Schedule close with enough time for response to reach client
        const closeDelay = 3000 // 3 seconds should be more than enough

        console.log(`⏰ Server will close in ${closeDelay}ms...`)

        setTimeout(() => {
          console.log('🛑 Auto-closing feedback server...')
          this.serverClosing = true

          // Close WebSocket connections first
          if (this.wss) {
            console.log('📡 Closing WebSocket connections...')
            this.wss.clients.forEach(client => {
              try {
                client.close()
              } catch (e) {
                // Ignore
              }
            })
            this.wss.close()
          }

          // Close HTTP server
          if (this.server) {
            console.log('🌐 Closing HTTP server...')
            this.server.close(() => {
              console.log('✅ Server closed gracefully')
              // Don't exit yet - let run() method handle the exit
            })

            // Force exit after 2 seconds if server doesn't close
            setTimeout(() => {
              console.log('⚠️  Force exit after timeout')
              process.exit(0)
            }, 2000)
          }
        }, closeDelay)
      } catch (error) {
        console.error('❌ Error processing feedback submission:', error)

        // Make sure we send error response
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to process feedback: ' + error.message,
          })
        }
      }
    })

    // Serve feedback UI page
    this.app.get('/', (req, res) => {
      res.sendFile(join(PROJECT_ROOT, 'public', 'index.html'))
    })
  }

  /**
   * Start the server
   */
  async start() {
    return new Promise(resolve => {
      this.server = createServer(this.app)

      // Setup WebSocket server
      this.wss = new WebSocketServer({ server: this.server })

      this.wss.on('connection', ws => {
        console.log('📱 Client connected to feedback UI')

        // Send initial data
        ws.send(
          JSON.stringify({
            type: 'session_info',
            data: {
              projectDirectory: this.projectDirectory,
              summary: this.summary,
              timestamp: new Date().toISOString(),
            },
          })
        )

        ws.on('close', () => {
          console.log('📱 Client disconnected from feedback UI')
        })
      })

      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`🌐 Feedback UI Server running at http://127.0.0.1:${this.port}`)
        resolve()
      })
    })
  }

  /**
   * Open browser to feedback UI
   */
  async openBrowser() {
    const url = `http://127.0.0.1:${this.port}`

    try {
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
      console.log(`🌐 Browser opened: ${url}`)
    } catch (error) {
      console.warn('Could not auto-open browser:', error.message)
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToClients(message) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          client.send(JSON.stringify(message))
        }
      })
    }
  }

  /**
   * Close server and cleanup
   */
  close() {
    console.log('🛑 Closing Feedback UI Server...')

    if (this.wss) {
      this.wss.close()
    }

    if (this.server) {
      this.server.close()
    }

    process.exit(0)
  }

  /**
   * Main workflow - start server, open browser, wait for feedback
   */
  async run() {
    await this.start()
    this.openBrowser()

    // Return Promise that resolves when feedbackResult is available AND server is closing
    return new Promise((resolve, reject) => {
      const checkResult = () => {
        if (this.feedbackWriteFailed) {
          reject(new Error('Failed to write feedback file'))
        } else if (this.feedbackResult && this.serverClosing) {
          // Wait a bit longer to ensure server has fully closed and file is flushed
          setTimeout(() => {
            resolve(this.feedbackResult)
          }, 500)
        } else {
          setTimeout(checkResult, 100)
        }
      }
      checkResult()
    })
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArguments()

  const projectDirectory = args.project_directory || process.cwd()
  const summary = args.summary || 'Please provide your feedback'
  const outputFile = args.output_file

  console.log('🚀 Starting Interactive Feedback UI Server...')
  console.log('📁 Project Directory:', projectDirectory)
  console.log('📝 Summary:', summary)
  console.log('📄 Output File:', outputFile || 'none')

  const server = new FeedbackUIServer(projectDirectory, summary, outputFile)

  // Handle process termination
  process.on('SIGINT', () => {
    server.close()
  })

  process.on('SIGTERM', () => {
    server.close()
  })

  // Run server
  server
    .run()
    .then(result => {
      console.log('✅ Feedback completed:', JSON.stringify(result, null, 2))
      // Exit process so MCP server knows we're done
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Error running Feedback UI Server:', error.message)
      process.exit(1)
    })
}
