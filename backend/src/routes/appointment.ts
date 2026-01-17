import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

function parseTimeToMinutes(time: string): number {
  const [hh, mm] = String(time || '').split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return Math.max(0, Math.min(23, hh)) * 60 + Math.max(0, Math.min(59, mm));
}

function addMinutesToDate(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function cleanupExpiredHolds(db: any) {
  const now = new Date();
  try {
    await (db as any).appointmentSlotHold.updateMany({
      where: { status: 'HELD', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' }
    });
  } catch {
    // ignore
  }
}

// List available slots for a doctor (BookMyShow-style)
router.get('/slots', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { doctorId, days = '7', slotMinutes = '30' } = req.query as any;
    if (!doctorId) {
      throw createError('doctorId is required', 400);
    }

    const db = getDatabase();
    await cleanupExpiredHolds(db);

    const d = await db.user.findFirst({ where: { id: String(doctorId), role: 'DOCTOR' }, include: { doctorProfile: { include: { availabilitySlots: true } } } });
    if (!d) throw createError('Doctor not found', 404);

    const daysN = Math.max(1, Math.min(14, parseInt(String(days), 10) || 7));
    const slotM = Math.max(10, Math.min(60, parseInt(String(slotMinutes), 10) || 30));

    const availabilitySlots = (d as any).doctorProfile?.availabilitySlots || [];
    const now = new Date();

    const candidates: Date[] = [];
    for (let dayOffset = 0; dayOffset < daysN; dayOffset++) {
      const date = startOfDay(addMinutesToDate(now, dayOffset * 24 * 60));
      const dow = date.getDay();
      const daySlots = availabilitySlots.filter((s: any) => s?.isAvailable && s?.dayOfWeek === dow);
      for (const s of daySlots) {
        const startMin = parseTimeToMinutes(s.startTime);
        const endMin = parseTimeToMinutes(s.endTime);
        for (let m = startMin; m + slotM <= endMin; m += slotM) {
          const candidate = addMinutesToDate(date, m);
          if (candidate.getTime() >= now.getTime() + 2 * 60 * 1000) candidates.push(candidate);
        }
      }
    }

    const endWindow = addMinutesToDate(now, daysN * 24 * 60);
    const [existingAppointments, holds] = await Promise.all([
      db.appointment.findMany({
        where: { doctorId: String(doctorId), scheduledAt: { gte: now, lte: endWindow }, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
        select: { scheduledAt: true }
      }),
      (db as any).appointmentSlotHold.findMany({
        where: { doctorId: String(doctorId), status: 'HELD', expiresAt: { gt: now } },
        select: { scheduledAt: true, expiresAt: true, patientId: true }
      })
    ]);

    const taken = new Set(existingAppointments.map((a: any) => new Date(a.scheduledAt).getTime()));
    const held = new Set(holds.map((h: any) => new Date(h.scheduledAt).getTime()));

    const available = candidates
      .filter((c) => !taken.has(c.getTime()) && !held.has(c.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
      .slice(0, 120);

    res.json({
      status: 'success',
      data: {
        slots: available.map((d) => d.toISOString()),
        slotMinutes: slotM,
        days: daysN
      }
    });
  } catch (err) {
    next(err);
  }
});

// Hold a slot for a patient (short TTL)
router.post(
  '/slots/hold',
  authenticateToken,
  requireRole(['PATIENT']),
  [body('doctorId').isString().notEmpty(), body('scheduledAt').isISO8601(), body('ttlSeconds').optional().isInt({ min: 30, max: 600 })],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const patientId = (req as any).user.userId;
      const { doctorId, scheduledAt, ttlSeconds = 180 } = req.body;

      const db = getDatabase();
      await cleanupExpiredHolds(db);

      const slot = new Date(scheduledAt);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + Math.max(30, Math.min(600, Number(ttlSeconds))) * 1000);

      const existingAppointment = await db.appointment.findFirst({
        where: { doctorId, scheduledAt: slot, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } }
      });
      if (existingAppointment) throw createError('Slot already booked', 409);

      const existingHold = await (db as any).appointmentSlotHold.findFirst({
        where: { doctorId, scheduledAt: slot, status: 'HELD', expiresAt: { gt: now } }
      });
      if (existingHold) throw createError('Slot temporarily held', 409);

      const hold = await (db as any).appointmentSlotHold.create({
        data: { patientId, doctorId, scheduledAt: slot, status: 'HELD', expiresAt }
      });

      res.status(201).json({ status: 'success', data: { hold } });
    } catch (err) {
      next(err);
    }
  }
);

// Confirm a held slot -> create appointment
router.post(
  '/slots/confirm',
  authenticateToken,
  requireRole(['PATIENT']),
  [
    body('holdId').isString().notEmpty(),
    body('type').isIn(['VIDEO', 'CHAT', 'EMERGENCY']),
    body('symptoms').isArray().optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const patientId = (req as any).user.userId;
      const { holdId, type, symptoms = [] } = req.body;

      const db = getDatabase();
      await cleanupExpiredHolds(db);

      const hold = await (db as any).appointmentSlotHold.findFirst({ where: { id: holdId, patientId, status: 'HELD' } });
      if (!hold) throw createError('Hold not found', 404);
      if (new Date(hold.expiresAt).getTime() <= Date.now()) {
        await (db as any).appointmentSlotHold.update({ where: { id: holdId }, data: { status: 'EXPIRED' } });
        throw createError('Hold expired', 409);
      }

      const doctor = await db.user.findFirst({ where: { id: hold.doctorId, role: 'DOCTOR' }, include: { doctorProfile: true } });
      if (!doctor) throw createError('Doctor not found', 404);

      const riskScore = Array.isArray(symptoms) && symptoms.length > 3 ? 75 : 25;
      const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW';

      const appointment = await db.appointment.create({
        data: {
          patientId,
          doctorId: hold.doctorId,
          scheduledAt: new Date(hold.scheduledAt),
          duration: 30,
          type,
          symptoms: Array.isArray(symptoms) ? symptoms.map((s: any) => String(s)) : [],
          riskLevel,
          riskScore,
          paymentAmount: (doctor as any).doctorProfile?.consultationFee || 500
        },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });

      await (db as any).appointmentSlotHold.update({
        where: { id: holdId },
        data: { status: 'CONFIRMED', appointmentId: appointment.id }
      });

      res.status(201).json({ status: 'success', data: { appointment } });
    } catch (err) {
      next(err);
    }
  }
);

// Create appointment
router.post('/', authenticateToken, [
  body('doctorId').isString().notEmpty(),
  body('scheduledAt').isISO8601(),
  body('symptoms').isArray().notEmpty(),
  body('type').isIn(['VIDEO', 'CHAT', 'EMERGENCY'])
], async (req: Request, res: Response, next: NextFunction) => {
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

    // Add to emergency queue if urgent (skip if Redis not available)
    if ((type === 'EMERGENCY' || riskLevel === 'HIGH') && redis) {
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
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
], async (req: Request, res: Response, next: NextFunction) => {
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
], async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/doctors/available', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/emergency/queue', authenticateToken, requireRole(['ADMIN', 'DOCTOR']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const redis = getRedis();
    const queueSize = redis ? await redis.getEmergencyQueueSize() : 0;
    
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
