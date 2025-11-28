# Interactive Feedback MCP - Secure Edition

A secure and optimized implementation of Interactive Feedback MCP with enhanced security, local file storage, and improved performance.

## 🔐 Security Features

- **Command Whitelisting**: Only allow predefined safe commands
- **Path Traversal Protection**: Secure file browsing within project boundaries  
- **Rate Limiting**: Prevent abuse of API endpoints
- **Input Validation**: Sanitize all user inputs
- **Local Storage**: All files stored within project directory
- **CSRF Protection**: Basic security headers and validation

## 📁 Project Structure

```
new_remake/
├── src/
│   ├── server/         # MCP protocol and security
│   ├── web/           # Web UI and API routes  
│   ├── shared/        # Common utilities
│   └── main.js        # Application entry point
├── config/            # Configuration files
├── storage/           # Local data storage
├── public/           # Static web assets
└── package.json
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Check for migration from old version (optional)
node migrate.js check

# Perform migration if needed (optional)
node migrate.js migrate --yes

# Start the server (both MCP server and Web UI)
npm start

# Start only MCP server (for use with AI assistants)
node src/main.js --mode mcp-server

# Start only Web UI (for manual testing)
node src/main.js --mode web-ui

# Development mode with detailed logging
npm run dev
```

## 🔄 Migration from Old Version

If you have configurations from the previous version:

```bash
# Check if migration is needed
node migrate.js check

# Perform migration with backup
node migrate.js migrate --yes --verbose

# Verify migration completed successfully  
node migrate.js verify

# Clean up old files (archives them safely)
node migrate.js cleanup

# View migration log
node migrate.js log
```

## 📋 Core Features

- ✅ MCP Protocol compliance (initialize, tools/list, tools/call)
- ✅ Secure command execution with whitelisting
- ✅ Real-time web UI with WebSocket updates
- ✅ Local file storage (no global directories)
- ✅ Enhanced security and input validation
- ✅ Performance optimizations and streaming

## 🛡️ Security Improvements

This version addresses security vulnerabilities from the original:

- **No arbitrary command execution** - Commands must be whitelisted
- **No unrestricted file access** - File browsing limited to safe extensions
- **No global file creation** - All storage within project directory
- **Input sanitization** - All user inputs validated and sanitized
- **Network security** - Server bound to localhost only

## 📖 Usage

Same interface as original version but with enhanced security:

```javascript
// AI assistant calls this tool
{
  "tool": "interactive_feedback", 
  "arguments": {
    "project_directory": "/path/to/project",
    "summary": "Summary of changes made"
  }
}
```

## ⚙️ Configuration

Configuration files in `config/`:
- `commands-whitelist.json` - Allowed commands and patterns
- `default-config.json` - Default application settings

All runtime data stored in `storage/`:
- `configs/` - Project configurations
- `temp/` - Temporary files (auto-cleaned)
- `logs/` - Application logs
- `sessions/` - Session data

---

**Version 2.0.0** - Secure remake with enhanced safety and local storage
