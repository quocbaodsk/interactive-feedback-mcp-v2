# 🧪 Test Workflow - Interactive Feedback MCP

## 🎯 Kiểm Tra Luồng Hoạt Động

### Test 1: Kiểm Tra MCP Server Nhận Tool Call

Khi AI gọi tool, MCP server sẽ nhận được:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "interactive_feedback",
    "arguments": {
      "project_directory": "/path/to/project",
      "summary": "Câu hỏi hoặc context từ AI"
    }
  }
}
```

**Cách test**:
```bash
# Chạy MCP server trực tiếp
node src/mcp-lightweight.js

# Gửi test request (trong terminal khác)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"interactive_feedback","arguments":{"project_directory":"/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2","summary":"Test: Bạn thấy code thế nào?"}}}' | node src/mcp-lightweight.js
```

---

### Test 2: Kiểm Tra Feedback UI Server

```bash
# Test trực tiếp feedback UI server
node src/feedback-ui-server.js \
  --project-directory "/Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2" \
  --summary "Test prompt: Bạn có muốn tiếp tục không?" \
  --output-file "/tmp/test-feedback.json"
```

**Kết quả mong đợi**:
1. Browser mở tại `http://127.0.0.1:38XX`
2. UI hiển thị prompt: "Test prompt: Bạn có muốn tiếp tục không?"
3. Sau khi submit feedback, file `/tmp/test-feedback.json` được tạo

---

### Test 3: Kiểm Tra Frontend Nhận Config

```bash
# 1. Start server
node src/feedback-ui-server.js \
  --project-directory "$PWD" \
  --summary "Test markdown:\n\n# Hello\n\nThis is **bold** text" \
  --output-file "/tmp/test.json"

# 2. Trong browser DevTools Console, chạy:
fetch('/api/config')
  .then(r => r.json())
  .then(data => {
    console.log('Config received:', data);
    console.log('Prompt:', data.prompt);
  });
```

---

### Test 4: Kiểm Tra Submit Feedback

```bash
# Trong browser DevTools Console:
fetch('/api/submit-feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    feedback: 'Test feedback: Code looks good!'
  })
})
.then(r => r.json())
.then(data => console.log('Result:', data));

# Sau đó check file output:
cat /tmp/test-feedback.json
```

**Kết quả mong đợi**:
```json
{
  "command_logs": "Interactive feedback session completed successfully",
  "interactive_feedback": "Test feedback: Code looks good!",
  "session_completed": true,
  "timestamp": "2025-11-28T..."
}
```

---

## 🔍 Debug Common Issues

### Issue 1: Prompt Không Hiển Thị

**Nguyên nhân có thể**:
1. AI gọi tool nhưng `summary` bị rỗng hoặc undefined
2. Frontend không fetch `/api/config` thành công
3. Markdown renderer bị lỗi

**Cách debug**:
```javascript
// Trong browser Console:
console.log('Prompt element:', document.getElementById('prompt-text'));
console.log('Prompt content:', document.getElementById('prompt-text').innerHTML);

// Check config
fetch('/api/config')
  .then(r => r.json())
  .then(data => console.table(data));
```

---

### Issue 2: Feedback Không Được AI Nhận

**Nguyên nhân có thể**:
1. Output file không được ghi đúng
2. MCP server không đọc được file
3. Format JSON không đúng

**Cách debug**:
```bash
# Check logs của MCP server
# Trong terminal chạy MCP server, bạn sẽ thấy:
# "✅ Feedback result loaded"
# "📤 Sent MCP response"

# Check output file
ls -la /tmp/feedback-*.json
cat /tmp/feedback-*.json | jq .
```

---

### Issue 3: WebSocket Không Kết Nối

**Nguyên nhân**:
- Port bị block
- CORS issue
- WebSocket không được support

**Cách fix**:
```javascript
// Trong browser Console:
const ws = new WebSocket(`ws://${location.host}`);
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (e) => console.error('❌ WebSocket error:', e);
ws.onmessage = (e) => console.log('📨 Message:', JSON.parse(e.data));
```

---

## 🎬 Full End-to-End Test

### Step 1: Prepare Environment

```bash
cd /Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2

# Make sure dependencies are installed
npm install

# Make sure OpenAI key is set (optional, for speech-to-text)
cat .env | grep OPENAI_API_KEY
```

---

### Step 2: Test MCP Tool Directly

```bash
# Create test script
cat > test-mcp-tool.js << 'EOF'
import { spawn } from 'child_process';

const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'interactive_feedback',
    arguments: {
      project_directory: process.cwd(),
      summary: `# Test Feedback Request

Tôi vừa update code. Bạn có muốn:
1. **Continue** - Tiếp tục implement
2. **Review** - Review code
3. **Test** - Chạy tests

Hãy cho tôi biết ý kiến của bạn.`
    }
  }
};

console.log('📤 Sending test request to MCP server...');
console.log(JSON.stringify(testRequest, null, 2));

const mcpProcess = spawn('node', ['src/mcp-lightweight.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize request first
const initRequest = {
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');

// Wait a bit then send tool call
setTimeout(() => {
  mcpProcess.stdin.write(JSON.stringify(testRequest) + '\n');
}, 500);

// Listen for responses
mcpProcess.stdout.on('data', (data) => {
  console.log('📥 Received response:');
  console.log(data.toString());
});

mcpProcess.on('close', (code) => {
  console.log(`MCP process exited with code ${code}`);
});
EOF

# Run test
node test-mcp-tool.js
```

---

### Step 3: Manually Test UI

```bash
# Start UI server manually
node src/feedback-ui-server.js \
  --project-directory "$PWD" \
  --summary "**Test Manual UI**: Bạn có thích giao diện mới không?" \
  --output-file "/tmp/manual-test-feedback.json"

# Browser sẽ tự động mở
# Làm theo các bước:
# 1. Xem prompt có hiển thị đúng không
# 2. Gõ @ để test file picker
# 3. Click 🎤 để test speech-to-text (nếu có OpenAI key)
# 4. Nhập feedback và submit
# 5. Check output file: cat /tmp/manual-test-feedback.json
```

---

### Step 4: Test Trong Cursor

1. **Mở Cursor**
2. **Chat với AI**:

```
Hãy call interactive_feedback tool với:
- project_directory: /Users/quocbao/Documents/Workspaces/NodeJS/interactive-feedback-mcp-v2
- summary: "Test từ Cursor: Code vừa viết có ổn không?"
```

3. **Verify**:
   - Browser tự động mở
   - Prompt hiển thị: "Test từ Cursor: Code vừa viết có ổn không?"
   - Nhập feedback: "Code tốt, cần thêm error handling"
   - Submit
   - AI nhận được feedback và reply

---

## 🐛 Troubleshooting Checklist

### Trước khi test:
- [ ] `npm install` đã chạy thành công
- [ ] MCP config đã được add vào Cursor
- [ ] Cursor đã được reload
- [ ] Port 3800-3900 không bị chiếm

### Trong quá trình test:
- [ ] Check browser DevTools Console (F12)
- [ ] Check Network tab xem API calls
- [ ] Check MCP server logs
- [ ] Check output file được tạo

### Nếu có lỗi:
- [ ] Đọc error message trong Console
- [ ] Check logs: `ls -la storage/logs/`
- [ ] Verify file permissions: `ls -la src/`
- [ ] Test lại từng bước riêng lẻ

---

## 📊 Expected Behavior

### ✅ Success Indicators:
1. MCP server không crash
2. Browser mở được
3. UI hiển thị prompt đúng
4. File picker hoạt động (gõ @)
5. Submit feedback thành công
6. Output file được tạo
7. AI nhận được feedback

### ❌ Failure Indicators:
1. Browser không mở
2. UI hiển thị "Loading..."
3. Console có errors
4. Submit không response
5. Output file không tạo
6. AI timeout

---

## 🎯 Next Steps

Nếu tất cả tests pass:
- ✅ System hoạt động tốt
- Có thể deploy/sử dụng

Nếu có test fail:
1. Note lại test nào fail
2. Copy error messages
3. Share để tôi fix

---

**🔥 Quick Test Command**:

```bash
# One-liner để test nhanh
node src/feedback-ui-server.js \
  --project-directory "$PWD" \
  --summary "Quick test: Type your feedback" \
  --output-file "/tmp/quicktest.json" && \
sleep 5 && \
echo "Check file:" && \
cat /tmp/quicktest.json 2>/dev/null || echo "Not created yet (waiting for feedback...)"
```

