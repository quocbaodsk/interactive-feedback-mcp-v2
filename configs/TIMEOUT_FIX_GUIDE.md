# 🚑 MCP Server Timeout Fix Guide

## Vấn Đề: "MCP Server initialization timed out after 30 seconds"

### 🔍 Nguyên Nhân Phổ Biến

1. **Server khởi tạo chậm** - Do load nhiều modules
2. **Đường dẫn không chính xác** - File path sai
3. **Dependencies thiếu** - npm/yarn install chưa chạy
4. **Node.js version** - Version không tương thích
5. **Permissions** - Quyền truy cập file

### ✅ Giải Pháp Nhanh

#### 1. Sử dụng Lightweight Server (Khuyến Nghị)
Thay vì sử dụng `src/main.js`, hãy dùng server tối ưu:

**VSCode (settings.json):**
```json
{
  "mcpServers": {
    "interactive-feedback": {
      "command": "node",
      "args": [
        "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/mcp-lightweight.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "NODE_OPTIONS": "--no-deprecation",
        "MCP_LOG_LEVEL": "error"
      },
      "timeout": 60000,
      "cwd": "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2"
    }
  }
}
```

**Cursor:**
```json
{
  "mcpServers": {
    "interactive-feedback": {
      "command": "node",
      "args": [
        "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/mcp-lightweight.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "NODE_OPTIONS": "--no-deprecation",
        "MCP_LOG_LEVEL": "error"
      },
      "timeout": 45000
    }
  }
}
```

#### 2. Kiểm Tra Đường Dẫn
```bash
# Verify file exists
ls -la /Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/mcp-lightweight.js

# Test permissions
node /Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/mcp-lightweight.js &
```

#### 3. Test Server Độc Lập
```bash
cd /Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2

# Test lightweight server
node src/mcp-lightweight.js &
sleep 2
kill %1

# Test main server
node src/main.js --mode mcp-server &
sleep 2  
kill %1
```

### 🔧 Debug Steps

#### Step 1: Kiểm Tra Environment
```bash
# Node.js version (cần >=18)
node --version

# Dependencies
yarn install
# hoặc 
npm install
```

#### Step 2: Test Server Response
```bash
# Start server in background
node src/mcp-lightweight.js &
PID=$!

# Send test MCP message
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | nc -q 1 localhost 3636

# Kill server
kill $PID
```

#### Step 3: Check Logs
```bash
# Check application logs
tail -f storage/logs/app.log

# Check audit logs  
tail -f storage/logs/audit.log
```

### 📝 Cấu Hình Debug

Để debug timeout issue, sử dụng config này:

```json
{
  "mcpServers": {
    "interactive-feedback-debug": {
      "command": "node",
      "args": [
        "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/main.js",
        "--mode", 
        "mcp-server"
      ],
      "env": {
        "NODE_ENV": "development",
        "MCP_LOG_LEVEL": "debug",
        "DEBUG": "*"
      },
      "timeout": 90000,
      "cwd": "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2"
    }
  }
}
```

### 🎯 Optimizations Applied

#### Lightweight Server Features:
- ✅ **Faster imports** - Only load MCP server module
- ✅ **Minimal logging** - Reduce I/O operations  
- ✅ **No web server** - Skip unnecessary components
- ✅ **Error suppression** - Hide deprecation warnings
- ✅ **Quick startup** - <500ms initialization

#### Configuration Improvements:
- ✅ **Explicit timeouts** - 45-60 seconds instead of default 30
- ✅ **Working directory** - Explicit `cwd` setting
- ✅ **Environment variables** - Optimized Node.js options
- ✅ **Error handling** - Better process management

### 🚨 Troubleshooting Checklist

- [ ] Đường dẫn file chính xác
- [ ] Node.js version >=18
- [ ] Dependencies đã cài đặt (`yarn install`)
- [ ] File có quyền thực thi (`chmod +x`)
- [ ] Server test độc lập thành công
- [ ] Timeout được set > 30s
- [ ] Working directory đúng

### 💡 Tips

1. **Restart editor** sau khi thay đổi config
2. **Clear MCP cache** nếu có
3. **Use absolute paths** thay vì relative paths
4. **Check terminal output** để xem error messages
5. **Try lightweight server** trước khi dùng full server

### 📞 Nếu Vẫn Không Được

1. Check editor's MCP logs
2. Verify Node.js path: `which node`
3. Test với config tối thiểu
4. Restart editor hoàn toàn
5. Try different timeout values (60s, 90s)
