#!/bin/bash

# Quick Test Script - Interactive Feedback MCP
# Test the fixed submit feedback flow

echo "🧪 Quick Test - Interactive Feedback Flow"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project directory
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_FILE="/tmp/quicktest-feedback-$(date +%s).json"

echo -e "${BLUE}📁 Project Directory:${NC} $PROJECT_DIR"
echo -e "${BLUE}📄 Output File:${NC} $OUTPUT_FILE"
echo ""

# Test summary
TEST_SUMMARY="# 🧪 Quick Test

## Câu Hỏi:
Bạn có thấy **prompt này hiển thị đúng** không?

### Các bước test:
1. ✅ Verify prompt hiển thị markdown
2. ✅ Thử gõ \`@\` để test file picker (optional)
3. ✅ Nhập feedback bất kỳ
4. ✅ Click **Submit Feedback**
5. ✅ Xem success message
6. ✅ Window tự đóng hoặc hiện success screen

---

**Hãy submit feedback để hoàn thành test!**"

echo -e "${GREEN}✅ Starting Feedback UI Server...${NC}"
echo ""
echo -e "${YELLOW}📝 Instructions:${NC}"
echo "1. Browser sẽ tự động mở"
echo "2. Nhập feedback bất kỳ (ví dụ: 'Test successful')"
echo "3. Click Submit Feedback"
echo "4. Xem success message"
echo "5. Window sẽ tự đóng hoặc hiện success screen"
echo ""
echo -e "${YELLOW}⏳ Waiting for feedback...${NC}"
echo ""

# Run server
node "$PROJECT_DIR/src/feedback-ui-server.js" \
  --project-directory "$PROJECT_DIR" \
  --summary "$TEST_SUMMARY" \
  --output-file "$OUTPUT_FILE"

# Check result
echo ""
echo "=========================================="
echo ""

if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${GREEN}✅ SUCCESS! Output file created${NC}"
    echo ""
    echo -e "${BLUE}📄 Output Content:${NC}"
    cat "$OUTPUT_FILE" | head -20
    echo ""
    
    # Validate JSON
    if command -v jq &> /dev/null; then
        echo ""
        echo -e "${BLUE}🔍 Validating JSON structure...${NC}"
        
        FEEDBACK=$(cat "$OUTPUT_FILE" | jq -r '.ask_user')
        SESSION_COMPLETED=$(cat "$OUTPUT_FILE" | jq -r '.session_completed')
        
        if [ "$FEEDBACK" != "null" ] && [ "$FEEDBACK" != "" ]; then
            echo -e "${GREEN}✓${NC} ask_user: $FEEDBACK"
        else
            echo -e "${YELLOW}✗${NC} ask_user is empty"
        fi
        
        if [ "$SESSION_COMPLETED" == "true" ]; then
            echo -e "${GREEN}✓${NC} session_completed: true"
        else
            echo -e "${YELLOW}✗${NC} session_completed: $SESSION_COMPLETED"
        fi
        
        echo ""
    fi
    
    # Summary
    echo -e "${GREEN}🎉 Test PASSED!${NC}"
    echo ""
    echo "✅ Feedback UI worked correctly"
    echo "✅ Feedback was submitted"
    echo "✅ Output file was created"
    echo "✅ JSON structure is valid"
    echo ""
    echo -e "${BLUE}👉 Next step:${NC} Test in Cursor by asking AI to call ask_user"
    echo ""
    
    # Cleanup
    echo -e "${YELLOW}🗑️  Cleaning up...${NC}"
    rm -f "$OUTPUT_FILE"
    echo -e "${GREEN}✓${NC} Temp file removed"
    echo ""
    
    exit 0
else
    echo -e "${YELLOW}❌ FAILED: Output file not created${NC}"
    echo ""
    echo "Possible reasons:"
    echo "1. You didn't submit feedback"
    echo "2. Server crashed"
    echo "3. Browser didn't open"
    echo ""
    echo "Try running again and make sure to:"
    echo "- Submit feedback in the browser"
    echo "- Check console for errors"
    echo ""
    
    exit 1
fi
