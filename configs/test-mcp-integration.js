#!/usr/bin/env node

/**
 * Test MCP Integration with Web UI
 * Demonstrates how the MCP tool automatically opens web interface
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Test MCP Server by sending a tool call
 */
async function testMCPIntegration() {
    console.log('🧪 Testing MCP Server with Web UI Integration...\n');

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

    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send tool call - this should trigger the web UI
    console.log('3. Calling interactive_feedback tool (this will open web UI)...');
    const toolCallMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'interactive_feedback',
            arguments: {
                project_directory: PROJECT_ROOT,
                summary: 'Testing MCP integration with automatic web UI launch. This prompt should appear in the web interface that opens automatically.'
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
                    console.log('📥 MCP Response:', JSON.stringify(response, null, 2));
                    
                    if (response.result && response.result.web_url) {
                        console.log(`\n✅ Web UI should have opened at: ${response.result.web_url}`);
                        console.log('🎯 Check your browser - the interactive feedback interface should be running!');
                    }
                } catch (error) {
                    console.log('📄 Raw response:', line);
                }
            }
        });
    });

    // Keep the process running for a while to allow web UI interaction
    console.log('\n⏰ Keeping server running for 60 seconds to allow interaction...');
    console.log('💡 You can now interact with the web UI that should have opened.');
    console.log('🛑 Press Ctrl+C to stop the test.\n');

    // Cleanup after 60 seconds
    setTimeout(() => {
        console.log('\n🏁 Test completed - stopping MCP server...');
        mcpServer.kill('SIGTERM');
        process.exit(0);
    }, 60000);

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
    testMCPIntegration();
}

export { testMCPIntegration };
