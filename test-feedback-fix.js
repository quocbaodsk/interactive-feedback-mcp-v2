#!/usr/bin/env node

/**
 * Test script to verify feedback submission fix
 * Tests that the temporary JSON file is written and read correctly
 */

import { spawn } from 'child_process'
import fs from 'fs-extra'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_ROOT = __dirname

console.log('🧪 Testing Feedback File Write/Read Fix\n')

async function testFeedbackProcess() {
  const outputFile = join(tmpdir(), `test-feedback-${Date.now()}.json`)

  console.log('📝 Test Configuration:')
  console.log('  Output file:', outputFile)
  console.log()

  try {
    // Spawn the feedback UI server
    console.log('🚀 Spawning feedback UI server...')

    const feedbackUIPath = join(PROJECT_ROOT, 'src', 'feedback-ui-server.js')
    const args = [feedbackUIPath, '--project-directory', PROJECT_ROOT, '--summary', 'Test feedback submission', '--output-file', outputFile]

    const childProcess = spawn('node', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    // Collect output
    let stdout = ''
    let stderr = ''

    childProcess.stdout.on('data', data => {
      stdout += data.toString()
      console.log('  [STDOUT]', data.toString().trim())
    })

    childProcess.stderr.on('data', data => {
      stderr += data.toString()
      console.log('  [STDERR]', data.toString().trim())
    })

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Simulate feedback submission
    console.log('\n📤 Submitting test feedback...')

    const port = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)/)
    if (!port || !port[1]) {
      throw new Error('Could not find server port in output')
    }

    const serverUrl = `http://127.0.0.1:${port[1]}`
    console.log('  Server URL:', serverUrl)

    // Submit feedback via HTTP
    const response = await fetch(`${serverUrl}/api/submit-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: 'This is a test feedback message' }),
    })

    console.log('  Response status:', response.status)

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const result = await response.json()
    console.log('  Response:', result)

    // Wait for process to exit
    console.log('\n⏳ Waiting for process to exit...')

    const exitCode = await new Promise(resolve => {
      childProcess.on('close', code => {
        resolve(code)
      })
    })

    console.log('  Process exited with code:', exitCode)

    if (exitCode !== 0) {
      throw new Error(`Process exited with non-zero code: ${exitCode}`)
    }

    // Now test reading the file (like the parent process does)
    console.log('\n🔍 Testing file read (simulating parent process)...')

    let readAttempts = 0
    const maxAttempts = 10
    let feedbackData = null

    while (readAttempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500))

        console.log(`  Attempt ${readAttempts + 1}/${maxAttempts}...`)

        // Check if file exists
        const exists = await fs.pathExists(outputFile)
        console.log('    File exists:', exists)

        if (!exists) {
          throw new Error('File does not exist')
        }

        // Try to read the file
        const fileContent = await fs.readFile(outputFile, 'utf8')
        console.log('    File size:', fileContent.length, 'bytes')
        console.log('    First 100 chars:', fileContent.substring(0, 100))

        // Parse JSON
        feedbackData = JSON.parse(fileContent)
        console.log('    JSON parsed successfully')

        // Verify content
        if (!feedbackData.interactive_feedback) {
          throw new Error('Missing interactive_feedback field')
        }

        console.log('    ✅ Content is valid!')
        break
      } catch (error) {
        readAttempts++
        console.log('    ❌ Error:', error.message)

        if (readAttempts >= maxAttempts) {
          throw new Error(`Failed to read feedback after ${maxAttempts} attempts: ${error.message}`)
        }

        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }

    console.log('\n✅ Test Result:')
    console.log('  Feedback:', feedbackData.interactive_feedback)
    console.log('  Session completed:', feedbackData.session_completed)
    console.log('  Timestamp:', feedbackData.timestamp)

    // Cleanup
    await fs.unlink(outputFile)
    console.log('\n🧹 Cleanup: Temp file deleted')

    console.log('\n🎉 TEST PASSED! The fix works correctly.\n')
    return true
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error(error.stack)

    // Try to cleanup
    try {
      await fs.unlink(outputFile)
    } catch (e) {
      // Ignore
    }

    return false
  }
}

// Run the test
testFeedbackProcess()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
