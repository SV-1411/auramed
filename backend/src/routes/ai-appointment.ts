import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { AIAppointmentService } from '../services/AIAppointmentService';
import { logger } from '../utils/logger';

const router = express.Router();
const aiAppointmentService = new AIAppointmentService();

// AI-powered symptom analysis and doctor recommendations
router.post('/analyze-symptoms', authenticateToken, [
  body('symptoms').isArray().notEmpty().withMessage('Symptoms array is required'),
  body('patientLocation').optional().isObject(),
  body('maxDistance').optional().isNumeric(),
  body('maxFee').optional().isNumeric(),
  body('preferredFee').optional().isNumeric(),
  body('urgency').optional().isIn(['ROUTINE', 'URGENT', 'EMERGENCY'])
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patientId = (req as any).user.userId;
    const { symptoms, patientLocation, maxDistance, maxFee, preferredFee, urgency } = req.body;

    const request = {
      patientId,
      symptoms,
      patientLocation,
      maxDistance: maxDistance || 50, // Default 50km radius
      maxFee: typeof maxFee === 'number' ? maxFee : undefined,
      preferredFee: typeof preferredFee === 'number' ? preferredFee : undefined,
      urgency: urgency || 'ROUTINE'
    };

    const result = await aiAppointmentService.analyzeAndRecommendDoctors(request);

    res.json({
      status: 'success',
      data: {
        analysis: result.analysis,
        recommendations: result.recommendations,
        message: result.analysis.severity === 'CRITICAL' 
          ? 'Emergency appointment has been auto-booked with the best available doctor.'
          : 'Here are the recommended doctors based on your symptoms.'
      }
    });

  } catch (error) {
    logger.error('Error in symptom analysis:', error);
    next(error);
  }
});

// Book appointment with selected doctor
router.post('/book', authenticateToken, [
  body('doctorId').isString().notEmpty(),
  body('scheduledAt').isISO8601(),
  body('symptoms').isArray().notEmpty(),
  body('analysis').isObject().notEmpty()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patientId = (req as any).user.userId;
    const { doctorId, scheduledAt, symptoms, analysis } = req.body;

    const appointment = await aiAppointmentService.bookAppointmentWithDoctor(
      patientId,
      doctorId,
      new Date(scheduledAt),
      symptoms,
      analysis
    );

    res.status(201).json({
      status: 'success',
      data: { appointment },
      message: 'Appointment booked successfully! AI profiles have been generated for both parties.'
    });

  } catch (error) {
    logger.error('Error booking appointment:', error);
    next(error);
  }
});

// Get AI-generated profiles for appointment
router.get('/appointment/:appointmentId/profiles', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointmentId = req.params.appointmentId;
    const userId = (req as any).user.userId;

    // Verify user has access to this appointment
    const appointment = await aiAppointmentService.getAppointmentById(appointmentId);
    if (!appointment || (appointment.patientId !== userId && appointment.doctorId !== userId)) {
      return res.status(404).json({ error: 'Appointment not found or access denied' });
    }

    const profiles = await aiAppointmentService.getAIProfiles(appointmentId, userId);

    res.json({
      status: 'success',
      data: { profiles }
    });

  } catch (error) {
    logger.error('Error fetching AI profiles:', error);
    next(error);
  }
});

// Get doctor profiles with ratings and availability
router.get('/doctors/profiles', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { specialization, location, maxDistance, sortBy } = req.query;

    const filters = {
      specialization: specialization as string,
      location: location ? JSON.parse(location as string) : undefined,
      maxDistance: maxDistance ? parseInt(maxDistance as string) : 50,
      sortBy: sortBy as string || 'rating'
    };

    const doctors = await aiAppointmentService.getDoctorProfiles(filters);

    res.json({
      status: 'success',
      data: { doctors }
    });

  } catch (error) {
    logger.error('Error fetching doctor profiles:', error);
    next(error);
  }
});

// Get emergency queue status (for doctors and admins)
router.get('/emergency/queue', authenticateToken, requireRole(['DOCTOR', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queueStatus = await aiAppointmentService.getEmergencyQueueStatus();

    res.json({
      status: 'success',
      data: { queueStatus }
    });

  } catch (error) {
    logger.error('Error fetching emergency queue:', error);
    next(error);
  }
});

// Accept emergency appointment (for doctors)
router.post('/emergency/:appointmentId/accept', authenticateToken, requireRole(['DOCTOR']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointmentId = req.params.appointmentId;
    const doctorId = (req as any).user.userId;

    const result = await aiAppointmentService.acceptEmergencyAppointment(appointmentId, doctorId);

    res.json({
      status: 'success',
      data: { appointment: result },
      message: 'Emergency appointment accepted successfully!'
    });

  } catch (error) {
    logger.error('Error accepting emergency appointment:', error);
    next(error);
  }
});

export default router;
