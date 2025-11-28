# MCP Server Configuration Files

Thư mục này chứa các file cấu hình mẫu cho Interactive Feedback MCP Server.

## 📁 Files Trong Thư mục

### Configuration Files
- **`vscode-settings.json`** - Cấu hình cho VSCode
- **`cursor-mcp-config.json`** - Cấu hình cho Cursor  
- **`windsurf-mcp.json`** - Cấu hình cho Windsurf
- **`mcp-servers-config.json`** - File tổng hợp tất cả cấu hình

### Documentation
- **`MCP_SETUP_GUIDE.md`** - Hướng dẫn chi tiết cài đặt và sử dụng
- **`README.md`** - File này

## 🚀 Quick Start

### 1. Chọn Editor
Chọn file cấu hình phù hợp với editor bạn sử dụng:

| Editor | Configuration File |
|--------|-------------------|
| VSCode | `vscode-settings.json` |
| Cursor | `cursor-mcp-config.json` |
| Windsurf | `windsurf-mcp.json` |

### 2. Cập Nhật Đường Dẫn
Thay thế placeholder path bằng đường dẫn thực tế:
```
REPLACE_WITH_YOUR_PATH → /Users/your-username/path/to/project
```

### 3. Copy Cấu Hình
Copy nội dung từ file tương ứng vào settings của editor.

## ⚙️ Example Usage

### VSCode
```json
{
  "mcpServers": {
    "interactive-feedback": {
      "command": "node",
      "args": [
        "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/main.js",
        "--mode", 
        "mcp-server"
      ]
    }
  }
}
```

### Cursor  
```json
{
  "mcpServers": {
    "interactive-feedback-mcp": {
      "command": "node",
      "args": [
        "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/main.js",
        "--mode", 
        "mcp-server",
        "--project-directory",
        "{{workspaceFolder}}"
      ]
    }
  }
}
```

## 🔧 Customization

### Environment Variables
Có thể thêm các biến môi trường:
```json
"env": {
  "NODE_ENV": "production",
  "MCP_LOG_LEVEL": "debug",
  "MCP_DEBUG": "true"
}
```

### Command Line Arguments
Có thể thêm các tham số:
```json
"args": [
  "src/main.js",
  "--mode", "mcp-server",
  "--port", "3637",
  "--config", "custom-config.json"
]
```

## 📖 Documentation

Để biết thêm chi tiết, xem:
- **[MCP_SETUP_GUIDE.md](./MCP_SETUP_GUIDE.md)** - Hướng dẫn đầy đủ
- **[../README.md](../README.md)** - Project documentation

## 🆘 Troubleshooting

### Common Issues
1. **Path không đúng** → Kiểm tra đường dẫn absolute
2. **Node.js không tìm thấy** → Đảm bảo Node.js đã cài đặt
3. **Permission denied** → `chmod +x src/main.js`

### Getting Help
- Kiểm tra logs tại `../storage/logs/`
- Test server: `node src/main.js --mode mcp-server`
- Debug mode: `node src/main.js --mode mcp-server --debug`
