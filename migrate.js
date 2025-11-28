#!/usr/bin/env node

/**
 * Migration CLI Tool for Interactive Feedback MCP
 * Command-line tool to migrate from old version to secure version
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = __dirname;

// Set up global project root
process.env.PROJECT_ROOT = PROJECT_ROOT;

import { MigrationManager } from './src/shared/migration.js';
import { getLogger } from './src/shared/logger.js';

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const parsed = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const key = arg.substring(2).replace(/-/g, '_');
            const nextArg = args[i + 1];
            
            if (nextArg && !nextArg.startsWith('--')) {
                parsed[key] = nextArg;
                i++; // Skip next argument
            } else {
                parsed[key] = true;
            }
        }
    }
    
    return parsed;
}

/**
 * Show help message
 */
function showHelp() {
    console.log(`
Interactive Feedback MCP - Migration Tool v2.0.0

Migrates configuration files from the old global storage (~/.interactive-feedback-mcp/) 
to the new secure local storage system.

Usage: node migrate.js [command] [options]

Commands:
  check        Check if migration is needed
  migrate      Perform the migration
  verify       Verify migration integrity
  cleanup      Clean up old configuration files (archive them)
  log          Show migration log

Options:
  --overwrite         Overwrite existing configurations during migration
  --no-backup         Don't create backup of old configurations
  --keep-old-files    Don't archive old files during cleanup
  --verbose           Show detailed output
  --dry-run           Show what would be migrated without actually doing it
  --help, -h          Show this help message

Examples:
  node migrate.js check              # Check if migration is needed
  node migrate.js migrate            # Perform migration
  node migrate.js migrate --overwrite --verbose
  node migrate.js verify             # Verify migration completed successfully
  node migrate.js cleanup            # Archive old configuration files
  node migrate.js log                # Show migration log

Security Note:
The new version stores all configurations locally in the 'storage/' directory
instead of the global ~/.interactive-feedback-mcp/ directory for better security.
    `);
}

/**
 * Main migration function
 */
async function main() {
    try {
        const args = parseArguments();
        const command = process.argv[2];
        
        // Show help
        if (args.help || args.h || !command) {
            showHelp();
            return;
        }

        // Initialize migration manager and logger
        const migrationManager = new MigrationManager(PROJECT_ROOT);
        const logger = getLogger(PROJECT_ROOT, { enableConsole: args.verbose });

        console.log('🔒 Interactive Feedback MCP - Migration Tool v2.0.0\n');

        switch (command) {
            case 'check':
                await handleCheckCommand(migrationManager, args);
                break;
                
            case 'migrate':
                await handleMigrateCommand(migrationManager, args);
                break;
                
            case 'verify':
                await handleVerifyCommand(migrationManager, args);
                break;
                
            case 'cleanup':
                await handleCleanupCommand(migrationManager, args);
                break;
                
            case 'log':
                await handleLogCommand(migrationManager, args);
                break;
                
            default:
                console.error(`❌ Unknown command: ${command}`);
                console.log('Run "node migrate.js --help" for usage information.');
                process.exit(1);
        }

    } catch (error) {
        console.error('❌ Migration tool failed:', error.message);
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

/**
 * Handle check command
 */
async function handleCheckCommand(migrationManager, args) {
    console.log('🔍 Checking migration status...\n');
    
    const status = await migrationManager.checkMigrationStatus();
    
    if (status.needed) {
        console.log('✅ Migration needed');
        console.log(`📋 Reason: ${status.reason}`);
        
        if (status.oldFiles && status.oldFiles.length > 0) {
            console.log('\n📁 Files found to migrate:');
            status.oldFiles.forEach(file => {
                console.log(`  • ${file.name} (${file.size} bytes, modified: ${new Date(file.modified).toLocaleString()})`);
            });
        }
        
        console.log('\n💡 Run "node migrate.js migrate" to perform the migration.');
        process.exit(0);
        
    } else {
        console.log('ℹ️  Migration not needed');
        console.log(`📋 Reason: ${status.reason}`);
        
        if (status.completedAt) {
            console.log(`📅 Previous migration completed: ${new Date(status.completedAt).toLocaleString()}`);
            if (status.migratedFiles) {
                console.log(`📊 Files migrated: ${status.migratedFiles}`);
            }
        }
        
        if (status.error) {
            console.log(`⚠️  Error: ${status.error}`);
        }
        
        process.exit(0);
    }
}

/**
 * Handle migrate command
 */
async function handleMigrateCommand(migrationManager, args) {
    console.log('🚀 Starting migration process...\n');
    
    // Check if migration is needed first
    const status = await migrationManager.checkMigrationStatus();
    
    if (!status.needed) {
        console.log('ℹ️  Migration not needed');
        console.log(`📋 Reason: ${status.reason}`);
        return;
    }

    // Confirm with user unless --yes flag is provided
    if (!args.yes && !args.dry_run) {
        console.log('⚠️  This will migrate configuration files to the new secure local storage system.');
        console.log('   Old files will be backed up before migration.');
        console.log('\n   Continue? (y/N): ');
        
        // Simple confirmation - in a real implementation you might want to use readline
        const confirmation = process.argv.includes('--confirm') || 
                           process.argv.includes('-y') || 
                           process.argv.includes('--yes');
        
        if (!confirmation) {
            console.log('❌ Migration cancelled by user');
            console.log('   Use --yes or --confirm to skip this prompt');
            return;
        }
    }

    if (args.dry_run) {
        console.log('🔍 DRY RUN MODE - No files will be actually migrated\n');
    }

    const migrationOptions = {
        overwrite: Boolean(args.overwrite),
        createBackup: !args.no_backup,
        dryRun: Boolean(args.dry_run)
    };

    const startTime = Date.now();
    const result = await migrationManager.performMigration(migrationOptions);
    const duration = Date.now() - startTime;

    if (result.success) {
        console.log('✅ Migration completed successfully!');
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Total files: ${result.totalFiles}`);
        console.log(`✅ Migrated: ${result.migratedFiles}`);
        
        if (result.failedFiles > 0) {
            console.log(`❌ Failed: ${result.failedFiles}`);
        }
        
        if (args.verbose && result.results) {
            console.log('\n📋 Detailed results:');
            result.results.forEach(r => {
                const status = r.success ? '✅' : '❌';
                console.log(`  ${status} ${r.oldPath}`);
                if (r.success) {
                    console.log(`      → ${r.newPath}`);
                } else {
                    console.log(`      Error: ${r.error}`);
                }
            });
        }
        
        if (!args.dry_run) {
            console.log('\n💡 Next steps:');
            console.log('   • Run "node migrate.js verify" to verify the migration');
            console.log('   • Run "node migrate.js cleanup" to archive old configuration files');
            console.log('   • Test the new secure version with your projects');
        }
        
    } else {
        console.log('❌ Migration failed');
        console.log(`📋 Error: ${result.message}`);
        if (result.error) {
            console.log(`📋 Details: ${result.error}`);
        }
        process.exit(1);
    }
}

/**
 * Handle verify command
 */
async function handleVerifyCommand(migrationManager, args) {
    console.log('🔍 Verifying migration integrity...\n');
    
    const result = await migrationManager.verifyMigration();
    
    if (result.success) {
        console.log('✅ Migration verification completed');
        console.log(`📊 Total migrated: ${result.totalMigrated}`);
        console.log(`✅ Verified: ${result.verified}`);
        console.log(`📋 Status: ${result.isComplete ? 'Complete' : 'Incomplete'}`);
        
        if (args.verbose && result.results) {
            console.log('\n📋 Verification details:');
            result.results.forEach(r => {
                const status = r.verified ? '✅' : '❌';
                console.log(`  ${status} ${r.newPath}`);
            });
        }
        
        if (!result.isComplete) {
            console.log('\n⚠️  Migration appears incomplete. Some files may be missing.');
            console.log('   Consider running the migration again.');
        }
        
    } else {
        console.log('❌ Verification failed');
        console.log(`📋 Reason: ${result.reason || result.error}`);
        process.exit(1);
    }
}

/**
 * Handle cleanup command
 */
async function handleCleanupCommand(migrationManager, args) {
    console.log('🧹 Cleaning up old configuration files...\n');
    
    // Get migration log to determine what was migrated
    const migrationLog = await migrationManager.getMigrationLog();
    
    if (!migrationLog) {
        console.log('❌ No migration log found. Migration may not have been completed.');
        console.log('   Run "node migrate.js check" to verify migration status.');
        return;
    }

    const cleanupOptions = {
        keepOldFiles: Boolean(args.keep_old_files)
    };

    const result = await migrationManager.cleanupOldConfigs(migrationLog, cleanupOptions);
    
    if (result.success) {
        console.log('✅ Cleanup completed successfully');
        console.log(`📊 Files processed: ${result.totalFiles}`);
        console.log(`📁 Files archived: ${result.archivedFiles}`);
        
        if (args.verbose && result.results) {
            console.log('\n📋 Cleanup details:');
            result.results.forEach(r => {
                const status = r.success ? '✅' : '❌';
                console.log(`  ${status} ${r.oldPath}`);
                if (r.success) {
                    console.log(`      → ${r.archivePath}`);
                } else {
                    console.log(`      Error: ${r.error}`);
                }
            });
        }
        
    } else {
        console.log('❌ Cleanup failed');
        console.log(`📋 Reason: ${result.reason || result.error}`);
        process.exit(1);
    }
}

/**
 * Handle log command
 */
async function handleLogCommand(migrationManager, args) {
    console.log('📋 Migration log:\n');
    
    const migrationLog = await migrationManager.getMigrationLog();
    
    if (!migrationLog) {
        console.log('ℹ️  No migration log found');
        console.log('   This usually means no migration has been performed yet.');
        return;
    }

    console.log(`Migration ID: ${migrationLog.migrationId}`);
    console.log(`Started: ${new Date(migrationLog.startTime).toLocaleString()}`);
    console.log(`Completed: ${new Date(migrationLog.completedAt).toLocaleString()}`);
    console.log(`Duration: ${migrationLog.duration}ms`);
    console.log(`Total files: ${migrationLog.totalFiles}`);
    console.log(`Migrated: ${migrationLog.migratedFiles}`);
    console.log(`Failed: ${migrationLog.failedFiles}`);
    console.log(`Version: ${migrationLog.version}`);
    
    if (args.verbose && migrationLog.results) {
        console.log('\n📋 Detailed results:');
        migrationLog.results.forEach(r => {
            const status = r.success ? '✅' : '❌';
            console.log(`  ${status} ${r.oldPath}`);
            if (r.success) {
                console.log(`      → ${r.newPath}`);
                console.log(`      Project: ${r.projectDirectory}`);
            } else {
                console.log(`      Error: ${r.error}`);
            }
        });
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Migration cancelled by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Migration terminated');
    process.exit(0);
});

// Start the migration tool
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { main };
