import express from 'express';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Create appointment
router.post('/', authenticateToken, [
  body('doctorId').isString().notEmpty(),
  body('scheduledAt').isISO8601(),
  body('symptoms').isArray().notEmpty(),
  body('type').isIn(['VIDEO', 'CHAT', 'EMERGENCY'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patientId = (req as any).user.userId;
    const { doctorId, scheduledAt, symptoms, type, duration = 30 } = req.body;
    
    const db = getDatabase();
    const redis = getRedis();

    // Verify doctor exists and is available
    const doctor = await db.user.findFirst({
      where: { id: doctorId, role: 'DOCTOR' },
      include: { doctorProfile: true }
    });

    if (!doctor) {
      throw createError('Doctor not found', 404);
    }

    // Check doctor availability (simplified)
    const appointmentTime = new Date(scheduledAt);
    const existingAppointment = await db.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt: appointmentTime,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
      }
    });

    if (existingAppointment) {
      throw createError('Doctor not available at this time', 409);
    }

    // Calculate risk score (simplified)
    const riskScore = symptoms.length > 3 ? 75 : 25;
    const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW';

    // Create appointment
    const appointment = await db.appointment.create({
      data: {
        patientId,
        doctorId,
        scheduledAt: appointmentTime,
        duration,
        type,
        symptoms,
        riskLevel,
        riskScore,
        paymentAmount: doctor.doctorProfile?.consultationFee || 500
      },
      include: {
        patient: {
          include: { patientProfile: true }
        },
        doctor: {
          include: { doctorProfile: true }
        }
      }
    });

    // Add to emergency queue if urgent
    if (type === 'EMERGENCY' || riskLevel === 'HIGH') {
      await redis.addToEmergencyQueue(patientId, riskLevel);
    }

    logger.info(`Appointment created: ${appointment.id}`);

    res.status(201).json({
      status: 'success',
      data: { appointment }
    });
  } catch (error) {
    next(error);
  }
});

// Get appointments for user
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { status, limit = 20, offset = 0 } = req.query;
    
    const db = getDatabase();

    const whereClause = userRole === 'PATIENT' 
      ? { patientId: userId }
      : { doctorId: userId };

    if (status) {
      (whereClause as any).status = status;
    }

    const appointments = await db.appointment.findMany({
      where: whereClause,
      include: {
        patient: { include: { patientProfile: true } },
        doctor: { include: { doctorProfile: true } },
        videoConsultation: true
      },
      orderBy: { scheduledAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      status: 'success',
      data: { appointments }
    });
  } catch (error) {
    next(error);
  }
});

// Get appointment by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const userId = (req as any).user.userId;
    
    const db = getDatabase();

    const appointment = await db.appointment.findFirst({
      where: {
        id: appointmentId,
        OR: [
          { patientId: userId },
          { doctorId: userId }
        ]
      },
      include: {
        patient: { include: { patientProfile: true } },
        doctor: { include: { doctorProfile: true } },
        videoConsultation: true,
        payments: true
      }
    });

    if (!appointment) {
      throw createError('Appointment not found', 404);
    }

    res.json({
      status: 'success',
      data: { appointment }
    });
  } catch (error) {
    next(error);
  }
});

// Update appointment status
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const appointmentId = req.params.id;
    const userId = (req as any).user.userId;
    const { status } = req.body;
    
    const db = getDatabase();

    // Verify appointment belongs to user
    const appointment = await db.appointment.findFirst({
      where: {
        id: appointmentId,
        OR: [
          { patientId: userId },
          { doctorId: userId }
        ]
      }
    });

    if (!appointment) {
      throw createError('Appointment not found', 404);
    }

    // Update appointment
    const updatedAppointment = await db.appointment.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        patient: { include: { patientProfile: true } },
        doctor: { include: { doctorProfile: true } }
      }
    });

    logger.info(`Appointment ${appointmentId} status updated to ${status}`);

    res.json({
      status: 'success',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    next(error);
  }
});

// Add consultation notes (Doctor only)
router.patch('/:id/notes', authenticateToken, requireRole(['DOCTOR']), [
  body('consultationNotes').isString().notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const appointmentId = req.params.id;
    const doctorId = (req as any).user.userId;
    const { consultationNotes } = req.body;
    
    const db = getDatabase();

    // Verify appointment belongs to doctor
    const appointment = await db.appointment.findFirst({
      where: {
        id: appointmentId,
        doctorId
      }
    });

    if (!appointment) {
      throw createError('Appointment not found', 404);
    }

    // Update consultation notes
    const updatedAppointment = await db.appointment.update({
      where: { id: appointmentId },
      data: { consultationNotes }
    });

    logger.info(`Consultation notes added to appointment ${appointmentId}`);

    res.json({
      status: 'success',
      data: { appointment: updatedAppointment }
    });
  } catch (error) {
    next(error);
  }
});

// Get available doctors
router.get('/doctors/available', authenticateToken, async (req, res, next) => {
  try {
    const { specialization, date, time } = req.query;
    const db = getDatabase();

    let whereClause: any = {
      role: 'DOCTOR',
      isActive: true,
      doctorProfile: {
        isVerified: true
      }
    };

    if (specialization) {
      whereClause.doctorProfile.specialization = {
        has: specialization
      };
    }

    const doctors = await db.user.findMany({
      where: whereClause,
      include: {
        doctorProfile: {
          include: {
            availabilitySlots: true,
            qualityMetrics: true
          }
        }
      },
      orderBy: {
        doctorProfile: {
          qualityScore: 'desc'
        }
      }
    });

    // Filter by availability if date/time provided
    let availableDoctors = doctors;
    if (date && time) {
      const requestedDate = new Date(date as string);
      const dayOfWeek = requestedDate.getDay();
      
      availableDoctors = doctors.filter(doctor => {
        return doctor.doctorProfile?.availabilitySlots.some(slot => 
          slot.dayOfWeek === dayOfWeek && 
          slot.isAvailable &&
          slot.startTime <= (time as string) &&
          slot.endTime >= (time as string)
        );
      });
    }

    res.json({
      status: 'success',
      data: { 
        doctors: availableDoctors.map(doctor => ({
          id: doctor.id,
          profile: doctor.doctorProfile,
          qualityScore: doctor.doctorProfile?.qualityScore || 0
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get emergency queue (Admin/Doctor only)
router.get('/emergency/queue', authenticateToken, requireRole(['ADMIN', 'DOCTOR']), async (req, res, next) => {
  try {
    const redis = getRedis();
    const queueSize = await redis.getEmergencyQueueSize();
    
    res.json({
      status: 'success',
      data: { 
        queueSize,
        message: `${queueSize} patients in emergency queue`
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
