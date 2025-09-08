import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { ConsultationService } from '../services/ConsultationService';
import { logger } from '../utils/logger';

const router = express.Router();
const consultationService = new ConsultationService();

// Create consultation for appointment
router.post('/', authenticateToken, [
  body('appointmentId').isString().notEmpty()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).user.userId;
    const { appointmentId } = req.body;

    // Get appointment to determine patient and doctor
    const appointment = await consultationService.getAppointmentById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify user is part of this appointment
    if (appointment.patientId !== userId && appointment.doctorId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const consultation = await consultationService.createConsultation(
      appointmentId,
      appointment.patientId,
      appointment.doctorId
    );

    res.status(201).json({
      status: 'success',
      data: { consultation },
      message: 'Consultation started successfully'
    });

  } catch (error) {
    logger.error('Error creating consultation:', error);
    next(error);
  }
});

// Get consultation messages
router.get('/:consultationId/messages', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consultationId = req.params.consultationId;
    const userId = (req as any).user.userId;

    const messages = await consultationService.getConsultationMessages(consultationId, userId);

    res.json({
      status: 'success',
      data: { messages }
    });

  } catch (error) {
    logger.error('Error fetching consultation messages:', error);
    next(error);
  }
});

// Add message to consultation
router.post('/:consultationId/messages', authenticateToken, [
  body('content').isString().notEmpty(),
  body('messageType').optional().isIn(['TEXT', 'IMAGE', 'FILE'])
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const consultationId = req.params.consultationId;
    const userId = (req as any).user.userId;
    const { content, messageType = 'TEXT' } = req.body;

    const message = await consultationService.addMessage(
      consultationId,
      userId,
      content,
      messageType
    );

    res.status(201).json({
      status: 'success',
      data: { message }
    });

  } catch (error) {
    logger.error('Error adding consultation message:', error);
    next(error);
  }
});

// Complete consultation
router.post('/:consultationId/complete', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consultationId = req.params.consultationId;
    const userId = (req as any).user.userId;

    const summary = await consultationService.completeConsultation(consultationId, userId);

    res.json({
      status: 'success',
      data: { summary },
      message: 'Consultation completed successfully'
    });

  } catch (error) {
    logger.error('Error completing consultation:', error);
    next(error);
  }
});

// Get consultation summary
router.get('/:consultationId/summary', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consultationId = req.params.consultationId;
    const userId = (req as any).user.userId;

    const summary = await consultationService.getConsultationSummary(consultationId, userId);

    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    res.json({
      status: 'success',
      data: { summary }
    });

  } catch (error) {
    logger.error('Error fetching consultation summary:', error);
    next(error);
  }
});

// Get active consultations for user
router.get('/active', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;

    const consultations = await consultationService.getActiveConsultations(userId);

    res.json({
      status: 'success',
      data: { consultations }
    });

  } catch (error) {
    logger.error('Error fetching active consultations:', error);
    next(error);
  }
});

export default router;
