#!/usr/bin/env node

/**
 * Test Cursor MCP Integration
 * Quick test to verify MCP server works with Cursor
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Test MCP Server Integration for Cursor
 */
async function testCursorIntegration() {
    console.log('🧪 Testing Cursor MCP Integration...\n');

    console.log('1. Testing MCP Server Startup...');
    console.log('   Expected: Clean JSON-RPC output (no emoji errors)');
    console.log('   Expected: Security configs loaded successfully\n');

    // Start MCP server
    const mcpServer = spawn('node', [
        join(PROJECT_ROOT, 'src', 'mcp-lightweight.js')
    ], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    // Capture outputs
    let stdout = '';
    let stderr = '';
    let hasJsonError = false;
    let hasSecurityError = false;

    mcpServer.stdout.on('data', (data) => {
        stdout += data.toString();
        // Check for JSON-RPC compliance (no emoji characters)
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            if (line.includes('🚀') || line.includes('✅') || line.includes('❌')) {
                hasJsonError = true;
                console.log('❌ JSON-RPC Error: Found emoji in stdout:', line.substring(0, 50));
            }
        });
    });

    mcpServer.stderr.on('data', (data) => {
        stderr += data.toString();
        if (data.toString().includes('Failed to load security configurations')) {
            hasSecurityError = true;
            console.log('❌ Security Error:', data.toString().trim());
        }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Send initialize message (basic MCP protocol test)
    console.log('2. Testing MCP Protocol Initialization...');
    
    const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'cursor-test-client',
                version: '1.0.0'
            }
        }
    };

    mcpServer.stdin.write(JSON.stringify(initMessage) + '\n');

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send initialized notification
    const initializedNotification = {
        jsonrpc: '2.0',
        method: 'initialized',
        params: {}
    };

    mcpServer.stdin.write(JSON.stringify(initializedNotification) + '\n');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test tool availability
    console.log('3. Testing Tool Availability...');
    
    const listToolsMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
    };

    mcpServer.stdin.write(JSON.stringify(listToolsMessage) + '\n');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Cleanup
    mcpServer.kill('SIGTERM');

    // Results
    console.log('\n📊 Test Results:');
    console.log('================');
    
    if (hasJsonError) {
        console.log('❌ JSON-RPC Compliance: FAILED');
        console.log('   Issue: Emoji characters found in stdout');
        console.log('   Impact: Cursor will show JSON parsing errors');
    } else {
        console.log('✅ JSON-RPC Compliance: PASSED');
        console.log('   Clean output, no emoji interference');
    }
    
    if (hasSecurityError) {
        console.log('❌ Security Configuration: FAILED');
        console.log('   Issue: Missing config files');
        console.log('   Impact: Server will fail to start in Cursor');
    } else {
        console.log('✅ Security Configuration: PASSED');
        console.log('   Config files loaded successfully');
    }

    // Check for successful initialization logs
    const hasInitLog = stderr.includes('MCP Server initialized');
    if (hasInitLog) {
        console.log('✅ Server Initialization: PASSED');
        console.log('   MCP server started successfully');
    } else {
        console.log('❌ Server Initialization: FAILED');
        console.log('   Server did not initialize properly');
    }

    console.log('\n📋 Configuration Instructions:');
    console.log('==============================');
    console.log('Copy this to your Cursor MCP settings:\n');
    
    const cursorConfig = {
        mcpServers: {
            "interactive-feedback-mcp": {
                command: "node",
                args: ["src/mcp-lightweight.js"],
                env: {
                    NODE_ENV: "production",
                    NODE_OPTIONS: "--no-warnings --no-deprecation",
                    MCP_LOG_LEVEL: "error"
                },
                timeout: 60000,
                cwd: PROJECT_ROOT
            }
        }
    };

    console.log(JSON.stringify(cursorConfig, null, 2));
    
    console.log('\n💡 Next Steps:');
    console.log('- Add the above config to Cursor MCP settings');
    console.log('- Restart Cursor completely');
    console.log('- Test with: "Use ask_user tool"');
    
    const overallSuccess = !hasJsonError && !hasSecurityError && hasInitLog;
    
    if (overallSuccess) {
        console.log('\n🎉 SUCCESS: Ready for Cursor integration!');
        process.exit(0);
    } else {
        console.log('\n💥 ISSUES FOUND: Please fix the above problems');
        process.exit(1);
    }
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
    testCursorIntegration();
}

export { testCursorIntegration };
