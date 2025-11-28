# Quick Start Guide - Enhanced Interactive Feedback MCP

## ✨ What's New

Your project now includes all the advanced features from the `hehe` folder:

### 🎨 UI Enhancements
- ✅ **Terminal-style interface** with modern dark theme
- ✅ **Language switching** (English ↔ Vietnamese)
- ✅ **Smart file picker** - Type `@` to browse files
- ✅ **Speech-to-text** - Record voice feedback
- ✅ **Command execution** - Run commands with live output
- ✅ **Markdown support** - Rich text in prompts

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs 3 new packages:
- `multer` - File uploads
- `openai` - Speech-to-text
- `dotenv` - Environment config

### 2. Start the Server

```bash
npm start
```

The enhanced UI will be available at the displayed URL.

### 3. (Optional) Enable Speech-to-Text

Create a `.env` file:

```env
OPENAI_API_KEY=sk-your_key_here
WHISPER_LANGUAGE=vi
```

Get your API key: https://platform.openai.com/api-keys

See `OPENAI_SETUP.md` for detailed setup.

## 🎯 Key Features

### File Picker
- Type `@` in feedback textarea
- Search files as you type
- Navigate with arrow keys
- Select with Enter
- Multi-select with Shift+Click

### Speech-to-Text
- Click 🎤 microphone button
- Speak your feedback
- Click again to stop
- Text appears automatically

### Language Toggle
- Click "EN" or "VI" in header
- Switches instantly
- Preference saved

### Command Execution
- Click "Show" to expand
- Enter command
- View real-time output
- Click "Stop" to terminate

## 📚 Documentation

- `MIGRATION_GUIDE.md` - Complete feature documentation
- `OPENAI_SETUP.md` - Speech-to-text setup
- `FEEDBACK_WORKFLOW.md` - Original workflow guide

## 🎉 That's It!

You're ready to use the enhanced Interactive Feedback MCP with all the powerful features from the hehe workflow.

## 🐛 Issues?

1. Check browser console (F12)
2. Review server logs
3. See `MIGRATION_GUIDE.md` troubleshooting section

**Enjoy your enhanced feedback workflow! 🚀**
