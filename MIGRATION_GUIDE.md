# Migration Guide - Hehe Workflow Integration

This document describes the updates made to integrate the enhanced workflow from the `hehe` folder into your main project.

## What's New

### 🎨 Enhanced UI Features

1. **Terminal-Style Interface**
   - Modern dark terminal theme
   - Mac-style window controls
   - Professional terminal aesthetics
   - Responsive design

2. **Language Switching (EN/VI)**
   - Toggle between English and Vietnamese
   - Persistent language preference
   - All UI elements translated
   - Automatic language detection

3. **Advanced File Picker**
   - Type `@` to trigger file browser
   - Smart search with fuzzy matching
   - Multi-file selection with Shift+Click
   - Keyboard navigation (Arrow keys, Enter, Escape)
   - Context-aware suggestions
   - File scoring and relevance ranking

4. **Speech-to-Text**
   - Record voice feedback with microphone button
   - Automatic transcription using OpenAI Whisper
   - Real-time recording timer
   - Support for multiple languages
   - Visual recording indicators

5. **Command Execution**
   - Collapsible command section
   - Real-time console output
   - WebSocket-based streaming
   - Command history
   - Auto-execute on load option

6. **Markdown Support**
   - Rich text rendering in feedback prompt
   - Syntax highlighting for code blocks
   - Tables, lists, and formatting support
   - Clean presentation of complex content

### 🔧 Backend Improvements

1. **New API Endpoints**
   - `/api/browse-files` - File system browsing with security
   - `/api/speech-to-text` - Audio transcription
   - `/api/run-command` - Execute commands safely
   - `/api/stop-command` - Terminate running processes
   - `/api/config` - GET/POST configuration management

2. **OpenAI Integration**
   - Whisper API for speech-to-text
   - Configurable language support
   - Error handling and fallbacks
   - Secure API key management

3. **Enhanced Security**
   - Path traversal prevention
   - File access validation
   - Sandboxed command execution
   - Input sanitization

## Files Updated

### Frontend Files
- ✅ `public/index.html` - Complete terminal UI
- ✅ `public/style.css` - Terminal theme styles
- ✅ `public/script.js` - Enhanced functionality
- ✅ `public/js/context-analyzer.js` - Context analysis
- ✅ `public/js/file-scorer.js` - File relevance scoring
- ✅ `public/js/smart-file-picker.js` - Intelligent file picker

### Backend Files
- ✅ `src/feedback-ui-server.js` - All API endpoints
- ✅ `package.json` - New dependencies added

### Documentation
- ✅ `OPENAI_SETUP.md` - Speech-to-text setup guide
- ✅ `MIGRATION_GUIDE.md` - This file

## Installation Steps

### 1. Install New Dependencies

```bash
npm install
```

This will install:
- `multer` - File upload handling
- `openai` - OpenAI API client
- `dotenv` - Environment variable management

### 2. Configure OpenAI (Optional)

If you want to use speech-to-text features:

1. Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your_api_key_here
WHISPER_LANGUAGE=vi
```

2. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

See `OPENAI_SETUP.md` for detailed instructions.

### 3. Test the Installation

Run the server:

```bash
npm start
```

The enhanced UI should be available at `http://localhost:3800` (or similar port).

## Feature Highlights

### File Picker Usage

1. Click in the feedback textarea
2. Type `@` to open file picker
3. Navigate with:
   - Arrow keys to move selection
   - Enter to select file or open folder
   - Escape to close picker
   - Shift+Click for multi-selection
4. Type after `@` to search files

### Speech-to-Text Usage

1. Click the microphone button (🎤)
2. Grant browser microphone permission if prompted
3. Speak your feedback
4. Click the button again to stop recording
5. Wait for transcription (2-5 seconds)
6. Text appears in feedback textarea

### Command Execution

1. Click "Show" to expand command section
2. Enter your command
3. Click "Run" to execute
4. View real-time output in console
5. Click "Stop" to terminate if needed

### Language Switching

1. Click "EN" or "VI" button in header
2. Interface switches language immediately
3. Preference saved in browser

## Configuration Options

### UI Configuration

Edit `public/script.js` to customize:

```javascript
this.config = {
  minRelevanceScore: 30,      // File picker minimum score
  maxSuggestions: 15,          // Max file suggestions
  enableLearning: true,        // Learn from selections
  groupByCategory: true,       // Group suggestions
  highlightMatches: true       // Highlight search matches
}
```

### Server Configuration

Edit `src/feedback-ui-server.js` to customize:

```javascript
this.port = 3800                // Server port
this.upload.limits.fileSize     // Max upload size
process.env.WHISPER_LANGUAGE    // Default language
```

## Troubleshooting

### Speech-to-Text Not Working

**Check:**
1. Is `OPENAI_API_KEY` set in `.env`?
2. Do you have OpenAI credits?
3. Is microphone permission granted?
4. Check browser console for errors

**Solution:**
```bash
# Verify .env file exists
cat .env

# Check if key is valid (starts with sk-)
echo $OPENAI_API_KEY
```

### File Picker Not Showing

**Check:**
1. Did you type `@` in textarea?
2. Is JavaScript console showing errors?
3. Are files loading from server?

**Solution:**
- Open browser DevTools (F12)
- Check Network tab for API calls
- Verify `/api/browse-files` returns data

### Command Execution Fails

**Check:**
1. Is command allowed by system?
2. Does project directory have permissions?
3. Check console output for errors

**Solution:**
- Verify command syntax
- Check file permissions
- Review server logs

### Language Not Switching

**Check:**
1. Is `script.js` loaded correctly?
2. Check browser console for errors
3. Clear browser cache

**Solution:**
```javascript
// Open browser console and run:
localStorage.clear()
location.reload()
```

## Performance Considerations

### File Picker Performance

- Initial scan limited to project root
- Lazy loading for subdirectories
- Smart caching (5-second timeout)
- Batch processing (50 files at a time)

### Speech-to-Text Performance

- Audio chunks streamed in real-time
- Temporary files cleaned automatically
- 25MB file size limit
- Whisper API typically responds in 2-5 seconds

### WebSocket Connections

- Auto-reconnect after 3 seconds
- Heartbeat monitoring
- Graceful degradation if WS fails

## Backward Compatibility

### Existing Features Preserved

All original features remain functional:
- Basic feedback submission
- Project directory handling
- Output file generation
- MCP server integration

### Breaking Changes

None. The updates are additive only.

### Migration Path

No migration needed. Simply:
1. Install new dependencies
2. Restart server
3. Optionally configure OpenAI

## Advanced Usage

### Custom File Scoring

Edit `public/js/file-scorer.js` to customize file relevance:

```javascript
calculateRelevanceScore(file, context) {
  let score = 0
  
  // Add custom scoring logic
  if (file.name.includes('important')) {
    score += 50
  }
  
  return score
}
```

### Custom Context Analysis

Edit `public/js/context-analyzer.js`:

```javascript
analyzeContext(text) {
  const context = {
    keywords: this.extractKeywords(text),
    intent: this.determineIntent(text),
    // Add custom context analysis
  }
  return context
}
```

## Support

For issues or questions:
1. Check this guide first
2. Review `OPENAI_SETUP.md` for API setup
3. Check browser console for errors
4. Review server logs for backend issues
5. Open an issue on GitHub

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ⚠️ Configure OpenAI (optional): See `OPENAI_SETUP.md`
3. ✅ Start server: `npm start`
4. 🎉 Enjoy enhanced features!

## Credits

Based on the excellent work from the `hehe` folder implementation.

Enhanced features include:
- Terminal-style UI
- Smart file picker
- Speech-to-text integration
- Multilingual support
- Advanced context analysis

---

**Last Updated:** November 28, 2025
**Version:** 2.0.0
