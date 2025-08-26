"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const PatientAIAgent_1 = require("../agents/PatientAIAgent");
const DoctorAIAgent_1 = require("../agents/DoctorAIAgent");
const AdminAIAgent_1 = require("../agents/AdminAIAgent");
const router = express_1.default.Router();
// Initialize AI agents
const patientAgent = new PatientAIAgent_1.PatientAIAgent();
const doctorAgent = new DoctorAIAgent_1.DoctorAIAgent();
const adminAgent = new AdminAIAgent_1.AdminAIAgent();
// Chat with AI agent
router.post('/chat', auth_1.authenticateToken, [
    (0, express_validator_1.body)('message').notEmpty().trim(),
    (0, express_validator_1.body)('messageType').optional().isIn(['text', 'symptom_analysis', 'appointment_booking', 'prescription', 'alert']),
    (0, express_validator_1.body)('metadata').optional().isObject()
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { message, messageType = 'text', metadata } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;
        const db = (0, database_1.getDatabase)();
        const redis = (0, redis_1.getRedis)();
        // Rate limiting check
        const canProceed = await redis.checkRateLimit(userId, 'ai_chat', 50, 3600); // 50 messages per hour
        if (!canProceed) {
            throw (0, errorHandler_1.createError)('Rate limit exceeded. Please try again later.', 429);
        }
        // Create AI message
        const aiMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            agentType: userRole.toLowerCase(),
            fromUserId: userId,
            content: message,
            messageType,
            metadata,
            timestamp: new Date(),
            isProcessed: false
        };
        // Store message in database
        await db.aIAgentMessage.create({
            data: {
                id: aiMessage.id,
                agentType: aiMessage.agentType.toUpperCase(),
                fromUserId: userId,
                content: message,
                messageType: messageType.toUpperCase(),
                metadata: metadata || {},
                isProcessed: false
            }
        });
        // Route to appropriate AI agent
        let response;
        switch (userRole) {
            case 'PATIENT':
                response = await patientAgent.processMessage(aiMessage);
                break;
            case 'DOCTOR':
                response = await doctorAgent.processMessage(aiMessage);
                break;
            case 'ADMIN':
                response = await adminAgent.processMessage(aiMessage);
                break;
            default:
                throw (0, errorHandler_1.createError)('Invalid user role', 400);
        }
        // Store response in database
        await db.aIAgentMessage.create({
            data: {
                id: response.id,
                agentType: response.agentType.toUpperCase(),
                fromUserId: response.fromUserId,
                toUserId: response.toUserId,
                content: response.content,
                messageType: response.messageType.toUpperCase(),
                metadata: response.metadata || {},
                isProcessed: true
            }
        });
        logger_1.logger.info(`AI chat processed for user: ${userId}, agent: ${userRole}`);
        res.json({
            status: 'success',
            data: {
                message: response,
                conversationId: aiMessage.id
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get chat history
router.get('/chat/history', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { limit = 50, offset = 0 } = req.query;
        const db = (0, database_1.getDatabase)();
        const messages = await db.aIAgentMessage.findMany({
            where: {
                OR: [
                    { fromUserId: userId },
                    { toUserId: userId }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        res.json({
            status: 'success',
            data: {
                messages: messages.reverse(), // Show oldest first
                total: messages.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Analyze symptoms (Patient-specific endpoint)
router.post('/analyze-symptoms', auth_1.authenticateToken, [
    (0, express_validator_1.body)('symptoms').isArray().notEmpty(),
    (0, express_validator_1.body)('symptoms.*').isString().notEmpty(),
    (0, express_validator_1.body)('patientHistory').optional().isObject()
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.userId;
        const userRole = req.user.role;
        if (userRole !== 'PATIENT') {
            throw (0, errorHandler_1.createError)('This endpoint is only available for patients', 403);
        }
        const { symptoms, patientHistory } = req.body;
        const redis = (0, redis_1.getRedis)();
        // Check cache first
        const cachedAnalysis = await redis.getPatientSymptomsCache(userId);
        if (cachedAnalysis && JSON.stringify(cachedAnalysis.symptoms) === JSON.stringify(symptoms)) {
            return res.json({
                status: 'success',
                data: {
                    analysis: cachedAnalysis.analysis,
                    cached: true
                }
            });
        }
        // Create symptom analysis message
        const aiMessage = {
            id: `symptom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            agentType: 'patient',
            fromUserId: userId,
            content: `Analyze symptoms: ${symptoms.join(', ')}`,
            messageType: 'symptom_analysis',
            metadata: { symptoms, patientHistory },
            timestamp: new Date(),
            isProcessed: false
        };
        // Process with Patient AI Agent
        const response = await patientAgent.processMessage(aiMessage);
        // Cache the analysis
        if (response.metadata?.analysis) {
            await redis.cachePatientSymptoms(userId, symptoms, response.metadata.analysis);
        }
        logger_1.logger.info(`Symptom analysis completed for patient: ${userId}`);
        res.json({
            status: 'success',
            data: {
                analysis: response.metadata?.analysis,
                recommendation: response.content,
                messageId: response.id
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Generate consultation summary (Doctor-specific endpoint)
router.post('/consultation-summary', auth_1.authenticateToken, [
    (0, express_validator_1.body)('appointmentId').isString().notEmpty(),
    (0, express_validator_1.body)('consultationNotes').isString().notEmpty()
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.userId;
        const userRole = req.user.role;
        if (userRole !== 'DOCTOR') {
            throw (0, errorHandler_1.createError)('This endpoint is only available for doctors', 403);
        }
        const { appointmentId, consultationNotes } = req.body;
        // Generate consultation summary using Doctor AI Agent
        const summary = await doctorAgent.generateConsultationSummary(appointmentId, consultationNotes);
        logger_1.logger.info(`Consultation summary generated by doctor: ${userId} for appointment: ${appointmentId}`);
        res.json({
            status: 'success',
            data: {
                summary,
                appointmentId
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Verify doctor credentials (Admin-specific endpoint)
router.post('/verify-doctor', auth_1.authenticateToken, [
    (0, express_validator_1.body)('doctorId').isString().notEmpty()
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userRole = req.user.role;
        if (userRole !== 'ADMIN') {
            throw (0, errorHandler_1.createError)('This endpoint is only available for admins', 403);
        }
        const { doctorId } = req.body;
        // Verify doctor credentials using Admin AI Agent
        const verification = await adminAgent.verifyDoctorCredentials(doctorId);
        logger_1.logger.info(`Doctor credential verification completed for: ${doctorId}`);
        res.json({
            status: 'success',
            data: verification
        });
    }
    catch (error) {
        next(error);
    }
});
// Get system alerts (Admin-specific endpoint)
router.get('/system-alerts', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userRole = req.user.role;
        if (userRole !== 'ADMIN') {
            throw (0, errorHandler_1.createError)('This endpoint is only available for admins', 403);
        }
        const redis = (0, redis_1.getRedis)();
        const alerts = await redis.getActiveAlerts();
        res.json({
            status: 'success',
            data: {
                alerts,
                count: alerts.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Detect fraud (Admin-specific endpoint)
router.post('/detect-fraud', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userRole = req.user.role;
        if (userRole !== 'ADMIN') {
            throw (0, errorHandler_1.createError)('This endpoint is only available for admins', 403);
        }
        // Run fraud detection using Admin AI Agent
        const fraudAlerts = await adminAgent.detectFraudulentActivity();
        logger_1.logger.info(`Fraud detection completed, found ${fraudAlerts.length} alerts`);
        res.json({
            status: 'success',
            data: {
                alerts: fraudAlerts,
                count: fraudAlerts.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Update doctor quality rankings (Admin-specific endpoint)
router.post('/update-quality-rankings', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userRole = req.user.role;
        if (userRole !== 'ADMIN') {
            throw (0, errorHandler_1.createError)('This endpoint is only available for admins', 403);
        }
        // Update doctor quality rankings using Admin AI Agent
        const updatedMetrics = await adminAgent.updateDoctorQualityRankings();
        logger_1.logger.info(`Doctor quality rankings updated for ${updatedMetrics.length} doctors`);
        res.json({
            status: 'success',
            data: {
                updatedMetrics,
                count: updatedMetrics.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=aiAgent.js.map