# 🎬 Interactive Feedback MCP - Workflow Visualization

## 📊 Tổng Quan Luồng Hoạt Động

```
┌─────────────┐
│   BẠN       │
│  (User)     │
└──────┬──────┘
       │
       │ "Call interactive feedback"
       ▼
┌─────────────────────┐
│   CURSOR / CLAUDE   │
│   (AI Assistant)    │
└──────┬──────────────┘
       │
       │ Gọi MCP Tool
       ▼
┌─────────────────────┐
│   MCP SERVER        │
│ (mcp-lightweight.js)│
└──────┬──────────────┘
       │
       │ Spawn process
       ▼
┌──────────────────────┐
│   WEB UI SERVER      │
│ (feedback-ui-server) │
└──────┬───────────────┘
       │
       │ Mở trình duyệt
       ▼
┌──────────────────────────┐
│   TERMINAL UI            │
│ ┌────────────────────┐   │
│ │ 🟢 🟡 🔴   EN/VI   │   │
│ ├────────────────────┤   │
│ │ ~/project: ...     │   │
│ │                    │   │
│ │ Feedback Prompt:   │   │
│ │ [Câu hỏi từ AI]   │   │
│ │                    │   │
│ │ feedback> _        │   │
│ │ [Your answer...]   │   │
│ │                    │   │
│ │ 🎤 @ 💾           │   │
│ │ [Submit] ──────────┼──┐│
│ └────────────────────┘  ││
└─────────────────────────┘│
                           │
          ┌────────────────┘
          │ Click Submit
          ▼
┌──────────────────────────┐
│   FEEDBACK RESULT        │
│ {                        │
│   feedback: "...",       │
│   timestamp: "..."       │
│ }                        │
└──────┬───────────────────┘
       │
       │ Return JSON
       ▼
┌──────────────────────────┐
│   AI RECEIVES FEEDBACK   │
│   Continue conversation  │
└──────────────────────────┘
```

---

## 🔄 Chi Tiết Các Bước

### Bước 1: Yêu Cầu Feedback

```
Bạn ──["Hãy call feedback"]──> AI
```

**Ví dụ**:

- "Call interactive feedback để hỏi tôi"
- "Hãy dùng MCP tool để xác nhận"
- "Request feedback về code vừa viết"

---

### Bước 2: AI Gọi MCP Tool

```json
{
  "tool": "interactive_feedback",
  "parameters": {
    "project_directory": "/path/to/project",
    "summary": "Bạn có hài lòng với code vừa viết không?"
  }
}
```

---

### Bước 3: MCP Server Xử Lý

```
MCP Server
  │
  ├─ Validate input
  ├─ Check security
  ├─ Spawn Web UI Server
  └─ Wait for result
```

---

### Bước 4: Web UI Mở

```
Browser Window Opens
┌─────────────────────────────────────┐
│ 🟢 🟡 🔴  Terminal         EN │ VI │
├─────────────────────────────────────┤
│                                     │
│  ~/project: /Users/you/project      │
│                                     │
│  ┌─ Feedback Prompt ─────────────┐ │
│  │                                │ │
│  │  Bạn có hài lòng với code     │ │
│  │  vừa viết không?              │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  feedback> _                        │
│  ┌──────────────────────────────┐  │
│  │ [Nhập phản hồi tại đây...]   │  │
│  │                              │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                     │
│  🎤 Ready   Type @ to browse files │
│                                     │
│  ☑ Auto add MCP feedback request   │
│                                     │
│  ┌──────────────────┐              │
│  │ Submit Feedback  │              │
│  └──────────────────┘              │
│                                     │
└─────────────────────────────────────┘
```

---

### Bước 5: Tương Tác Với UI

#### 5a. Nhập Text Bình Thường

```
feedback> Code looks good!
```

#### 5b. Dùng File Picker (gõ @)

```
feedback> @
┌─────────────────────────┐
│ 📁 File Picker          │
├─────────────────────────┤
│ 📂 src/                 │
│ 📂 public/              │
│ 📄 package.json         │
│ 📄 README.md            │
└─────────────────────────┘
```

#### 5c. Dùng Speech-to-Text (click 🎤)

```
[Click 🎤]
┌─────────────────────────┐
│ 🔴 Recording... 00:05   │
│ Speak now...            │
└─────────────────────────┘

[Click 🎤 again]
┌─────────────────────────┐
│ 🔄 Transcribing...      │
│ Please wait...          │
└─────────────────────────┘

[After 2-5s]
feedback> [Transcribed text appears here]
```

#### 5d. Chạy Command

```
[Click "Show" in Command section]

$ npm test
──────────────────────────
Running tests...
✓ Test 1 passed
✓ Test 2 passed
✓ All tests passed (2/2)
──────────────────────────
```

---

### Bước 6: Submit Feedback

```
[Click "Submit Feedback"]
┌─────────────────────────┐
│ ✅ Feedback submitted!  │
│                         │
│ Closing in 2s...        │
└─────────────────────────┘
```

---

### Bước 7: AI Nhận Kết Quả

```json
{
  "interactive_feedback": "Code looks good! @src/app.js needs refactoring",
  "session_completed": true,
  "timestamp": "2025-11-28T10:30:00.000Z"
}
```

---

### Bước 8: AI Tiếp Tục

```
AI: "Cảm ơn! Tôi hiểu rồi.
     Tôi sẽ refactor file src/app.js như bạn yêu cầu."

[AI proceeds to refactor src/app.js]
```

---

## 🎯 Các Luồng Tính Năng

### A. Luồng File Picker

```
Gõ @
  │
  ▼
Dropdown mở
  │
  ├─ Hiển thị files/folders
  ├─ Gõ để search (fuzzy)
  ├─ ↑↓ để navigate
  └─ Enter để select
      │
      ▼
File path inserted vào textarea
```

**Ví dụ**:

```
Input:  @app
Output: @src/app.js
        @src/app.css
        @config/app.config.js
```

---

### B. Luồng Speech-to-Text

```
Click 🎤
  │
  ├─ Request mic permission (lần đầu)
  │
  ▼
Recording starts
  │
  ├─ Show "🔴 Recording..."
  ├─ Timer đếm
  │
Click 🎤 again
  │
  ▼
Stop recording
  │
  ├─ Upload audio to /api/speech-to-text
  ├─ OpenAI Whisper transcribes
  │
  ▼
Text inserted vào textarea
```

**Timeline**:

```
00:00 - Click 🎤
00:01 - Start recording
00:10 - Click 🎤 again
00:11 - Uploading...
00:13 - Transcribing...
00:16 - Text appears ✓
```

---

### C. Luồng Command Execution

```
Click "Show"
  │
  ▼
Command panel visible
  │
Nhập command: "npm run build"
  │
Click "Run"
  │
  ▼
POST /api/run-command
  │
  ├─ Spawn child process
  ├─ Stream stdout/stderr via WebSocket
  │
  ▼
Real-time output in console
  │
Process exits
  │
  ▼
Show exit code
```

---

## 🔐 Security Flow

```
MCP Request
  │
  ▼
┌───────────────────┐
│ Security Checks   │
├───────────────────┤
│ ✓ Validate input  │
│ ✓ Check directory │
│ ✓ Sanitize paths  │
│ ✓ Rate limiting   │
│ ✓ CORS policy     │
└────────┬──────────┘
         │
         ├─ Pass ──> Execute
         │
         └─ Fail ──> Error 403
```

---

## 📡 WebSocket Communication

```
Browser                Server
  │                      │
  │─── Connect ─────────>│
  │<── Welcome ──────────│
  │                      │
  │                      │
  │<── session_info ─────│
  │<── log ──────────────│ (command output)
  │<── processStatus ────│
  │                      │
  │─── Submit ──────────>│
  │<── success ──────────│
  │                      │
  │─── Disconnect ───────│
```

**Message Types**:

- `session_info` - Project info
- `log` - Command output
- `processStatus` - Process running/stopped
- `success` - Feedback received

---

## 🌐 API Endpoints Map

```
GET  /                    → index.html (UI)
GET  /style.css           → CSS
GET  /script.js           → Frontend JS

GET  /api/config          → Get config
POST /api/config          → Save config

POST /api/run-command     → Execute command
POST /api/stop-command    → Stop command

GET  /api/browse-files    → List directory
POST /api/speech-to-text  → Transcribe audio

POST /api/feedback        → Submit feedback
```

---

## 🔄 State Management

```
┌────────────────────────┐
│   Application State    │
├────────────────────────┤
│ • projectDirectory     │
│ • currentLanguage      │
│ • isRecording          │
│ • selectedFiles[]      │
│ • commandProcess       │
│ • feedbackResult       │
└────────────────────────┘
         │
         ├─ Persist → localStorage (language)
         ├─ Memory → Server variables
         └─ File → feedback.json
```

---

## 🎨 UI Component Hierarchy

```
terminal-container
│
├─ terminal-header
│  ├─ terminal-controls (● ● ●)
│  ├─ terminal-title
│  └─ terminal-actions (EN/VI)
│
├─ terminal-body
│  │
│  ├─ project-directory
│  │
│  ├─ command-section (collapsible)
│  │  ├─ command-input
│  │  ├─ run-btn
│  │  └─ console-output
│  │
│  └─ feedback-section
│     ├─ prompt-window (AI's question)
│     └─ feedback-input-area
│        ├─ textarea
│        ├─ speech-controls (🎤)
│        ├─ file-picker (@)
│        └─ submit-btn
│
└─ terminal-footer
```

---

## 💾 Data Flow

```
User Input
    │
    ▼
Frontend JS (script.js)
    │
    ├─ Validate
    ├─ Format
    │
    ▼
API Request (fetch)
    │
    ▼
Express Server (feedback-ui-server.js)
    │
    ├─ Process
    ├─ Validate
    │
    ▼
File System / OpenAI / WebSocket
    │
    ▼
Response
    │
    ▼
Frontend Update
    │
    ▼
User Sees Result
```

---

## 🚀 Complete Example Scenario

### Scenario: AI cần xác nhận UI design

```
┌────────────────────────────────────────┐
│ STEP 1: User talks to AI              │
├────────────────────────────────────────┤
│ User: "Hãy call feedback để hỏi        │
│        xem UI có đẹp không"            │
└────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ STEP 2: AI calls MCP tool             │
├────────────────────────────────────────┤
│ tool: interactive_feedback             │
│ summary: "Bạn có thích UI design       │
│           mới không?"                  │
└────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ STEP 3: Browser opens                 │
├────────────────────────────────────────┤
│ [Terminal UI appears]                  │
│ Shows: "Bạn có thích UI design mới?"  │
└────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ STEP 4: User interacts                │
├────────────────────────────────────────┤
│ • Gõ @public/style.css                 │
│ • Nói: "Màu sắc tốt nhưng font nhỏ"   │
│ • Click Submit                         │
└────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ STEP 5: AI receives                   │
├────────────────────────────────────────┤
│ feedback: "Màu sắc tốt nhưng font nhỏ │
│            @public/style.css"          │
└────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ STEP 6: AI continues                  │
├────────────────────────────────────────┤
│ AI: "Tôi sẽ tăng font size trong      │
│      style.css. Let me update..."     │
│                                        │
│ [AI edits style.css]                   │
│ [AI calls feedback again to confirm]   │
└────────────────────────────────────────┘
```

---

## 📈 Performance Metrics

```
Metric                  Target      Actual
─────────────────────────────────────────
Server startup          < 1s        ~0.5s
Browser open            < 2s        ~1.5s
UI render               < 1s        ~0.8s
File picker response    < 500ms     ~300ms
Speech-to-text          < 10s       ~3-5s
Feedback submission     < 1s        ~500ms
```

---

## 🎓 Learning Path

### Beginner (5 phút)

1. Đọc `CAU_HINH_NHANH.md`
2. Cài đặt & cấu hình
3. Test gọi tool lần đầu

### Intermediate (15 phút)

1. Đọc `HUONG_DAN_SU_DUNG.md`
2. Thử file picker
3. Thử command execution

### Advanced (30 phút)

1. Setup OpenAI speech-to-text
2. Đọc source code
3. Customize workflow

---

**🎉 Bây giờ bạn đã hiểu rõ workflow! Hãy bắt đầu sử dụng!**
