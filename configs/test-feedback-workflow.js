#!/usr/bin/env node

/**
 * Test Interactive Feedback Workflow
 * Tests the complete workflow: MCP tool -> Feedback UI -> User response -> Result
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Test complete feedback workflow
 */
async function testFeedbackWorkflow() {
    console.log('🧪 Testing Complete Interactive Feedback Workflow...\n');

    // Start MCP server
    console.log('1. Starting MCP Server...');
    const mcpServer = spawn('node', [
        join(PROJECT_ROOT, 'src', 'mcp-lightweight.js')
    ], {
        stdio: ['pipe', 'pipe', 'inherit']
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send initialize message
    console.log('2. Initializing MCP connection...');
    const initMessage = {
        jsonrpc: '2.0',
        id: 1,
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

    mcpServer.stdin.write(JSON.stringify(initMessage) + '\n');

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send initialized notification
    const initializedNotification = {
        jsonrpc: '2.0',
        method: 'initialized',
        params: {}
    };

    mcpServer.stdin.write(JSON.stringify(initializedNotification) + '\n');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send tool call - this should launch feedback UI and wait for user response
    console.log('3. Calling interactive_feedback tool...');
    console.log('📝 This will open a feedback UI where you can provide feedback.');
    console.log('💡 The MCP server will WAIT for your response before returning result.');
    console.log('⏰ Please provide feedback in the UI that opens.\n');
    
    const toolCallMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'interactive_feedback',
            arguments: {
                project_directory: PROJECT_ROOT,
                summary: `Test Summary: I have implemented a new interactive feedback system for the MCP server. 

Key features implemented:
- 🌐 Auto-opens feedback UI in browser
- 💬 Displays AI summary and allows user feedback
- ⏳ MCP server waits for user response (not returning immediately)
- 📝 User can provide detailed feedback
- 🔄 Tab auto-closes after submission
- ✅ Final result returned to AI agent

Please test this workflow by providing your feedback in the UI. The MCP server is currently WAITING for your response and will not proceed until you submit feedback.

Example feedback you could provide:
- "The implementation looks good, please proceed"
- "I need some changes: [describe what needs to be changed]"
- "Add more error handling to the feedback submission"
- "The UI is great but needs better styling"`
            }
        }
    };

    mcpServer.stdin.write(JSON.stringify(toolCallMessage) + '\n');

    console.log('⏰ MCP Server is now waiting for your feedback...');
    console.log('🌐 A feedback UI should have opened in your browser.');
    console.log('📝 Please provide your feedback there.');
    console.log('🔄 This test will complete after you submit feedback.\n');

    let responseReceived = false;

    // Listen for responses
    mcpServer.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line);
                    
                    if (response.id === 2) { // Our tool call response
                        responseReceived = true;
                        console.log('🎉 FEEDBACK WORKFLOW COMPLETED!');
                        console.log('📥 Final MCP Response:');
                        console.log(JSON.stringify(response, null, 2));
                        
                        if (response.result && response.result.content) {
                            const content = JSON.parse(response.result.content[0].text);
                            console.log('\n✅ Feedback Result Summary:');
                            console.log('- Command Logs:', content.command_logs);
                            console.log('- User Feedback:', content.interactive_feedback);
                            console.log('- Session Completed:', content.session_completed);
                            console.log('- Timestamp:', content.timestamp);
                        }
                        
                        // Clean shutdown
                        setTimeout(() => {
                            console.log('\n🏁 Test completed successfully!');
                            mcpServer.kill('SIGTERM');
                            process.exit(0);
                        }, 2000);
                    }
                } catch (error) {
                    // Ignore non-JSON log lines
                    if (!line.includes('INFO') && !line.includes('ERROR')) {
                        console.log('📄 Raw response:', line);
                    }
                }
            }
        });
    });

    // Timeout after 5 minutes if no response
    setTimeout(() => {
        if (!responseReceived) {
            console.log('\n⏰ Test timed out after 5 minutes.');
            console.log('💡 This might mean:');
            console.log('   - User didn\'t submit feedback');
            console.log('   - Feedback UI failed to launch');
            console.log('   - Browser blocked the popup');
            console.log('\n🛑 Stopping test...');
        }
        mcpServer.kill('SIGTERM');
        process.exit(responseReceived ? 0 : 1);
    }, 5 * 60 * 1000); // 5 minutes

    // Handle manual termination
    process.on('SIGINT', () => {
        console.log('\n🛑 Test interrupted by user');
        mcpServer.kill('SIGTERM');
        process.exit(0);
    });
}

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Test failed:', reason);
    process.exit(1);
});

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testFeedbackWorkflow();
}

export { testFeedbackWorkflow };
