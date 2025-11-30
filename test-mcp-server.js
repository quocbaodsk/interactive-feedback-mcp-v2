#!/usr/bin/env node

/**
 * Test MCP Server for Cursor Integration
 * Tests if the server produces clean JSON output without ANSI codes
 */

import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname)

console.log('🧪 Testing MCP Server for Cursor Integration...\n')

// Test 1: Initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'cursor-test',
      version: '1.0.0',
    },
  },
}

// Test 2: Tools list request
const toolsRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
}

async function testMCPServer() {
  return new Promise((resolve, reject) => {
    // Set environment to match Cursor config
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--no-warnings --no-deprecation',
      MCP_LOG_LEVEL: 'error',
      PROJECT_ROOT,
    }

    // Start MCP server
    const server = spawn('node', ['src/mcp-lightweight.js'], {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let testPassed = true

    server.stdout.on('data', data => {
      const output = data.toString()
      stdout += output

      // Check for ANSI color codes
      if (/\x1b\[[0-9;]*m/.test(output)) {
        console.log('❌ ANSI color codes detected in stdout!')
        console.log('Output:', output)
        testPassed = false
      }

      // Check if output is valid JSON
      try {
        JSON.parse(output.trim())
        console.log('✅ Valid JSON response received')
      } catch (e) {
        console.log('❌ Invalid JSON in stdout!')
        console.log('Output:', output)
        testPassed = false
      }
    })

    server.stderr.on('data', data => {
      const output = data.toString()
      stderr += output

      // Check for ANSI color codes in stderr
      if (/\x1b\[[0-9;]*m/.test(output)) {
        console.log('❌ ANSI color codes detected in stderr!')
        console.log('Output:', output)
        testPassed = false
      }
    })

    server.on('error', error => {
      console.log('❌ Server error:', error.message)
      reject(error)
    })

    // Send test requests
    setTimeout(() => {
      server.stdin.write(JSON.stringify(initRequest) + '\n')
    }, 100)

    setTimeout(() => {
      server.stdin.write(JSON.stringify(toolsRequest) + '\n')
    }, 200)

    // Timeout and cleanup
    setTimeout(() => {
      server.kill('SIGTERM')

      console.log('\n📊 Test Results:')
      console.log('Test passed:', testPassed ? '✅' : '❌')
      console.log('\nStdout:', stdout || '(empty)')
      console.log('\nStderr:', stderr || '(empty)')

      if (testPassed) {
        console.log('\n🎉 MCP Server is ready for Cursor integration!')
      } else {
        console.log('\n🔧 MCP Server needs fixes before Cursor integration')
      }

      resolve(testPassed)
    }, 1000)
  })
}

// Run test
testMCPServer().catch(console.error)
