/**
 * Secure Web Server for Interactive Feedback MCP
 * Provides HTTP API and WebSocket interface with security controls
 */

import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { readFileSync } from 'fs'
import helmet from 'helmet'
import { createServer } from 'http'
import { join } from 'path'
import { WebSocketServer } from 'ws'

import { SecurityManager } from '../server/security.js'
import { getLogger } from '../shared/logger.js'
import { generateUUID } from '../shared/utils.js'
import { APIRoutes } from './api-routes.js'

/**
 * Secure Web Server Class
 * HTTP server with security middleware and WebSocket support
 */
export class WebServer {
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot
    this.config = {
      port: config.port || 3636,
      host: config.host || '127.0.0.1',
      maxConnections: config.maxConnections || 10,
      requestTimeoutMs: config.requestTimeoutMs || 30000,
      ...config,
    }

    // Initialize security and logging first
    this.security = new SecurityManager(projectRoot)
    this.logger = getLogger('web-server')

    // Load default configuration
    this.defaultConfig = this.loadDefaultConfig()

    // Server components
    this.app = express()
    this.httpServer = null
    this.wss = null

    // Connection tracking
    this.activeConnections = new Map()
    this.wsConnections = new Set()

    // Initialize server
    this.setupMiddleware()
    this.setupRoutes()
    this.setupWebSocket()

    this.logger.info('WebServer initialized', {
      port: this.config.port,
      host: this.config.host,
    })
  }

  /**
   * Load default configuration
   */
  loadDefaultConfig() {
    try {
      const configPath = join(this.projectRoot, 'config', 'default-config.json')
      return JSON.parse(readFileSync(configPath, 'utf8'))
    } catch (error) {
      this.logger.error('Failed to load default config', { error: error.message })
      return {}
    }
  }

  /**
   * Setup Express middleware with security controls
   */
  setupMiddleware() {
    // Security headers
    if (this.defaultConfig.security?.enableHelmet) {
      this.app.use(
        helmet({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              imgSrc: ["'self'", 'data:', 'blob:'],
            },
          },
        })
      )
    }

    // CORS configuration
    const allowedOrigins = this.defaultConfig.security?.allowedOrigins || [`http://${this.config.host}:${this.config.port}`, 'http://localhost:3636', 'http://127.0.0.1:3636']

    this.app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      })
    )

    // Rate limiting
    if (this.defaultConfig.security?.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: this.defaultConfig.security.rateLimitWindowMs || 900000, // 15 minutes
        max: this.defaultConfig.security.rateLimitMaxRequests || 100,
        message: { error: 'Too many requests, please try again later.' },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          this.logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          })

          this.logger.audit('rate_limit_exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
          })

          res.status(429).json({ error: 'Too many requests, please try again later.' })
        },
      })

      this.app.use(limiter)
    }

    // Request parsing
    this.app.use(
      express.json({
        limit: '10mb',
        verify: (req, res, buf) => {
          // Basic request validation
          if (buf.length === 0) return
          try {
            JSON.parse(buf)
          } catch (e) {
            throw new Error('Invalid JSON')
          }
        },
      })
    )

    this.app.use(
      express.urlencoded({
        extended: true,
        limit: '10mb',
      })
    )

    // Request logging and tracking
    this.app.use((req, res, next) => {
      const requestId = generateUUID()
      req.requestId = requestId
      req.startTime = Date.now()

      // Track connection
      this.activeConnections.set(requestId, {
        id: requestId,
        startTime: req.startTime,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      })

      // Cleanup on response finish
      res.on('finish', () => {
        this.activeConnections.delete(requestId)

        const duration = Date.now() - req.startTime
        this.logger.debug('Request completed', {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
        })
      })

      next()
    })

    // Request timeout
    this.app.use((req, res, next) => {
      res.setTimeout(this.config.requestTimeoutMs, () => {
        this.logger.warn('Request timeout', {
          requestId: req.requestId,
          path: req.path,
        })

        if (!res.headersSent) {
          res.status(408).json({ error: 'Request timeout' })
        }
      })
      next()
    })

    // Static file serving
    const publicPath = join(this.projectRoot, 'public')
    this.app.use(
      express.static(publicPath, {
        maxAge: '1h',
        etag: true,
        lastModified: true,
      })
    )
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Initialize API routes
    this.apiRoutes = new APIRoutes(this.projectRoot, {
      security: this.security,
      logger: this.logger,
    })

    // Mount API routes
    this.app.use('/api', this.apiRoutes.getRouter())

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeConnections: this.activeConnections.size,
        wsConnections: this.wsConnections.size,
      }

      res.json(health)
    })

    // Root route - serve main application
    this.app.get('/', (req, res) => {
      this.logger.debug('Serving main application', { requestId: req.requestId })
      res.sendFile(join(this.projectRoot, 'public', 'index.html'))
    })

    // 404 handler
    this.app.use('*', (req, res) => {
      this.logger.warn('Route not found', {
        path: req.path,
        method: req.method,
        requestId: req.requestId,
      })

      res.status(404).json({
        error: 'Route not found',
        path: req.path,
      })
    })

    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled request error', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        path: req.path,
      })

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          requestId: req.requestId,
        })
      }
    })
  }

  /**
   * Setup WebSocket server
   */
  setupWebSocket() {
    this.wss = new WebSocketServer({
      noServer: true,
      clientTracking: true,
    })

    this.wss.on('connection', (ws, req) => {
      const connectionId = generateUUID()
      ws.connectionId = connectionId
      ws.isAlive = true

      this.wsConnections.add(ws)

      this.logger.info('WebSocket connection established', {
        connectionId,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      })

      this.logger.audit('websocket_connected', {
        connectionId,
        ip: req.socket.remoteAddress,
      })

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: 'connection',
          data: {
            connectionId,
            timestamp: new Date().toISOString(),
            message: 'Connected to Interactive Feedback MCP',
          },
        })
      )

      // Handle messages
      ws.on('message', async message => {
        try {
          const data = JSON.parse(message.toString())
          await this.handleWebSocketMessage(ws, data)
        } catch (error) {
          this.logger.error('WebSocket message error', {
            connectionId,
            error: error.message,
          })

          ws.send(
            JSON.stringify({
              type: 'error',
              data: { error: 'Invalid message format' },
            })
          )
        }
      })

      // Handle pong for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true
      })

      // Handle connection close
      ws.on('close', () => {
        this.wsConnections.delete(ws)
        this.logger.info('WebSocket connection closed', { connectionId })

        this.logger.audit('websocket_disconnected', {
          connectionId,
        })
      })

      // Handle errors
      ws.on('error', error => {
        this.logger.error('WebSocket error', {
          connectionId,
          error: error.message,
        })

        this.wsConnections.delete(ws)
      })
    })

    // Setup heartbeat to detect broken connections
    setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          this.logger.debug('Terminating broken WebSocket connection', {
            connectionId: ws.connectionId,
          })
          return ws.terminate()
        }

        ws.isAlive = false
        ws.ping()
      })
    }, 30000) // 30 second heartbeat
  }

  /**
   * Handle WebSocket messages
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Message data
   */
  async handleWebSocketMessage(ws, data) {
    const { type, payload } = data

    this.logger.debug('WebSocket message received', {
      connectionId: ws.connectionId,
      type,
    })

    switch (type) {
      case 'ping':
        ws.send(
          JSON.stringify({
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
          })
        )
        break

      case 'subscribe':
        // Handle subscription to specific events
        if (payload?.events) {
          ws.subscribedEvents = payload.events
          ws.send(
            JSON.stringify({
              type: 'subscribed',
              data: { events: payload.events },
            })
          )
        }
        break

      default:
        this.logger.warn('Unknown WebSocket message type', {
          connectionId: ws.connectionId,
          type,
        })
    }
  }

  /**
   * Broadcast message to all connected WebSocket clients
   * @param {Object} message - Message to broadcast
   * @param {string} eventType - Event type for filtering
   */
  broadcast(message, eventType = null) {
    const messageStr = JSON.stringify(message)

    this.wsConnections.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        // Check if client is subscribed to this event type
        if (!eventType || !ws.subscribedEvents || ws.subscribedEvents.includes(eventType)) {
          ws.send(messageStr)
        }
      }
    })

    this.logger.debug('Broadcasted message to WebSocket clients', {
      type: message.type,
      clientCount: this.wsConnections.size,
      eventType,
    })
  }

  /**
   * Start the web server
   * @returns {Promise<number>} Server port
   */
  async start() {
    return new Promise((resolve, reject) => {
      // Create HTTP server
      this.httpServer = createServer(this.app)

      // Handle WebSocket upgrade
      this.httpServer.on('upgrade', (request, socket, head) => {
        // Basic security check
        const origin = request.headers.origin
        const allowedOrigins = this.defaultConfig.security?.allowedOrigins || []

        if (origin && !allowedOrigins.includes(origin) && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
          this.logger.warn('WebSocket upgrade rejected - invalid origin', { origin })
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
          socket.destroy()
          return
        }

        this.wss.handleUpgrade(request, socket, head, ws => {
          this.wss.emit('connection', ws, request)
        })
      })

      // Start listening
      this.httpServer.listen(this.config.port, this.config.host, error => {
        if (error) {
          reject(error)
          return
        }

        const address = this.httpServer.address()
        this.logger.info('Web server started', {
          host: address.address,
          port: address.port,
          url: `http://${address.address}:${address.port}`,
        })

        this.logger.audit('web_server_started', {
          host: address.address,
          port: address.port,
        })

        resolve(address.port)
      })

      // Handle server errors
      this.httpServer.on('error', error => {
        this.logger.error('HTTP server error', { error: error.message })
      })

      // Connection limit
      this.httpServer.maxConnections = this.config.maxConnections
    })
  }

  /**
   * Stop the web server
   */
  async stop() {
    return new Promise(resolve => {
      this.logger.info('Stopping web server')

      // Close WebSocket connections
      this.wsConnections.forEach(ws => {
        ws.close(1001, 'Server shutting down')
      })

      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.logger.info('Web server stopped')

          this.logger.audit('web_server_stopped', {
            uptime: process.uptime(),
          })

          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Get server statistics
   * @returns {Object} Server statistics
   */
  getStatistics() {
    return {
      httpConnections: this.activeConnections.size,
      wsConnections: this.wsConnections.size,
      maxConnections: this.config.maxConnections,
      uptime: process.uptime(),
      host: this.config.host,
      port: this.config.port,
    }
  }
}
