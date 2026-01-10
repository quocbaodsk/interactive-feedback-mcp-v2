#!/usr/bin/env node

/**
 * Test MCP Integration with Index.html UI
 * Quick test to verify the MCP tool opens the existing index.html interface
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Test MCP Server with index.html UI
 */
async function testIndexUI() {
    console.log('🧪 Testing MCP Server with Index.html UI...\n');

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

    // Send tool call - this should open index.html
    console.log('3. Calling ask_user tool (should open index.html)...');
    const toolCallMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'ask_user',
            arguments: {
                project_directory: PROJECT_ROOT,
                summary: 'Testing automatic index.html UI launch when agent calls MCP tool'
            }
        }
    };

    mcpServer.stdin.write(JSON.stringify(toolCallMessage) + '\n');

    // Listen for responses
    mcpServer.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line);
                    console.log('📥 MCP Response:');
                    console.log(JSON.stringify(response, null, 2));
                    
                    if (response.result && response.result.web_url) {
                        console.log(`\n✅ Index.html UI should have opened at: ${response.result.web_url}`);
                        console.log('🎯 Check your browser - the main interface should be running!');
                        console.log('📱 This is the existing index.html UI, not a new feedback page.');
                    }
                } catch (error) {
                    console.log('📄 Raw response:', line);
                }
            }
        });
    });

    // Keep running for interaction
    console.log('\n⏰ Keeping server running for 30 seconds...');
    console.log('💡 The index.html interface should now be open in your browser.');
    console.log('🛑 Press Ctrl+C to stop.\n');

    // Auto cleanup after 30 seconds
    setTimeout(() => {
        console.log('\n🏁 Test completed - stopping MCP server...');
        mcpServer.kill('SIGTERM');
        process.exit(0);
    }, 30000);

    // Handle manual termination
    process.on('SIGINT', () => {
        console.log('\n🛑 Test interrupted - stopping MCP server...');
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
    testIndexUI();
}

export { testIndexUI };
