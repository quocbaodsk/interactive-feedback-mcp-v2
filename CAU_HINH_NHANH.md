# ⚡ Cấu Hình Nhanh - Interactive Feedback MCP

## 🚀 3 Bước Để Bắt Đầu

### 1️⃣ Cài Đặt Dependencies

```bash
cd /Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2
npm install
```

### 2️⃣ Cấu Hình Cursor MCP

**Mở Cursor MCP Settings**:

- `Cmd + Shift + P` → gõ "MCP Settings"

**Copy & Paste cấu hình sau**:

```json
{
  "mcpServers": {
    "interactive-feedback-mcp": {
      "command": "node",
      "args": ["/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/mcp-lightweight.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_LOG_LEVEL": "error"
      },
      "timeout": 60000,
      "cwd": "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2"
    }
  }
}
```

**⚠️ LƯU Ý**: Thay đường dẫn `/Users/quocbao/...` bằng đường dẫn thực tế của bạn!

**Reload Cursor**:

- `Cmd + Shift + P` → "Reload Window"

### 3️⃣ Sử Dụng

**Trong Cursor, nói với AI**:

```
Hãy call interactive feedback để hỏi tôi về code vừa viết
```

**Hoặc**:

```
Call MCP feedback tool để xác nhận
```

**AI sẽ tự động**:

1. Mở trình duyệt
2. Hiển thị giao diện terminal
3. Đợi phản hồi của bạn

---

## 🎤 (Tùy Chọn) Cấu Hình Speech-to-Text

**Nếu muốn dùng tính năng ghi âm giọng nói:**

1. **Tạo file `.env`**:

```bash
touch .env
```

2. **Thêm API key**:

```env
OPENAI_API_KEY=sk-your_api_key_here
WHISPER_LANGUAGE=vi
```

3. **Lấy API key**:
   - Truy cập: https://platform.openai.com/api-keys
   - Tạo key mới
   - Copy & paste vào `.env`

---

## 🎯 Tính Năng Chính

| Tính Năng             | Mô Tả            | Cách Dùng                 |
| --------------------- | ---------------- | ------------------------- |
| **File Picker**       | Chọn files nhanh | Gõ `@` trong feedback box |
| **Speech-to-Text**    | Ghi âm giọng nói | Click 🎤                  |
| **Command Execution** | Chạy lệnh        | Click "Show" → nhập lệnh  |
| **Markdown Support**  | Format đẹp       | Tự động                   |
| **Language Switch**   | Đổi ngôn ngữ     | Click EN/VI               |

---

## 🐛 Xử Lý Lỗi Nhanh

### ❌ "MCP Server Not Found"

```bash
# Test server
node src/mcp-lightweight.js

# Reload Cursor
Cmd + Shift + P → Reload Window
```

### ❌ "OpenAI API Key Not Configured"

```bash
# Tạo .env file
echo "OPENAI_API_KEY=sk-your_key" > .env
```

### ❌ File Picker không hoạt động

```bash
# Check server đang chạy
lsof -i :8888

# Restart nếu cần
```

---

## 📖 Tài Liệu Đầy Đủ

Xem chi tiết tại: **`HUONG_DAN_SU_DUNG.md`**

---

## ✅ Checklist

- [ ] Đã chạy `npm install`
- [ ] Đã cấu hình MCP trong Cursor
- [ ] Đã reload Cursor window
- [ ] Đã test gọi tool từ AI
- [ ] (Tùy chọn) Đã setup OpenAI API key

---

**🎉 Xong! Bây giờ bạn có thể sử dụng Interactive Feedback MCP!**

💡 **Pro tip**: Nói với AI "call feedback khi xong" để AI tự động hỏi bạn sau khi hoàn thành task.
