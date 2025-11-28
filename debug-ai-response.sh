#!/bin/bash

# Debug AI Response Script
# Verify AI receives correct feedback data

echo "🔍 Debug AI Response - Verify Feedback Data"
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get project directory
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_FILE="/tmp/debug-feedback-$(date +%s).json"

echo -e "${BLUE}📁 Project Directory:${NC} $PROJECT_DIR"
echo -e "${BLUE}📄 Output File:${NC} $OUTPUT_FILE"
echo ""

# Test summary (this is what AI sends as prompt)
TEST_SUMMARY="🧪 Debug Test - Verify AI Response

## Important:
This is the **PROMPT/SUMMARY** from AI.

Your **FEEDBACK** should be different.

## Test Instructions:
1. Read this prompt (it's from AI)
2. Type YOUR feedback below (not this text)
3. Example feedback: \"I agree, continue\"
4. Submit feedback

---

**AI should receive YOUR feedback, not this prompt!**"

echo -e "${YELLOW}📝 What AI Sends (PROMPT/SUMMARY):${NC}"
echo "$TEST_SUMMARY" | head -5
echo "..."
echo ""

echo -e "${YELLOW}📝 What You Should Enter (FEEDBACK):${NC}"
echo "Example: \"I agree with the changes, please continue\""
echo ""

echo -e "${GREEN}✅ Starting Feedback UI Server...${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "1. Don't copy the prompt text"
echo "2. Type YOUR OWN feedback"
echo "3. Submit and wait for success message"
echo ""
echo -e "${YELLOW}⏳ Waiting for your feedback...${NC}"
echo ""

# Run server with debug logging
NODE_ENV=debug node "$PROJECT_DIR/src/feedback-ui-server.js" \
  --project-directory "$PROJECT_DIR" \
  --summary "$TEST_SUMMARY" \
  --output-file "$OUTPUT_FILE" 2>&1 | tee /tmp/debug-server-output.log

# Check result
echo ""
echo "============================================="
echo ""

if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${GREEN}✅ OUTPUT FILE CREATED${NC}"
    echo ""
    
    echo -e "${BLUE}📄 Full Output Content:${NC}"
    cat "$OUTPUT_FILE"
    echo ""
    
    # Extract and validate
    if command -v jq &> /dev/null; then
        echo ""
        echo -e "${BLUE}🔍 Detailed Analysis:${NC}"
        echo ""
        
        PROMPT_IN_OUTPUT=$(cat "$OUTPUT_FILE" | jq -r '.prompt // .summary // ""')
        FEEDBACK=$(cat "$OUTPUT_FILE" | jq -r '.interactive_feedback // ""')
        
        echo -e "${YELLOW}What AI sent (PROMPT/SUMMARY):${NC}"
        echo "$TEST_SUMMARY" | head -3
        echo "..."
        echo ""
        
        echo -e "${YELLOW}What YOU entered (FEEDBACK):${NC}"
        echo "$FEEDBACK"
        echo ""
        
        # Check if they're different
        if [ "$FEEDBACK" != "$TEST_SUMMARY" ]; then
            if [[ ! "$FEEDBACK" =~ "Debug Test" ]] && [[ ! "$FEEDBACK" =~ "PROMPT/SUMMARY" ]]; then
                echo -e "${GREEN}✅ CORRECT!${NC} AI will receive YOUR feedback, not the prompt"
                echo ""
                echo -e "${GREEN}🎉 SUCCESS - Data flow is correct!${NC}"
                echo ""
                echo "Expected behavior:"
                echo "  ✓ AI sends prompt/question → User sees it"
                echo "  ✓ User types feedback → AI receives it"
                echo "  ✓ Feedback ≠ Prompt (different content)"
                echo ""
            else
                echo -e "${YELLOW}⚠️  WARNING${NC}: Your feedback looks like the prompt"
                echo ""
                echo "Did you copy the prompt text?"
                echo "You should enter YOUR OWN feedback, not copy the prompt."
                echo ""
            fi
        else
            echo -e "${RED}❌ ERROR${NC}: Feedback is identical to prompt!"
            echo ""
            echo "This means AI is receiving the prompt back instead of user feedback."
            echo "This is a BUG that needs to be fixed."
            echo ""
        fi
        
        # Check what MCP server would return
        echo ""
        echo -e "${BLUE}📤 What MCP Server Returns to AI:${NC}"
        echo "{"
        echo "  \"command_logs\": \"Interactive feedback completed\","
        echo "  \"interactive_feedback\": \"$FEEDBACK\","
        echo "  \"session_id\": \"...\","
        echo "  \"security_status\": \"All validations passed\","
        echo "  \"session_completed\": true,"
        echo "  \"timestamp\": \"...\""
        echo "}"
        echo ""
        
    fi
    
    # Check server logs
    if [ -f "/tmp/debug-server-output.log" ]; then
        echo ""
        echo -e "${BLUE}🔍 Server Logs Analysis:${NC}"
        echo ""
        
        if grep -q "Feedback submission received" /tmp/debug-server-output.log; then
            echo -e "${GREEN}✓${NC} Server received feedback submission"
        fi
        
        if grep -q "Output file written successfully" /tmp/debug-server-output.log; then
            echo -e "${GREEN}✓${NC} Output file written successfully"
        fi
        
        if grep -q "Feedback response sent" /tmp/debug-server-output.log; then
            echo -e "${GREEN}✓${NC} Response sent to frontend"
        fi
        
        echo ""
    fi
    
    # Cleanup
    echo -e "${YELLOW}🗑️  Cleaning up...${NC}"
    rm -f "$OUTPUT_FILE" /tmp/debug-server-output.log
    echo -e "${GREEN}✓${NC} Cleanup complete"
    echo ""
    
    exit 0
else
    echo -e "${RED}❌ FAILED: Output file not created${NC}"
    echo ""
    echo "Check server logs above for errors."
    echo ""
    
    if [ -f "/tmp/debug-server-output.log" ]; then
        echo "Last 20 lines of server log:"
        tail -20 /tmp/debug-server-output.log
    fi
    
    exit 1
fi
