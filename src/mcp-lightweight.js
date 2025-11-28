#!/usr/bin/env node

/**
 * Lightweight MCP Server - Fast Initialization
 * Optimized version for faster editor integration
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get current directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '..')

// Set up global project root for other modules
process.env.PROJECT_ROOT = PROJECT_ROOT

/**
 * Fast MCP Server startup
 */
async function startLightweightMCPServer() {
  try {
    // Import only MCP server (not web components)
    const { MCPServer } = await import('./server/mcp-server.js')
    
    // Create lightweight server instance with interactive feedback support
    const mcpServer = new MCPServer(PROJECT_ROOT, {
      logging: {
        level: process.env.MCP_LOG_LEVEL || 'error',
        console: false  // Disable console logging for faster startup
      }
    })
    
    // Start server immediately
    mcpServer.start()
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      mcpServer.shutdown()
    })
    
    process.on('SIGTERM', () => {
      mcpServer.shutdown()
    })
    
  } catch (error) {
    process.stderr.write(`MCP Server failed: ${error.message}\n`)
    process.exit(1)
  }
}

// Handle unhandled errors
process.on('uncaughtException', error => {
  process.stderr.write(`Uncaught Exception: ${error.message}\n`)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(`Unhandled Rejection: ${reason}\n`)
  process.exit(1)
})

// Start the lightweight server
if (import.meta.url === `file://${process.argv[1]}`) {
  startLightweightMCPServer()
}

export { startLightweightMCPServer }
