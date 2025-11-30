# Hướng dẫn cấu hình Logging cho MCP Servers

## Mục tiêu

Cấu hình MCP Servers để chỉ lưu logs lỗi thay vì lưu tất cả logs, giúp giảm dung lượng lưu trữ và tập trung vào các vấn đề quan trọng.

## Các loại logs trong hệ thống

1. **app.log** - Logs ứng dụng chung (info, warn, error, debug)
2. **error.log** - Chỉ logs lỗi
3. **audit.log** - Logs audit cho bảo mật

## Cấu hình đã được áp dụng

### 1. Cập nhật src/mcp-lightweight.js

```javascript
const mcpServer = new MCPServer(PROJECT_ROOT, {
  logging: {
    level: process.env.MCP_LOG_LEVEL || 'error',
    console: false, // Tắt console logging
    file: true, // Giữ file logging
    enableFile: true, // Bật file logging
    enableAudit: false, // Tắt audit logging
  },
})
```

### 2. Cập nhật src/shared/logger.js

Phương thức `log()` đã được cập nhật để chỉ ghi lỗi vào file:

```javascript
// File output - only for errors
if (this.config.enableFile && level === 'error') {
  this.logToFile(logEntry)
}
```

### 3. Cập nhật config/default-config.json

```json
"logging": {
  "level": "error",
  "console": false,
  "file": true,
  "enableAudit": false
}
```

## Cách sử dụng

### Khởi động MCP Server với logging chỉ lỗi

```bash
# Sử dụng cấu hình mặc định (đã được cập nhật)
node src/mcp-lightweight.js

# Hoặc chỉ định rõ ràng level log
MCP_LOG_LEVEL=error node src/mcp-lightweight.js
```

### Kiểm tra logs

```bash
# Xem logs lỗi
tail -f storage/logs/error.log

# File app.log sẽ chỉ chứa logs lỗi (trống nếu không có lỗi)
tail -f storage/logs/app.log

# File audit.log sẽ không được ghi nữa
ls -la storage/logs/audit.log
```

## Tùy chỉnh thêm

### Chỉ bật console logging khi cần debug

```javascript
// Trong src/mcp-lightweight.js
const mcpServer = new MCPServer(PROJECT_ROOT, {
  logging: {
    level: process.env.MCP_LOG_LEVEL || 'error',
    console: process.env.DEBUG === 'true', // Chỉ bật khi DEBUG=true
    file: true,
    enableFile: true,
    enableAudit: false,
  },
})
```

### Tùy chỉnh qua biến môi trường

```bash
# Bật console logging để debug
DEBUG=true MCP_LOG_LEVEL=error node src/mcp-lightweight.js

# Tắt hoàn toàn logging
MCP_LOG_LEVEL=none node src/mcp-lightweight.js
```

## Lợi ích

1. **Giảm dung lượng lưu trữ**: Chỉ lưu logs lỗi quan trọng
2. **Tập trung vào vấn đề**: Dễ dàng theo dõi lỗi mà không bị nhiễu bởi logs thông thường
3. **Hiệu năng tốt hơn**: Giảm I/O do ghi ít log hơn
4. **Dễ dàng debug**: Khi cần, có thể bật lại console logging tạm thời

## Khôi phục cấu hình mặc định

Nếu cần khôi phục lại cấu hình logging đầy đủ:

```bash
# Sử dụng level info để ghi tất cả logs
MCP_LOG_LEVEL=info node src/mcp-lightweight.js

# Hoặc bật lại audit logging
# Cần sửa lại trong src/mcp-lightweight.js: enableAudit: true
```
