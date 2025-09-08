import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { PatientAIAgent } from '../agents/PatientAIAgent';
import { DoctorAIAgent } from '../agents/DoctorAIAgent';
import { AdminAIAgent } from '../agents/AdminAIAgent';

const router = express.Router();

// Lazy-loaded AI agents
let patientAgent: PatientAIAgent;
let doctorAgent: DoctorAIAgent;
let adminAgent: AdminAIAgent;

function getAgents() {
  if (!patientAgent) {
    patientAgent = new PatientAIAgent();
    doctorAgent = new DoctorAIAgent();
    adminAgent = new AdminAIAgent();
  }
  return { patientAgent, doctorAgent, adminAgent };
}

// Chat with AI agent
router.post('/chat', authenticateToken, [
  body('message').notEmpty().trim(),
  body('messageType').optional().isIn(['text', 'symptom_analysis', 'appointment_booking', 'prescription', 'alert']),
  body('metadata').optional().isObject()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, messageType = 'text', metadata } = req.body;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    
    const db = getDatabase();
    const redis = getRedis();

    // Rate limiting check (skip if Redis not available)
    if (redis) {
      const canProceed = await redis.checkRateLimit(userId, 'ai_chat', 50, 3600); // 50 messages per hour
      if (!canProceed) {
        throw createError('Rate limit exceeded. Please try again later.', 429);
      }
    }

    // Create AI message
    const aiMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentType: userRole.toLowerCase() as 'patient' | 'doctor' | 'admin',
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
        agentType: aiMessage.agentType.toUpperCase() as any,
        fromUserId: userId,
        content: message,
        messageType: messageType.toUpperCase() as any,
        metadata: metadata || {},
        isProcessed: false
      }
    });

    // Route to appropriate AI agent
    const { patientAgent, doctorAgent, adminAgent } = getAgents();
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
        throw createError('Invalid user role', 400);
    }

    // Store response in database
    await db.aIAgentMessage.create({
      data: {
        id: response.id,
        agentType: response.agentType.toUpperCase() as any,
        fromUserId: response.fromUserId,
        toUserId: response.toUserId,
        content: response.content,
        messageType: response.messageType.toUpperCase() as any,
        metadata: response.metadata || {},
        isProcessed: true
      }
    });

    logger.info(`AI chat processed for user: ${userId}, agent: ${userRole}`);

    res.json({
      status: 'success',
      data: {
        message: response,
        conversationId: aiMessage.id
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get chat history
router.get('/chat/history', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const { limit = 50, offset = 0 } = req.query;
    
    const db = getDatabase();

    const messages = await db.aIAgentMessage.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      status: 'success',
      data: {
        messages: messages.reverse(), // Show oldest first
        total: messages.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Analyze symptoms (Patient-specific endpoint)
router.post('/analyze-symptoms', authenticateToken, [
  body('symptoms').isArray().notEmpty(),
  body('symptoms.*').isString().notEmpty(),
  body('patientHistory').optional().isObject()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (userRole !== 'PATIENT') {
      throw createError('This endpoint is only available for patients', 403);
    }

    const { symptoms, patientHistory } = req.body;
    const redis = getRedis();

    // Check cache first (skip if Redis not available)
    let cachedAnalysis = null;
    if (redis) {
      cachedAnalysis = await redis.getPatientSymptomsCache(userId);
    }
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
      agentType: 'patient' as const,
      fromUserId: userId,
      content: `Analyze symptoms: ${symptoms.join(', ')}`,
      messageType: 'symptom_analysis' as const,
      metadata: { symptoms, patientHistory },
      timestamp: new Date(),
      isProcessed: false
    };

    // Process with Patient AI Agent
    const response = await patientAgent.processMessage(aiMessage);

    // Cache the analysis (skip if Redis not available)
    if (redis && response.metadata?.analysis) {
      await redis.cachePatientSymptoms(userId, symptoms, response.metadata.analysis);
    }

    logger.info(`Symptom analysis completed for patient: ${userId}`);

    res.json({
      status: 'success',
      data: {
        analysis: response.metadata?.analysis,
        recommendation: response.content,
        messageId: response.id
      }
    });
  } catch (error) {
    next(error);
  }
});

// Generate consultation summary (Doctor-specific endpoint)
router.post('/consultation-summary', authenticateToken, [
  body('appointmentId').isString().notEmpty(),
  body('consultationNotes').isString().notEmpty()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (userRole !== 'DOCTOR') {
      throw createError('This endpoint is only available for doctors', 403);
    }

    const { appointmentId, consultationNotes } = req.body;

    // Generate consultation summary using Doctor AI Agent
    const summary = await doctorAgent.generateConsultationSummary(appointmentId, consultationNotes);

    logger.info(`Consultation summary generated by doctor: ${userId} for appointment: ${appointmentId}`);

    res.json({
      status: 'success',
      data: {
        summary,
        appointmentId
      }
    });
  } catch (error) {
    next(error);
  }
});

// Verify doctor credentials (Admin-specific endpoint)
router.post('/verify-doctor', authenticateToken, [
  body('doctorId').isString().notEmpty()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userRole = (req as any).user.role;

    if (userRole !== 'ADMIN') {
      throw createError('This endpoint is only available for admins', 403);
    }

    const { doctorId } = req.body;

    // Verify doctor credentials using Admin AI Agent
    const verification = await adminAgent.verifyDoctorCredentials(doctorId);

    logger.info(`Doctor credential verification completed for: ${doctorId}`);

    res.json({
      status: 'success',
      data: verification
    });
  } catch (error) {
    next(error);
  }
});

// Get system alerts (Admin-specific endpoint)
router.get('/system-alerts', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user.role;

    if (userRole !== 'ADMIN') {
      throw createError('This endpoint is only available for admins', 403);
    }

    const redis = getRedis();
    let alerts: any[] = [];
    if (redis) {
      alerts = await redis.getActiveAlerts();
    }

    res.json({
      status: 'success',
      data: {
        alerts,
        count: alerts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Detect fraud (Admin-specific endpoint)
router.post('/detect-fraud', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user.role;

    if (userRole !== 'ADMIN') {
      throw createError('This endpoint is only available for admins', 403);
    }

    // Run fraud detection using Admin AI Agent
    const fraudAlerts = await adminAgent.detectFraudulentActivity();

    logger.info(`Fraud detection completed, found ${fraudAlerts.length} alerts`);

    res.json({
      status: 'success',
      data: {
        alerts: fraudAlerts,
        count: fraudAlerts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update doctor quality rankings (Admin-specific endpoint)
router.post('/update-quality-rankings', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user.role;

    if (userRole !== 'ADMIN') {
      throw createError('This endpoint is only available for admins', 403);
    }

    // Update doctor quality rankings using Admin AI Agent
    const updatedMetrics = await adminAgent.updateDoctorQualityRankings();

    logger.info(`Doctor quality rankings updated for ${updatedMetrics.length} doctors`);

    res.json({
      status: 'success',
      data: {
        updatedMetrics,
        count: updatedMetrics.length
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
