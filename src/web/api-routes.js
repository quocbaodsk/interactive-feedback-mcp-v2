/**
 * API Routes for Interactive Feedback MCP
 * Handles HTTP endpoints with security validation
 */

import { Router } from 'express';
import { join } from 'path';
import fs from 'fs-extra';
import { getCurrentTimestamp, generateUUID } from '../shared/utils.js';
import { ProcessRunner } from '../server/process-runner.js';
import { FileBrowser } from './file-browser.js';

/**
 * API Routes Class
 * Defines secure HTTP endpoints for the web interface
 */
export class APIRoutes {
    constructor(projectRoot, dependencies = {}) {
        this.projectRoot = projectRoot;
        this.security = dependencies.security;
        this.logger = dependencies.logger;
        
        // Initialize components
        this.processRunner = new ProcessRunner(projectRoot);
        this.fileBrowser = new FileBrowser(projectRoot, {
            security: this.security,
            logger: this.logger
        });
        
        // Storage paths
        this.storageDir = join(projectRoot, 'storage');
        this.tempDir = join(this.storageDir, 'temp');
        this.configsDir = join(this.storageDir, 'configs');
        this.sessionsDir = join(this.storageDir, 'sessions');
        
        // Initialize storage directories
        this.initializeStorage();
        
        // Create router
        this.router = Router();
        this.setupRoutes();
        
        this.logger.info('API Routes initialized');
    }

    /**
     * Initialize storage directories
     */
    async initializeStorage() {
        try {
            await fs.ensureDir(this.storageDir);
            await fs.ensureDir(this.tempDir);
            await fs.ensureDir(this.configsDir);
            await fs.ensureDir(this.sessionsDir);
        } catch (error) {
            this.logger.error('Failed to initialize storage directories', {
                error: error.message
            });
        }
    }

    /**
     * Setup all API routes
     */
    setupRoutes() {
        // Middleware for API routes
        this.router.use((req, res, next) => {
            // Add security headers
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block'
            });
            
            next();
        });

        // Configuration endpoints
        this.router.get('/config', this.getConfig.bind(this));
        this.router.post('/config', this.saveConfig.bind(this));

        // Command execution endpoints
        this.router.post('/run-command', this.runCommand.bind(this));
        this.router.post('/stop-command', this.stopCommand.bind(this));
        this.router.get('/command-status', this.getCommandStatus.bind(this));

        // File browsing endpoints
        this.router.get('/browse-files', this.browseFiles.bind(this));
        this.router.get('/file-content', this.getFileContent.bind(this));

        // Feedback endpoints
        this.router.post('/submit-feedback', this.submitFeedback.bind(this));
        this.router.get('/feedback-status', this.getFeedbackStatus.bind(this));

        // System status endpoints
        this.router.get('/status', this.getSystemStatus.bind(this));
        this.router.get('/logs', this.getLogs.bind(this));

        // Session management
        this.router.post('/create-session', this.createSession.bind(this));
        this.router.get('/session/:sessionId', this.getSession.bind(this));

        // Interactive feedback endpoints
        this.router.get('/feedback/session', this.getFeedbackSession.bind(this));
        this.router.post('/feedback/update', this.updateFeedbackSession.bind(this));

        this.logger.info('API routes configured');
    }

    /**
     * Get configuration
     */
    async getConfig(req, res) {
        try {
            this.logger.debug('Config requested', { requestId: req.requestId });

            const projectDirectory = req.query.project_directory || process.cwd();
            
            // Security validation
            const pathValidation = this.security.validateFilePath('.', projectDirectory);
            if (!pathValidation.isValid) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid project directory' 
                });
            }

            // Load configuration
            const configPath = this.getProjectConfigPath(projectDirectory);
            let config = {};
            
            if (await fs.pathExists(configPath)) {
                config = await fs.readJson(configPath);
            } else {
                // Use default configuration
                config = {
                    run_command: '',
                    execute_automatically: false,
                    command_section_visible: false
                };
            }

            this.logger.audit('config_accessed', {
                projectDirectory,
                requestId: req.requestId
            });

            res.json({
                success: true,
                projectDirectory,
                config,
                timestamp: getCurrentTimestamp()
            });

        } catch (error) {
            this.logger.error('Failed to get config', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to load configuration'
            });
        }
    }

    /**
     * Save configuration
     */
    async saveConfig(req, res) {
        try {
            const { projectDirectory, config } = req.body;

            // Input validation
            if (!projectDirectory || !config) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            // Security validation
            const pathValidation = this.security.validateFilePath('.', projectDirectory);
            if (!pathValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid project directory'
                });
            }

            // Validate config object
            const validatedConfig = {
                run_command: this.security.sanitizeInput(config.run_command || ''),
                execute_automatically: Boolean(config.execute_automatically),
                command_section_visible: Boolean(config.command_section_visible),
                lastUpdated: getCurrentTimestamp()
            };

            // Save configuration
            const configPath = this.getProjectConfigPath(projectDirectory);
            await fs.writeJson(configPath, validatedConfig, { spaces: 2 });

            this.logger.info('Configuration saved', {
                projectDirectory,
                requestId: req.requestId
            });

            this.logger.audit('config_saved', {
                projectDirectory,
                requestId: req.requestId
            });

            res.json({
                success: true,
                config: validatedConfig
            });

        } catch (error) {
            this.logger.error('Failed to save config', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to save configuration'
            });
        }
    }

    /**
     * Run command
     */
    async runCommand(req, res) {
        try {
            const { command, workingDirectory } = req.body;

            // Input validation
            if (!command) {
                return res.status(400).json({
                    success: false,
                    error: 'Command is required'
                });
            }

            // Security validation
            const commandValidation = this.security.validateCommand(command);
            if (!commandValidation.isValid) {
                this.logger.warn('Command execution rejected', {
                    command: command.substring(0, 50),
                    error: commandValidation.error,
                    requestId: req.requestId
                });
                
                return res.status(403).json({
                    success: false,
                    error: commandValidation.error
                });
            }

            // Validate working directory if provided
            const cwd = workingDirectory || process.cwd();
            const pathValidation = this.security.validateFilePath('.', cwd);
            if (!pathValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid working directory'
                });
            }

            this.logger.info('Executing command', {
                command: commandValidation.sanitizedCommand,
                workingDirectory: cwd,
                requestId: req.requestId
            });

            this.logger.audit('command_executed', {
                command: commandValidation.sanitizedCommand,
                workingDirectory: cwd,
                requestId: req.requestId
            });

            // Execute command
            const result = await this.processRunner.executeCommand(
                commandValidation.sanitizedCommand,
                { cwd }
            );

            res.json({
                success: result.success,
                executionId: result.executionId,
                output: result.output,
                exitCode: result.exitCode,
                duration: result.duration,
                error: result.error
            });

        } catch (error) {
            this.logger.error('Command execution failed', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Command execution failed'
            });
        }
    }

    /**
     * Stop command execution
     */
    async stopCommand(req, res) {
        try {
            const { executionId } = req.body;

            if (!executionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Execution ID is required'
                });
            }

            const stopped = this.processRunner.killProcess(executionId, 'USER_REQUEST');

            this.logger.info('Command stop requested', {
                executionId,
                success: stopped,
                requestId: req.requestId
            });

            this.logger.audit('command_stopped', {
                executionId,
                success: stopped,
                requestId: req.requestId
            });

            res.json({
                success: stopped
            });

        } catch (error) {
            this.logger.error('Failed to stop command', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to stop command'
            });
        }
    }

    /**
     * Get command execution status
     */
    getCommandStatus(req, res) {
        try {
            const activeProcesses = this.processRunner.getActiveProcesses();
            const statistics = this.processRunner.getStatistics();

            res.json({
                success: true,
                activeProcesses,
                statistics
            });

        } catch (error) {
            this.logger.error('Failed to get command status', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to get status'
            });
        }
    }

    /**
     * Browse files
     */
    async browseFiles(req, res) {
        try {
            const { path: requestedPath = '', project_directory } = req.query;
            const projectDir = project_directory || process.cwd();

            // Use file browser with security validation
            const result = await this.fileBrowser.browseDirectory(requestedPath, projectDir);

            if (!result.success) {
                return res.status(400).json(result);
            }

            this.logger.debug('Files browsed', {
                path: requestedPath,
                itemCount: result.items.length,
                requestId: req.requestId
            });

            res.json(result);

        } catch (error) {
            this.logger.error('File browsing failed', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'File browsing failed'
            });
        }
    }

    /**
     * Get file content
     */
    async getFileContent(req, res) {
        try {
            const { file_path, project_directory } = req.query;
            const projectDir = project_directory || process.cwd();

            if (!file_path) {
                return res.status(400).json({
                    success: false,
                    error: 'File path is required'
                });
            }

            const result = await this.fileBrowser.getFileContent(file_path, projectDir);
            
            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);

        } catch (error) {
            this.logger.error('Failed to get file content', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to get file content'
            });
        }
    }

    /**
     * Submit feedback
     */
    async submitFeedback(req, res) {
        try {
            const { feedback, sessionId } = req.body;

            // Validate feedback
            const feedbackValidation = this.security.validateFeedback(feedback || '');
            if (!feedbackValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: feedbackValidation.error
                });
            }

            // Create feedback result
            const result = {
                interactive_feedback: feedbackValidation.sanitizedFeedback,
                command_logs: this.processRunner.getActiveProcesses()
                    .map(p => `[${p.executionId}] ${p.command}`)
                    .join('\n'),
                session_id: sessionId || generateUUID(),
                timestamp: getCurrentTimestamp(),
                success: true
            };

            // Save feedback to session storage if sessionId provided
            if (sessionId) {
                const sessionPath = join(this.sessionsDir, `${sessionId}.json`);
                await fs.writeJson(sessionPath, result, { spaces: 2 });
            }

            this.logger.info('Feedback submitted', {
                sessionId: result.session_id,
                feedbackLength: feedbackValidation.sanitizedFeedback.length,
                requestId: req.requestId
            });

            this.logger.audit('feedback_submitted', {
                sessionId: result.session_id,
                requestId: req.requestId
            });

            res.json({
                success: true,
                result
            });

        } catch (error) {
            this.logger.error('Failed to submit feedback', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to submit feedback'
            });
        }
    }

    /**
     * Get feedback status
     */
    async getFeedbackStatus(req, res) {
        try {
            const { sessionId } = req.query;

            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID is required'
                });
            }

            const sessionPath = join(this.sessionsDir, `${sessionId}.json`);
            
            if (await fs.pathExists(sessionPath)) {
                const sessionData = await fs.readJson(sessionPath);
                res.json({
                    success: true,
                    status: 'completed',
                    data: sessionData
                });
            } else {
                res.json({
                    success: true,
                    status: 'not_found'
                });
            }

        } catch (error) {
            this.logger.error('Failed to get feedback status', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to get feedback status'
            });
        }
    }

    /**
     * Get system status
     */
    getSystemStatus(req, res) {
        try {
            const status = {
                server: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: process.version,
                    platform: process.platform
                },
                processRunner: this.processRunner.getStatistics(),
                storage: {
                    tempDir: this.tempDir,
                    configsDir: this.configsDir,
                    sessionsDir: this.sessionsDir
                },
                security: this.security.getSecurityConfig()
            };

            res.json({
                success: true,
                status
            });

        } catch (error) {
            this.logger.error('Failed to get system status', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to get system status'
            });
        }
    }

    /**
     * Get logs
     */
    async getLogs(req, res) {
        try {
            const { type = 'app', lines = 100 } = req.query;
            
            // This is a placeholder - actual log reading would be implemented
            res.json({
                success: true,
                logs: [`Log reading for type '${type}' would be implemented here`],
                type,
                lines: parseInt(lines)
            });

        } catch (error) {
            this.logger.error('Failed to get logs', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to get logs'
            });
        }
    }

    /**
     * Create session
     */
    async createSession(req, res) {
        try {
            const { projectDirectory, summary } = req.body;
            const sessionId = generateUUID();

            const sessionData = {
                sessionId,
                projectDirectory: this.security.sanitizeInput(projectDirectory),
                summary: this.security.sanitizeInput(summary || ''),
                createdAt: getCurrentTimestamp(),
                status: 'active'
            };

            const sessionPath = join(this.sessionsDir, `${sessionId}.json`);
            await fs.writeJson(sessionPath, sessionData, { spaces: 2 });

            this.logger.info('Session created', {
                sessionId,
                projectDirectory,
                requestId: req.requestId
            });

            res.json({
                success: true,
                sessionId,
                sessionData
            });

        } catch (error) {
            this.logger.error('Failed to create session', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to create session'
            });
        }
    }

    /**
     * Get session
     */
    async getSession(req, res) {
        try {
            const { sessionId } = req.params;

            const sessionPath = join(this.sessionsDir, `${sessionId}.json`);
            
            if (await fs.pathExists(sessionPath)) {
                const sessionData = await fs.readJson(sessionPath);
                res.json({
                    success: true,
                    sessionData
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

        } catch (error) {
            this.logger.error('Failed to get session', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to get session'
            });
        }
    }

    /**
     * Get current feedback session data
     */
    async getFeedbackSession(req, res) {
        try {
            this.logger.debug('Feedback session requested', { requestId: req.requestId });

            // Get session data from global state (would be set by MCP server)
            const sessionData = global.currentFeedbackSession || null;
            
            if (!sessionData) {
                return res.json({
                    success: false,
                    message: 'No active feedback session',
                    sessionData: null
                });
            }

            res.json({
                success: true,
                sessionData,
                timestamp: getCurrentTimestamp()
            });

        } catch (error) {
            this.logger.error('Failed to get feedback session', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to get feedback session'
            });
        }
    }

    /**
     * Update feedback session data
     */
    async updateFeedbackSession(req, res) {
        try {
            const { sessionData } = req.body;
            
            this.logger.debug('Feedback session update', { requestId: req.requestId });

            // Update global session data
            global.currentFeedbackSession = {
                ...global.currentFeedbackSession,
                ...sessionData,
                lastUpdated: getCurrentTimestamp()
            };

            // Broadcast update via WebSocket if available
            if (this.wsServer) {
                this.wsServer.broadcast({
                    type: 'session_update',
                    data: global.currentFeedbackSession
                });
            }

            res.json({
                success: true,
                message: 'Session updated successfully',
                sessionData: global.currentFeedbackSession
            });

        } catch (error) {
            this.logger.error('Failed to update feedback session', {
                error: error.message,
                requestId: req.requestId
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to update session'
            });
        }
    }


    /**
     * Get project-specific config file path
     * @param {string} projectDirectory - Project directory
     * @returns {string} Config file path
     */
    getProjectConfigPath(projectDirectory) {
        const projectHash = this.security.createHash ? 
            this.security.createHash(projectDirectory) : 
            require('crypto').createHash('md5').update(projectDirectory).digest('hex').substring(0, 8);
        const projectName = require('path').basename(projectDirectory);
        return join(this.configsDir, `${projectName}_${projectHash}.json`);
    }

    /**
     * Get Express router
     * @returns {Router} Express router instance
     */
    getRouter() {
        return this.router;
    }
}
