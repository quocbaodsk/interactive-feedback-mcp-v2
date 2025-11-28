#!/usr/bin/env node

/**
 * Diagnose "Failed to Fetch" Error
 * Test các scenarios có thể gây lỗi
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = __dirname

console.log('🔍 Diagnosing "Failed to Fetch" Error')
console.log('=' .repeat(60))
console.log()

// Test configuration
const PORT = 3800
const OUTPUT_FILE = `/tmp/diagnose-${Date.now()}.json`

console.log('📋 Test Configuration:')
console.log(`  Port: ${PORT}`)
console.log(`  Output: ${OUTPUT_FILE}`)
console.log('=' .repeat(60))
console.log()

// Start server
console.log('🚀 Starting Feedback UI Server...')
console.log()

const serverProcess = spawn('node', [
  join(PROJECT_ROOT, 'src', 'feedback-ui-server.js'),
  '--project-directory', PROJECT_ROOT,
  '--summary', 'Test: Diagnose fetch error',
  '--output-file', OUTPUT_FILE
], {
  stdio: 'inherit'
})

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message)
  process.exit(1)
})

// Wait for server to start
setTimeout(() => {
  console.log()
  console.log('⏳ Server should be running now...')
  console.log()
  console.log('🧪 Manual Testing Instructions:')
  console.log('=' .repeat(60))
  console.log()
  console.log('1. Open browser DevTools (F12)')
  console.log('2. Go to Network tab')
  console.log('3. Enter feedback and click Submit')
  console.log('4. Watch the Network tab for:')
  console.log()
  console.log('   ✅ Success case:')
  console.log('      - POST /api/submit-feedback')
  console.log('      - Status: 200 OK')
  console.log('      - Response: {"success":true}')
  console.log('      - Time: ~100-500ms')
  console.log()
  console.log('   ❌ Failure case:')
  console.log('      - POST /api/submit-feedback')
  console.log('      - Status: (failed)')
  console.log('      - Type: CORS error / Network error')
  console.log('      - Response: (none)')
  console.log()
  console.log('5. Check Console tab for JavaScript errors')
  console.log()
  console.log('6. Common issues to check:')
  console.log('   - CORS policy blocked?')
  console.log('   - Server crashed?')
  console.log('   - Port mismatch?')
  console.log('   - Request timeout?')
  console.log()
  console.log('=' .repeat(60))
  console.log()
  console.log('📝 After submitting, check:')
  console.log(`   Output file: ${OUTPUT_FILE}`)
  console.log('   Server logs above')
  console.log()
}, 3000)

serverProcess.on('close', (code) => {
  console.log()
  console.log('=' .repeat(60))
  console.log(`Server exited with code ${code}`)
  
  // Check output file
  import('fs-extra').then(fs => {
    if (fs.existsSync(OUTPUT_FILE)) {
      console.log()
      console.log('✅ Output file created - Feedback was processed')
      console.log()
      const content = fs.readJsonSync(OUTPUT_FILE)
      console.log('Content:', JSON.stringify(content, null, 2))
      fs.removeSync(OUTPUT_FILE)
    } else {
      console.log()
      console.log('❌ Output file NOT created - Feedback was NOT processed')
    }
  })
})

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log()
  console.log('🛑 Stopping server...')
  serverProcess.kill()
  process.exit(0)
})
