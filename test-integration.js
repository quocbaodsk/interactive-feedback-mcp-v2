#!/usr/bin/env node

/**
 * Integration Test for Interactive Feedback MCP - Secure Edition
 * Basic tests to verify system components work together
 */

import fs from 'fs-extra'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = __dirname

// Set up global project root
process.env.PROJECT_ROOT = PROJECT_ROOT

/**
 * Test Suite Runner
 */
class IntegrationTester {
  constructor() {
    this.tests = []
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
    }
  }

  /**
   * Add a test
   * @param {string} name - Test name
   * @param {Function} testFn - Test function
   */
  addTest(name, testFn) {
    this.tests.push({ name, testFn })
  }

  /**
   * Run all tests
   */
  async runTests() {
    console.log('🧪 Running Integration Tests for Interactive Feedback MCP\n')

    for (const test of this.tests) {
      this.results.total++

      try {
        console.log(`🔍 Testing: ${test.name}`)
        await test.testFn()
        console.log(`✅ PASSED: ${test.name}\n`)
        this.results.passed++
      } catch (error) {
        console.log(`❌ FAILED: ${test.name}`)
        console.log(`   Error: ${error.message}\n`)
        this.results.failed++
      }
    }

    // Print summary
    console.log('📊 Test Results Summary:')
    console.log(`   Total: ${this.results.total}`)
    console.log(`   Passed: ${this.results.passed}`)
    console.log(`   Failed: ${this.results.failed}`)

    if (this.results.failed === 0) {
      console.log('\n🎉 All tests passed! The system is ready for use.')
      return true
    } else {
      console.log('\n💥 Some tests failed. Please check the errors above.')
      return false
    }
  }
}

/**
 * Test file structure exists
 */
async function testFileStructure() {
  const requiredFiles = [
    'src/main.js',
    'src/server/mcp-server.js',
    'src/server/security.js',
    'src/server/process-runner.js',
    'src/web/web-server.js',
    'src/web/api-routes.js',
    'src/web/file-browser.js',
    'src/shared/utils.js',
    'src/shared/logger.js',
    'src/shared/config.js',
    'src/shared/migration.js',
    'config/commands-whitelist.json',
    'config/default-config.json',
    'public/index.html',
    'package.json',
    'migrate.js',
  ]

  for (const file of requiredFiles) {
    const filePath = join(PROJECT_ROOT, file)
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`Required file missing: ${file}`)
    }
  }
}

/**
 * Test configuration files are valid JSON
 */
async function testConfigurationFiles() {
  const configFiles = ['config/commands-whitelist.json', 'config/default-config.json']

  for (const file of configFiles) {
    const filePath = join(PROJECT_ROOT, file)
    const content = await fs.readFile(filePath, 'utf8')
    JSON.parse(content) // Will throw if invalid JSON
  }
}

/**
 * Test security manager loads correctly
 */
async function testSecurityManager() {
  const { SecurityManager } = await import('./src/server/security.js')
  const security = new SecurityManager(PROJECT_ROOT)

  // Test command validation
  const validCommand = security.validateCommand('npm install')
  if (!validCommand.isValid) {
    throw new Error('Valid command failed validation')
  }

  const invalidCommand = security.validateCommand('rm -rf /')
  if (invalidCommand.isValid) {
    throw new Error('Invalid command passed validation')
  }

  // Test file path validation
  const validPath = security.validateFilePath('src/main.js', PROJECT_ROOT)
  if (!validPath.isValid) {
    throw new Error('Valid file path failed validation')
  }

  const invalidPath = security.validateFilePath('../../etc/passwd', PROJECT_ROOT)
  if (invalidPath.isValid) {
    throw new Error('Path traversal attempt passed validation')
  }
}

/**
 * Test logger functionality
 */
async function testLogger() {
  const { getLogger } = await import('./src/shared/logger.js')
  const logger = getLogger(PROJECT_ROOT)

  // Test basic logging (shouldn't throw)
  logger.info('Test log message')
  logger.debug('Test debug message')
  logger.warn('Test warning message')
  logger.audit('test_action', { test: true })
}

/**
 * Test configuration manager
 */
async function testConfigurationManager() {
  const { ConfigManager } = await import('./src/shared/config.js')
  const configManager = new ConfigManager(PROJECT_ROOT)

  // Test loading default config
  const defaultConfig = configManager.getDefaultConfig()
  if (!defaultConfig || !defaultConfig.server) {
    throw new Error('Failed to load default configuration')
  }

  // Test project config path generation
  const configPath = configManager.getProjectConfigPath('/test/project')
  if (!configPath || !configPath.endsWith('.json')) {
    throw new Error('Failed to generate project config path')
  }
}

/**
 * Test process runner initialization
 */
async function testProcessRunner() {
  const { ProcessRunner } = await import('./src/server/process-runner.js')
  const processRunner = new ProcessRunner(PROJECT_ROOT)

  // Test basic initialization
  const stats = processRunner.getStatistics()
  if (typeof stats.activeProcesses !== 'number') {
    throw new Error('Process runner statistics invalid')
  }

  // Cleanup
  processRunner.cleanup()
}

/**
 * Test file browser
 */
async function testFileBrowser() {
  const { FileBrowser } = await import('./src/web/file-browser.js')
  const { SecurityManager } = await import('./src/server/security.js')
  const { getLogger } = await import('./src/shared/logger.js')

  const security = new SecurityManager(PROJECT_ROOT)
  const logger = getLogger(PROJECT_ROOT)

  const fileBrowser = new FileBrowser(PROJECT_ROOT, { security, logger })

  // Test browsing project root
  const result = await fileBrowser.browseDirectory('.', PROJECT_ROOT)
  if (!result.success) {
    throw new Error(`File browser failed: ${result.error}`)
  }

  if (!result.items || result.items.length === 0) {
    throw new Error('File browser returned no items')
  }
}

/**
 * Test MCP server initialization
 */
async function testMCPServer() {
  const { MCPServer } = await import('./src/server/mcp-server.js')
  const mcpServer = new MCPServer(PROJECT_ROOT)

  // Test basic initialization
  const status = mcpServer.getStatus()
  if (!status.sessionId) {
    throw new Error('MCP server status invalid')
  }

  // Don't actually start the server in tests
}

/**
 * Test migration manager
 */
async function testMigrationManager() {
  const { MigrationManager } = await import('./src/shared/migration.js')
  const migrationManager = new MigrationManager(PROJECT_ROOT)

  // Test checking migration status (shouldn't throw)
  const status = await migrationManager.checkMigrationStatus()
  if (typeof status.needed !== 'boolean') {
    throw new Error('Migration status check failed')
  }
}

/**
 * Test package.json and dependencies
 */
async function testPackageConfiguration() {
  const packagePath = join(PROJECT_ROOT, 'package.json')
  const packageJson = await fs.readJson(packagePath)

  // Check required fields
  const requiredFields = ['name', 'version', 'main', 'type', 'dependencies']
  for (const field of requiredFields) {
    if (!packageJson[field]) {
      throw new Error(`Package.json missing required field: ${field}`)
    }
  }

  // Check required dependencies
  const requiredDeps = ['express', 'ws', 'fs-extra', 'joi', 'helmet', 'cors']
  for (const dep of requiredDeps) {
    if (!packageJson.dependencies[dep]) {
      throw new Error(`Missing required dependency: ${dep}`)
    }
  }

  // Check entry point exists
  const mainFile = join(PROJECT_ROOT, packageJson.main)
  if (!(await fs.pathExists(mainFile))) {
    throw new Error(`Main entry point does not exist: ${packageJson.main}`)
  }
}

/**
 * Test storage directory creation
 */
async function testStorageDirectories() {
  const { ensureDirectory } = await import('./src/shared/utils.js')

  const storageDirs = ['storage', 'storage/configs', 'storage/temp', 'storage/logs', 'storage/sessions']

  for (const dir of storageDirs) {
    const dirPath = join(PROJECT_ROOT, dir)
    await ensureDirectory(dirPath)

    if (!(await fs.pathExists(dirPath))) {
      throw new Error(`Failed to create storage directory: ${dir}`)
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  const tester = new IntegrationTester()

  // Add all tests
  tester.addTest('File Structure', testFileStructure)
  tester.addTest('Configuration Files', testConfigurationFiles)
  tester.addTest('Package Configuration', testPackageConfiguration)
  tester.addTest('Storage Directories', testStorageDirectories)
  tester.addTest('Security Manager', testSecurityManager)
  tester.addTest('Logger', testLogger)
  tester.addTest('Configuration Manager', testConfigurationManager)
  tester.addTest('Process Runner', testProcessRunner)
  tester.addTest('File Browser', testFileBrowser)
  tester.addTest('MCP Server', testMCPServer)
  tester.addTest('Migration Manager', testMigrationManager)

  // Run tests
  const success = await tester.runTests()

  if (success) {
    console.log('\n🚀 System is ready! You can now:')
    console.log('   • npm install && npm start')
    console.log('   • node migrate.js check (if migrating from old version)')
    console.log('   • Access web UI at http://127.0.0.1:3636')
    process.exit(0)
  } else {
    process.exit(1)
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Tests cancelled by user')
  process.exit(0)
})

process.on('uncaughtException', error => {
  console.error('\n❌ Uncaught Exception during testing:', error.message)
  process.exit(1)
})

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
