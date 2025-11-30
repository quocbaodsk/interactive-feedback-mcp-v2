# Fix: "Unexpected end of JSON input" Error

## 🎯 Problem

When submitting feedback, the system returned this error:

```json
{
  "error": "Failed to read feedback result after 5 attempts: /var/folders/.../feedback-xxx.json: Unexpected end of JSON input"
}
```

## 🔍 Root Cause

**Race condition** between file write and read operations:

1. User submits feedback → Feedback UI server writes to temp file
2. Server's `run()` method resolves when `feedbackResult` is set
3. Process calls `process.exit(0)` **immediately** (before file is flushed to disk)
4. Parent MCP server tries to read the file
5. File is empty or incomplete → "Unexpected end of JSON input"

### Technical Details

The issue was in `src/feedback-ui-server.js`:

```javascript
// OLD CODE - PROBLEMATIC
async run() {
  await this.start()
  this.openBrowser()
  
  return new Promise(resolve => {
    const checkResult = () => {
      if (this.feedbackResult) {
        resolve(this.feedbackResult)  // ← Resolves immediately!
      } else {
        setTimeout(checkResult, 100)
      }
    }
    checkResult()
  })
}

// Main execution
server.run().then(result => {
  process.exit(0)  // ← Exits before file is flushed!
})
```

The process exited as soon as `feedbackResult` was set, without waiting for:
- File write to complete and flush to disk
- Server to close gracefully
- Response to be sent to client

## ✅ Solution

### 1. Robust File Writing (`src/feedback-ui-server.js`)

**Added multiple verification layers:**

```javascript
// Write with retry logic
let writeAttempts = 0
const maxWriteAttempts = 3

while (writeAttempts < maxWriteAttempts) {
  try {
    // 1. Write with explicit encoding
    const jsonContent = JSON.stringify(this.feedbackResult, null, 2)
    await fs.writeFile(this.outputFile, jsonContent, { 
      encoding: 'utf8', 
      flag: 'w' 
    })
    
    // 2. Wait for OS to flush to disk
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 3. Verify file exists
    const exists = await fs.pathExists(this.outputFile)
    if (!exists) {
      throw new Error('Output file not found after write')
    }
    
    // 4. Read back and verify content
    const fileContent = await fs.readFile(this.outputFile, 'utf8')
    if (!fileContent || fileContent.trim().length === 0) {
      throw new Error('Output file is empty')
    }
    
    // 5. Verify JSON is valid
    const writtenContent = JSON.parse(fileContent)
    if (!writtenContent || !writtenContent.interactive_feedback) {
      throw new Error('Output file content is invalid')
    }
    
    console.log('✅ Output file written and verified')
    break
  } catch (writeError) {
    writeAttempts++
    if (writeAttempts >= maxWriteAttempts) {
      this.feedbackWriteFailed = true
      throw writeError
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}
```

### 2. Controlled Process Exit

**Added state tracking and delayed exit:**

```javascript
constructor() {
  // ...
  this.feedbackWriteFailed = false
  this.serverClosing = false
}

async run() {
  await this.start()
  this.openBrowser()
  
  return new Promise((resolve, reject) => {
    const checkResult = () => {
      if (this.feedbackWriteFailed) {
        reject(new Error('Failed to write feedback file'))
      } else if (this.feedbackResult && this.serverClosing) {
        // Wait extra time to ensure everything is flushed
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
```

**Modified server close handler:**

```javascript
setTimeout(() => {
  this.serverClosing = true  // ← Signal that closing has started
  
  // Close WebSocket connections
  if (this.wss) {
    this.wss.clients.forEach(client => client.close())
    this.wss.close()
  }
  
  // Close HTTP server
  if (this.server) {
    this.server.close(() => {
      // Don't exit here - let run() method handle it
    })
    
    // Force exit after 2 seconds if needed
    setTimeout(() => {
      process.exit(0)
    }, 2000)
  }
}, 3000)
```

### 3. Improved Read Logic (`src/server/mcp-server.js`)

**Enhanced retry mechanism:**

```javascript
// Increased attempts: 5 → 10
const maxAttempts = 10

while (attempts < maxAttempts) {
  try {
    // 1. Wait before reading (200ms → 500ms)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 2. Check file exists first
    const exists = await fs.pathExists(outputFile)
    if (!exists) {
      throw new Error('Output file does not exist yet')
    }
    
    // 3. Read and parse JSON
    result = await fs.readJson(outputFile)
    
    // 4. Verify content is valid
    if (!result || !result.interactive_feedback) {
      throw new Error('Output file content is invalid or incomplete')
    }
    
    break
  } catch (error) {
    attempts++
    if (attempts >= maxAttempts) {
      // Log file content for debugging
      try {
        const fileContent = await fs.readFile(outputFile, 'utf8')
        this.logger.error('File content on failure', { content: fileContent })
      } catch (e) {
        // Ignore
      }
      throw new Error(`Failed after ${maxAttempts} attempts: ${error.message}`)
    }
    
    // Increased retry delay: 500ms → 800ms
    await new Promise(resolve => setTimeout(resolve, 800))
  }
}
```

## 📊 Timing Summary

### Before (Problematic)
- File write: async (no verification)
- Process exit: immediate after `feedbackResult` set
- Parent read delay: 200ms initial + 500ms retry
- Total max wait: ~2.7 seconds

### After (Fixed)
- File write: async with 100ms flush + verification
- Process exit: waits for `serverClosing` + 500ms extra
- Parent read delay: 500ms initial + 800ms retry
- Total max wait: ~12 seconds (10 attempts)

## 🧪 Testing

Run the test script to verify the fix:

```bash
node test-feedback-fix.js
```

This will:
1. Spawn the feedback UI server
2. Submit test feedback via HTTP
3. Wait for process to exit
4. Attempt to read the file (simulating parent process)
5. Verify the content is valid

## ✅ Expected Behavior

1. ✅ User submits feedback → Server writes to temp file
2. ✅ File is verified immediately after write
3. ✅ Response is sent to client successfully
4. ✅ Server closes gracefully after 3 seconds
5. ✅ Process waits for server close + file flush
6. ✅ Parent reads file successfully with valid JSON
7. ✅ No more "Unexpected end of JSON input" errors

## 📝 Key Improvements

1. **Write Verification**: File content is verified immediately after writing
2. **Retry Logic**: Both write and read operations have retry mechanisms
3. **State Tracking**: Process knows when it's safe to exit
4. **Longer Delays**: More time for OS to flush data to disk
5. **Better Logging**: Detailed logs for debugging if issues occur

## 🔒 Safeguards

- Maximum 3 write attempts with validation
- Maximum 10 read attempts with longer delays
- File existence and content checks
- JSON parsing verification
- Process won't exit until file is confirmed valid
- Error logging with file content for debugging
