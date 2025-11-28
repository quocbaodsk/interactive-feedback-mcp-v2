# Hướng Dẫn Cài Đặt MCP Server cho VSCode, Cursor và Windsurf

## Giới Thiệu

Interactive Feedback MCP Server là một server MCP (Model Context Protocol) cho phép các AI assistant tương tác và thực hiện phản hồi trên các dự án một cách an toàn.

## 🚨 IMPORTANT: Cursor Fix

**Nếu gặp lỗi JSON-RPC hoặc security config trong Cursor, xem: [`CURSOR_FIX.md`](../CURSOR_FIX.md)**

## Cài Đặt Cho Các Editor

### 1. VSCode

#### Bước 1: Cài đặt extension MCP

```bash
code --install-extension modelcontextprotocol.mcp
```

#### Bước 2: Cấu hình trong settings.json

Mở `Command Palette` (`Ctrl/Cmd + Shift + P`) → `Preferences: Open Settings (JSON)`

Thêm cấu hình sau:

```json
{
  "mcpServers": {
    "interactive-feedback": {
      "command": "node",
      "args": ["src/mcp-lightweight.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 2. Cursor

#### Bước 1: Mở cài đặt MCP

1. Mở Cursor
2. Nhấn `Ctrl/Cmd + Shift + P`
3. Tìm "MCP: Configure Servers"

#### Bước 2: Thêm cấu hình

Sử dụng file `cursor-mcp-config.json`:

```json
{
  "mcpServers": {
    "interactive-feedback-mcp": {
      "command": "node",
      "args": ["/path/to/your/interactive-feedback-mcp-v2/src/main.js", "--mode", "mcp-server", "--project-directory", "{{workspaceFolder}}"],
      "env": {
        "NODE_ENV": "production",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

### 3. Windsurf

#### Bước 1: Cấu hình MCP

1. Mở Windsurf
2. Vào Settings → Extensions → MCP

#### Bước 2: Thêm server

Sử dụng file `windsurf-mcp.json`:

```json
{
  "mcpServers": {
    "interactive-feedback": {
      "command": "node",
      "args": ["src/mcp-lightweight.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_DEBUG": "false"
      }
    }
  }
}
```

## Cài Đặt Thủ Công

### Bước 1: Chuẩn bị project

```bash
# Clone project (nếu chưa có)
git clone <repository-url>
cd interactive-feedback-mcp-v2

# Cài đặt dependencies
npm install
# hoặc
yarn install
```

### Bước 2: Kiểm tra server hoạt động

```bash
# Test server
yarn start --mode mcp-server

# Hoặc
node src/main.js --mode mcp-server
```

### Bước 3: Cập nhật đường dẫn

Thay đổi `/path/to/your/interactive-feedback-mcp-v2` trong các file cấu hình thành đường dẫn thật của project.

## Sử Dụng

### Tools Có Sẵn

#### 1. interactive_feedback

Công cụ chính để yêu cầu phản hồi tương tác cho project:

**Tham số:**

- `project_directory` (string): Đường dẫn tới thư mục dự án
- `summary` (string): Tóm tắt yêu cầu hoặc ngữ cảnh

**✨ Tính Năng Mới: Interactive Feedback Workflow**
Khi tool này được gọi, hệ thống sẽ thực hiện workflow hoàn chỉnh:

- 🚀 MCP server spawn feedback UI process
- 🌐 Mở browser với giao diện feedback chuyên dụng
- 📝 Hiển thị AI summary và cho phép user nhập phản hồi
- ⏳ **MCP server WAIT cho user response** (không return ngay)
- 💬 User submit feedback trong UI
- 🔄 Tab tự động đóng sau khi submit
- ✅ MCP server return final result về cho AI agent

**Workflow Process:**

```
Agent calls tool → UI opens → User responds → Tab closes → Agent gets result
```

**Ví dụ sử dụng:**

```
Sử dụng tool interactive_feedback với:
- project_directory: "/path/to/my/project"
- summary: "Tôi đã implement feature XYZ. Xin hãy review và feedback."

→ Feedback UI sẽ mở: http://localhost:3800+
→ User nhập feedback: "Feature tốt, hãy thêm error handling"
→ Tab tự động đóng
→ Agent nhận được: { interactive_feedback: "Feature tốt, hãy thêm error handling" }
```

### Tính Năng Bảo Mật

- ✅ Validation đầu vào
- ✅ Audit logging
- ✅ Kiểm tra quyền truy cập file
- ✅ Sandbox execution
- ✅ Rate limiting

## Khắc Phục Sự Cố

### Lỗi Thường Gặp

#### 1. "MCPServer is not defined"

```bash
# Đảm bảo đã cài đặt dependencies
npm install
```

#### 2. "Permission denied"

```bash
# Kiểm tra quyền thực thi
chmod +x src/main.js
```

#### 3. "Port already in use"

```bash
# Sử dụng port khác
node src/main.js --mode mcp-server --port 3637
```

### Debug Mode

Để bật debug mode:

```bash
node src/main.js --mode mcp-server --debug
```

### Logs

Kiểm tra logs tại:

- `storage/logs/app.log` - Application logs
- `storage/logs/audit.log` - Security audit logs

## Cấu Hình Nâng Cao

### Environment Variables

```bash
export NODE_ENV=production
export MCP_LOG_LEVEL=debug
export PROJECT_ROOT=/path/to/project
```

### Custom Config

```bash
node src/main.js --config custom-config.json --mode mcp-server
```

## Hỗ Trợ

Nếu gặp vấn đề, hãy:

1. Kiểm tra logs
2. Đảm bảo tất cả dependencies đã được cài đặt
3. Xác minh đường dẫn trong cấu hình
4. Test server độc lập trước khi tích hợp với editor

## Test Tích Hợp Web UI

### Quick Test

```bash
# Test complete interactive feedback workflow
node configs/test-feedback-workflow.js
```

Script này test workflow hoàn chỉnh:

1. ✅ Khởi động MCP server
2. ✅ Gửi tool call `interactive_feedback`
3. ✅ Tự động mở feedback UI trong browser
4. ✅ Wait for user feedback submission
5. ✅ Return final result to agent

### Test Thủ Công

```bash
# 1. Start MCP server
node src/mcp-lightweight.js

# 2. Trong terminal khác, test tool call
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node src/mcp-lightweight.js
```

### Expected Behavior

Khi agent gọi tool `interactive_feedback`:

- 🚀 MCP server spawn feedback UI process
- 🌐 Browser tự động mở feedback UI (dedicated)
- 📝 Hiển thị AI summary và feedback form
- ⏳ MCP server WAIT for user response (blocking call)
- 💬 User submits feedback
- 🔄 Tab auto-closes after submission
- ✅ Agent receives complete feedback result

## Phiên Bản

- **Current Version**: 2.0.0
- **MCP Protocol**: 2024-11-05
- **Node.js**: >=18.0.0
- **New Feature**: Auto Web UI Launch 🚀
