# Hướng Dẫn Sử Dụng Interactive Feedback MCP

## 📋 Mục Lục

1. [Giới Thiệu](#giới-thiệu)
2. [Cài Đặt](#cài-đặt)
3. [Cấu Hình MCP Server](#cấu-hình-mcp-server)
4. [Sử Dụng Công Cụ](#sử-dụng-công-cụ)
5. [Tính Năng Nâng Cao](#tính-năng-nâng-cao)
6. [Xử Lý Lỗi](#xử-lý-lỗi)

---

## 🎯 Giới Thiệu

Interactive Feedback MCP là một công cụ mạnh mẽ cho phép AI (Claude, Cursor, v.v.) thu thập phản hồi tương tác từ bạn thông qua giao diện web terminal hiện đại.

### Tính Năng Chính:

- ✅ Giao diện terminal hiện đại (theme tối)
- ✅ Chuyển đổi ngôn ngữ (Tiếng Anh ↔ Tiếng Việt)
- ✅ File picker thông minh (gõ `@` để duyệt files)
- ✅ Speech-to-text (ghi âm giọng nói)
- ✅ Thực thi lệnh với output real-time
- ✅ Hỗ trợ Markdown trong prompt

---

## 🚀 Cài Đặt

### Bước 1: Cài Đặt Dependencies

```bash
cd /Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2
npm install
```

Dependencies được cài:

- `express` - Web server
- `ws` - WebSocket
- `multer` - Upload file
- `openai` - Speech-to-text
- `dotenv` - Quản lý environment variables

### Bước 2: Cấu Hình OpenAI (Tùy Chọn)

Nếu bạn muốn dùng tính năng **Speech-to-Text** (ghi âm giọng nói):

1. **Tạo file `.env`** trong thư mục gốc:

```bash
touch .env
```

2. **Thêm API key** vào file `.env`:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your_api_key_here
WHISPER_LANGUAGE=vi
```

3. **Lấy API key**:
   - Truy cập: https://platform.openai.com/api-keys
   - Đăng nhập hoặc tạo tài khoản
   - Tạo API key mới
   - Copy key (bắt đầu bằng `sk-`)

**Lưu ý**: Nếu không cấu hình OpenAI, các tính năng khác vẫn hoạt động bình thường, chỉ có Speech-to-Text bị vô hiệu hóa.

---

## ⚙️ Cấu Hình MCP Server

### Cấu Hình Cho Cursor

#### Cách 1: Sử Dụng File Có Sẵn

File cấu hình mẫu đã có tại: `configs/cursor-mcp-config.json`

```json
{
  "mcpServers": {
    "interactive-feedback-mcp": {
      "command": "node",
      "args": ["src/mcp-lightweight.js"],
      "env": {
        "NODE_ENV": "production",
        "NODE_OPTIONS": "--no-warnings --no-deprecation",
        "MCP_LOG_LEVEL": "error"
      },
      "timeout": 60000,
      "cwd": "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2"
    }
  }
}
```

#### Cách 2: Cấu Hình Thủ Công

**Bước 1**: Mở Cursor Settings

- Nhấn `Cmd + Shift + P` (macOS) hoặc `Ctrl + Shift + P` (Windows/Linux)
- Gõ: "MCP Settings" hoặc "Model Context Protocol"
- Chọn: "Preferences: Open MCP Settings"

**Bước 2**: Thêm Configuration

Thêm cấu hình sau vào MCP Settings:

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

**Lưu ý**: Thay đổi đường dẫn (`/Users/quocbao/...`) thành đường dẫn thực tế đến project của bạn.

**Bước 3**: Reload Cursor

- Nhấn `Cmd + Shift + P` (macOS) hoặc `Ctrl + Shift + P` (Windows/Linux)
- Gõ: "Developer: Reload Window"
- Chọn để reload

### Cấu Hình Cho VSCode

Thêm vào `settings.json`:

```json
{
  "mcpServers": {
    "interactive-feedback": {
      "command": "node",
      "args": ["/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/mcp-lightweight.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Cấu Hình Cho Windsurf

Thêm vào Windsurf MCP Settings:

```json
{
  "mcpServers": {
    "interactive-feedback": {
      "command": "node",
      "args": ["/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2/src/mcp-lightweight.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_DEBUG": "false"
      }
    }
  }
}
```

---

## 🎮 Sử Dụng Công Cụ

### Cách Gọi Tool Từ AI

Khi nói chuyện với AI (Claude trong Cursor), bạn có thể yêu cầu:

**Ví dụ 1**: Yêu cầu phản hồi đơn giản

```
Hãy gọi interactive feedback để hỏi tôi về code vừa viết
```

**Ví dụ 2**: Yêu cầu với context cụ thể

```
Tôi vừa cập nhật UI, hãy call MCP interactive feedback để hỏi xem UI có ổn không
```

**Ví dụ 3**: Sau khi hoàn thành task

```
Hãy call interactive_feedback để xác nhận xem tôi có muốn tiếp tục không
```

### AI Sẽ Tự Động:

1. Gọi tool `interactive_feedback`
2. Mở trình duyệt với giao diện terminal
3. Hiển thị prompt/câu hỏi
4. Đợi bạn nhập phản hồi
5. Nhận và xử lý phản hồi của bạn

---

## 🎨 Sử Dụng Giao Diện

### Giao Diện Terminal

Khi AI gọi tool, một cửa sổ trình duyệt sẽ mở với giao diện terminal:

```
┌─────────────────────────────────────────┐
│ ● ● ●  Interactive Feedback Terminal  EN│
├─────────────────────────────────────────┤
│ ~/project: /path/to/your/project        │
│                                         │
│ ┌─ Feedback Prompt ──────────────────┐ │
│ │ AI's question will appear here...  │ │
│ └────────────────────────────────────┘ │
│                                         │
│ feedback> _                             │
│ [Your feedback here...]                 │
│                                         │
│ 🎤 Ready  Type @ to browse files       │
│                                         │
│ [Submit Feedback]                       │
└─────────────────────────────────────────┘
```

### Các Tính Năng UI

#### 1. Chuyển Đổi Ngôn Ngữ

- Click nút **"EN"** hoặc **"VI"** ở góc phải trên
- Giao diện tự động chuyển đổi
- Ngôn ngữ được lưu trong trình duyệt

#### 2. File Picker Thông Minh

- Gõ ký tự `@` trong ô feedback
- File picker tự động hiện ra
- Gõ tên file để tìm kiếm (fuzzy search)
- Sử dụng phím tắt:
  - `↑↓` - Di chuyển lên/xuống
  - `Enter` - Chọn file hoặc mở folder
  - `Shift + Click` - Chọn nhiều file
  - `Esc` - Đóng file picker

**Ví dụ**:

```
@src/app
→ Tự động gợi ý: src/app.js, src/app.css, src/app-config.js
```

#### 3. Speech-to-Text (Ghi Âm)

- Click nút **🎤** (microphone)
- Cho phép trình duyệt truy cập mic (lần đầu)
- Nói nội dung feedback
- Click 🎤 lần nữa để dừng
- Đợi 2-5 giây cho transcription
- Text xuất hiện trong ô feedback

**Lưu ý**: Cần cấu hình OpenAI API key (xem phần [Cài Đặt](#cài-đặt))

#### 4. Command Execution (Chạy Lệnh)

- Click **"Show"** để mở phần command
- Nhập lệnh (ví dụ: `npm run build`)
- Click **"Run"** để thực thi
- Xem output real-time trong console
- Click **"Stop"** để dừng nếu cần

**Ví dụ**:

```bash
$ npm run test
Running tests...
✓ All tests passed
```

#### 5. Submit Feedback

- Nhập feedback vào textarea
- Có thể dùng file picker (`@`) để thêm file paths
- Có thể dùng speech-to-text (🎤) để ghi âm
- Click **"Submit Feedback"** để gửi
- Cửa sổ tự động đóng sau 2 giây

---

## 🔥 Tính Năng Nâng Cao

### Auto MCP Request

Checkbox **"Automatically add MCP feedback request"** được bật mặc định.

Khi bật, tự động thêm dòng sau vào feedback:

```
Hãy call mcp Feedback khi giải quyết xong vấn đề trên.
```

Điều này giúp AI biết cần gọi lại tool để xác nhận sau khi hoàn thành.

### Markdown Support

Prompt từ AI hỗ trợ Markdown formatting:

````markdown
# Câu Hỏi

Bạn muốn tôi làm gì tiếp theo?

## Các Lựa Chọn:

1. **Tiếp tục** - Implement thêm tính năng
2. **Review** - Kiểm tra code hiện tại
3. **Test** - Chạy tests

Code example:

```javascript
console.log('Hello World')
```
````

```

### Command History

Commands bạn đã chạy được lưu lại và có thể tái sử dụng.

### Multi-File Selection

Khi dùng file picker:
1. Giữ `Shift` và click để chọn nhiều file
2. Status bar hiện: "X files selected"
3. Nhấn `Esc` để insert tất cả files

---

## 🐛 Xử Lý Lỗi

### Lỗi: "MCP Server Not Found"

**Nguyên nhân**: Cursor không tìm thấy MCP server

**Giải pháp**:
1. Kiểm tra đường dẫn trong config
2. Chạy thử: `node src/mcp-lightweight.js`
3. Reload Cursor (`Cmd/Ctrl + Shift + P` → "Reload Window")

### Lỗi: "OpenAI API Key Not Configured"

**Nguyên nhân**: Chưa có OpenAI API key hoặc sai format

**Giải pháp**:
1. Tạo file `.env` trong project root
2. Thêm: `OPENAI_API_KEY=sk-your_key_here`
3. Verify key bắt đầu với `sk-`
4. Restart MCP server

### Lỗi: "Failed to Transcribe Audio"

**Nguyên nhân**: OpenAI API error hoặc hết credits

**Giải pháp**:
1. Check OpenAI account có credits
2. Verify API key còn hoạt động
3. Test internet connection
4. Check browser console (F12) cho error details

### Lỗi: "File Picker Not Opening"

**Nguyên nhân**: JavaScript error hoặc server không phản hồi

**Giải pháp**:
1. Mở Browser DevTools (F12)
2. Check Console tab cho errors
3. Check Network tab xem `/api/browse-files` có response
4. Verify server đang chạy

### Lỗi: "Command Execution Failed"

**Nguyên nhân**: Lệnh sai hoặc không có quyền

**Giải pháp**:
1. Verify command syntax
2. Check terminal có quyền thực thi
3. Xem console output để biết lỗi cụ thể

---

## 💡 Tips & Tricks

### 1. Sử Dụng Hiệu Quả

**Tốt**:
```

Tôi vừa update authentication flow.
Hãy call interactive feedback để hỏi:

- UI có dễ dùng không?
- Security có đủ tốt không?

```

**Không tốt**:
```

Làm gì đó

```

### 2. Keyboard Shortcuts

| Phím | Chức Năng |
|------|-----------|
| `@` | Mở file picker |
| `↑↓` | Navigate file picker |
| `Enter` | Select file/folder |
| `Esc` | Close file picker |
| `Shift + Click` | Multi-select files |
| `Cmd/Ctrl + Enter` | Submit feedback (trong textarea) |

### 3. Best Practices

1. **Viết feedback rõ ràng**: AI cần hiểu ý bạn muốn gì
2. **Dùng file picker**: Giúp AI biết file nào cần xử lý
3. **Check command output**: Xem log trước khi submit feedback
4. **Enable auto MCP request**: Để AI tự động follow up

---

## 📚 Tài Liệu Tham Khảo

- `QUICK_START.md` - Hướng dẫn nhanh (tiếng Anh)
- `MIGRATION_GUIDE.md` - Chi tiết tính năng (tiếng Anh)
- `OPENAI_SETUP.md` - Setup OpenAI chi tiết (tiếng Anh)
- `FEEDBACK_WORKFLOW.md` - Workflow gốc

---

## 🆘 Hỗ Trợ

### Vấn Đề Thường Gặp

**Q: Tôi không thấy tool trong Cursor?**
A: Reload Cursor window (`Cmd/Ctrl + Shift + P` → "Reload Window")

**Q: Speech-to-text không hoạt động?**
A: Cần cấu hình OpenAI API key trong `.env` file

**Q: File picker không hiện files?**
A: Check browser console (F12) xem có lỗi API không

**Q: Làm sao thay đổi ngôn ngữ mặc định?**
A: Click nút EN/VI trên header, ngôn ngữ được lưu tự động

### Liên Hệ

- GitHub Issues: [Report bugs](https://github.com/zivhdinfo/interactive-feedback-mcp)
- Email: nguyenhop530@gmail.com

---

## 🎉 Hoàn Thành!

Bây giờ bạn đã biết cách:
- ✅ Cài đặt và cấu hình MCP server
- ✅ Sử dụng trong Cursor/Claude
- ✅ Tận dụng các tính năng nâng cao
- ✅ Xử lý các lỗi thường gặp

**Chúc bạn sử dụng hiệu quả! 🚀**

```
