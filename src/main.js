#!/usr/bin/env node

/**
 * Interactive Feedback MCP - Secure Edition
 * Main entry point for the application
 *
 * Author: STMMO Project - Secure Remake
 * Version: 2.0.0
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Get current directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '..')

// Set up global project root for other modules
process.env.PROJECT_ROOT = PROJECT_ROOT

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
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
 * Main application entry point
 */
async function main() {
  try {
    const args = parseArguments()

    // Show help
    if (args.help || args.h) {
      console.log(`
Interactive Feedback MCP - Secure Edition v2.0.0

Usage: node src/main.js [options]

Options:
  --project-directory <path>  Project directory to serve (default: cwd)
  --prompt <message>         Initial prompt message
  --output-file <path>       Output file for results
  --config <path>            Configuration file path
  --port <number>            Server port (default: 3636)
  --mode <mode>              Run mode: mcp-server, web-ui, or both (default: both)
  --help, -h                 Show this help message

Examples:
  node src/main.js --project-directory /path/to/project
  node src/main.js --port 3637 --config custom-config.json
  node src/main.js --mode mcp-server  # MCP server only
  node src/main.js --mode web-ui      # Web UI only
            `)
      return
    }

    // Import main application modules
    console.log('🚀 Starting Interactive Feedback MCP - Secure Edition...')

    const { MCPServer } = await import('./server/mcp-server.js')
    const { WebServer } = await import('./web/web-server.js')
    const { ConfigManager } = await import('./shared/config.js')
    const { getLogger } = await import('./shared/logger.js')

    // Initialize logger and config manager
    const logger = getLogger(PROJECT_ROOT)
    const configManager = new ConfigManager(PROJECT_ROOT)

    // Load configuration
    // Use PROJECT_ROOT as the default project directory to ensure config files are found
    const projectDirectory = args.project_directory || PROJECT_ROOT
    const config = await configManager.loadProjectConfig(projectDirectory)

    // Override config with command line args
    if (args.port) config.server.port = parseInt(args.port)
    if (args.host) config.server.host = args.host

    const runMode = args.mode || 'both'

    logger.info('Starting application', {
      mode: runMode,
      projectDirectory,
      config: {
        port: config.server.port,
        host: config.server.host,
      },
    })

    // Global application state
    const appState = {
      mcpServer: null,
      webServer: null,
      MCPServer,
      WebServer,
      logger,
      configManager,
      config,
      projectDirectory,
      args,
    }

    // Start services based on mode
    if (runMode === 'mcp-server' || runMode === 'both') {
      await startMCPServer(appState)
    }

    if (runMode === 'web-ui' || runMode === 'both') {
      await startWebServer(appState)
    }

    // Setup graceful shutdown
    setupGracefulShutdown(appState)

    logger.info('Application startup completed', {
      mode: runMode,
      uptime: process.uptime(),
    })
  } catch (error) {
    console.error('❌ Failed to start application:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * Start MCP Server
 * @param {Object} appState - Application state
 */
async function startMCPServer(appState) {
  try {
    console.log('🔧 Starting MCP Server...')

    appState.mcpServer = new appState.MCPServer(appState.projectDirectory, {
      logging: appState.config.logging || {},
    })

    // If running web UI, integrate with it
    if (appState.webServer) {
      // Connect MCP server events to WebSocket broadcast
      appState.mcpServer.on('tool_execution', data => {
        appState.webServer.broadcast(
          {
            type: 'tool_execution',
            data,
          },
          'tool_events'
        )
      })
    }

    appState.mcpServer.start()

    appState.logger.info('MCP Server started successfully')
    console.log('✅ MCP Server listening on stdio')
  } catch (error) {
    appState.logger.error('Failed to start MCP Server', { error: error.message })
    throw error
  }
}

/**
 * Start Web Server
 * @param {Object} appState - Application state
 */
async function startWebServer(appState) {
  try {
    console.log('🌐 Starting Web Server...')

    appState.webServer = new appState.WebServer(appState.projectDirectory, appState.config.server)

    const port = await appState.webServer.start()

    appState.logger.info('Web Server started successfully', { port })
    console.log(`✅ Web UI available at http://${appState.config.server.host}:${port}`)

    // Auto-open browser if requested
    if (appState.args.open_browser !== false) {
      await openBrowser(`http://${appState.config.server.host}:${port}`)
    }
  } catch (error) {
    appState.logger.error('Failed to start Web Server', { error: error.message })
    throw error
  }
}

/**
 * Open browser (cross-platform)
 * @param {string} url - URL to open
 */
async function openBrowser(url) {
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
    console.log(`🌐 Opening browser at ${url}`)
  } catch (error) {
    console.warn('Could not open browser automatically:', error.message)
  }
}

/**
 * Setup graceful shutdown handlers
 * @param {Object} appState - Application state
 */
function setupGracefulShutdown(appState) {
  const shutdown = async signal => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)

    appState.logger.info('Application shutdown initiated', { signal })

    try {
      // Stop web server
      if (appState.webServer) {
        console.log('📴 Stopping Web Server...')
        await appState.webServer.stop()
      }

      // Stop MCP server
      if (appState.mcpServer) {
        console.log('📴 Stopping MCP Server...')
        appState.mcpServer.shutdown()
      }

      // Final cleanup
      if (appState.logger && appState.logger.cleanup) {
        await appState.logger.cleanup()
      }

      appState.logger.info('Application shutdown completed gracefully')
      console.log('✅ Shutdown completed')

      process.exit(0)
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message)
      process.exit(1)
    }
  }

  // Handle different termination signals
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main }
