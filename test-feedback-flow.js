#!/usr/bin/env node

/**
 * Test Interactive Feedback Flow
 * Kiểm tra luồng hoàn chỉnh từ MCP → UI → Feedback
 */

import { spawn } from 'child_process'
import fs from 'fs-extra'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = __dirname

console.log('🧪 Testing Interactive Feedback MCP Flow\n')
console.log('=' .repeat(60))

// Test configuration
const testConfig = {
  projectDirectory: PROJECT_ROOT,
  summary: `# 🧪 Test Feedback Request

Đây là test message từ automated test.

## Câu Hỏi:
Bạn có thấy prompt này **hiển thị đúng** không?

### Các bước test:
1. ✅ Check prompt hiển thị
2. ✅ Gõ \`@\` để test file picker
3. ✅ Submit feedback: "Test successful"

**Hãy submit feedback để hoàn thành test!**`,
  outputFile: join(PROJECT_ROOT, 'storage', 'temp', `test-feedback-${Date.now()}.json`),
}

console.log('\n📋 Test Configuration:')
console.log('  Project Directory:', testConfig.projectDirectory)
console.log('  Output File:', testConfig.outputFile)
console.log('  Summary Length:', testConfig.summary.length, 'chars')
console.log('=' .repeat(60) + '\n')

/**
 * Step 1: Test Feedback UI Server
 */
async function testFeedbackUIServer() {
  console.log('🚀 Step 1: Starting Feedback UI Server...\n')

  return new Promise((resolve, reject) => {
    const feedbackUIPath = join(PROJECT_ROOT, 'src', 'feedback-ui-server.js')

    const args = [
      feedbackUIPath,
      '--project-directory',
      testConfig.projectDirectory,
      '--summary',
      testConfig.summary,
      '--output-file',
      testConfig.outputFile,
    ]

    console.log('📝 Command:', 'node', args.slice(1).map(arg => (arg.includes(' ') ? `"${arg}"` : arg)).join(' '))
    console.log()

    const uiProcess = spawn('node', args, {
      stdio: 'inherit',
      detached: false,
    })

    uiProcess.on('error', error => {
      console.error('❌ Failed to start UI server:', error.message)
      reject(error)
    })

    uiProcess.on('close', code => {
      console.log()
      if (code === 0) {
        console.log('✅ UI Server closed successfully (code 0)')
        resolve()
      } else {
        console.error('❌ UI Server failed (code', code, ')')
        reject(new Error(`UI Server exited with code ${code}`))
      }
    })

    // Give some time for server to start
    setTimeout(() => {
      console.log('⏳ UI Server should be running now...')
      console.log('🌐 Check browser at: http://127.0.0.1:38XX')
      console.log()
      console.log('📝 Please complete the feedback in the browser:')
      console.log('   1. Verify prompt is displayed correctly')
      console.log('   2. Type @ to test file picker (optional)')
      console.log('   3. Submit feedback: "Test successful"')
      console.log()
    }, 2000)
  })
}

/**
 * Step 2: Verify output file
 */
async function verifyOutputFile() {
  console.log('\n🔍 Step 2: Verifying Output File...\n')

  try {
    // Check if file exists
    const exists = await fs.pathExists(testConfig.outputFile)

    if (!exists) {
      console.error('❌ Output file not created!')
      console.error('   Expected:', testConfig.outputFile)
      return false
    }

    console.log('✅ Output file exists:', testConfig.outputFile)

    // Read and parse file
    const content = await fs.readJson(testConfig.outputFile)

    console.log('\n📄 Output Content:')
    console.log(JSON.stringify(content, null, 2))
    console.log()

    // Validate structure
    const requiredFields = ['ask_user', 'session_completed', 'timestamp']
    const missingFields = requiredFields.filter(field => !content[field])

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields.join(', '))
      return false
    }

    console.log('✅ All required fields present')

    // Check feedback content
    if (!content.ask_user || content.ask_user.trim() === '') {
      console.error('❌ Feedback is empty')
      return false
    }

    console.log('✅ Feedback content:', content.ask_user.substring(0, 100) + (content.ask_user.length > 100 ? '...' : ''))

    // Check session completed
    if (content.session_completed !== true) {
      console.error('❌ Session not completed')
      return false
    }

    console.log('✅ Session marked as completed')

    return true
  } catch (error) {
    console.error('❌ Error verifying output:', error.message)
    return false
  }
}

/**
 * Main test runner
 */
async function runTest() {
  try {
    console.log('🎬 Starting test sequence...\n')

    // Ensure temp directory exists
    await fs.ensureDir(join(PROJECT_ROOT, 'storage', 'temp'))

    // Step 1: Run UI server (waits for user to submit feedback)
    await testFeedbackUIServer()

    // Step 2: Verify output
    const verified = await verifyOutputFile()

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Test Summary:')
    console.log('='.repeat(60))

    if (verified) {
      console.log('\n✅ ALL TESTS PASSED! 🎉')
      console.log('\nSystem is working correctly:')
      console.log('  ✓ Feedback UI Server started')
      console.log('  ✓ Browser opened and displayed UI')
      console.log('  ✓ Prompt was displayed correctly')
      console.log('  ✓ Feedback was submitted successfully')
      console.log('  ✓ Output file was created with correct format')
      console.log('\n👉 You can now use the MCP tool in Cursor!')
      console.log()
      process.exit(0)
    } else {
      console.log('\n❌ SOME TESTS FAILED')
      console.log('\nPlease check:')
      console.log('  1. Did the browser open?')
      console.log('  2. Was the prompt displayed correctly?')
      console.log('  3. Did you submit feedback?')
      console.log('  4. Check console errors in browser DevTools (F12)')
      console.log()
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:')
    console.error(error.message)
    console.error()
    console.error('Stack trace:')
    console.error(error.stack)
    console.error()
    process.exit(1)
  }
}

// Run test
runTest()

