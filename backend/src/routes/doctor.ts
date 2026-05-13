import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { getDatabase } from '../config/database';

const router = express.Router();

// Get doctor profile
router.get('/profile', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const db = getDatabase();

    const doctor = await db.user.findUnique({
      where: { id: userId },
      include: {
        doctorProfile: {
          include: {
            qualityMetrics: true
          }
        }
      }
    });

    if (!doctor) {
      throw createError('Doctor not found', 404);
    }

    res.json({
      status: 'success',
      data: doctor
    });

  } catch (error) {
    next(error);
  }
});

// Update doctor profile
router.put('/profile', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { firstName, lastName, specialization, licenseNumber, experience, consultationFee } = req.body as {
      firstName?: string;
      lastName?: string;
      specialization?: string[];
      licenseNumber: string;
      experience?: string;
      consultationFee?: string;
    };
    const db = getDatabase();

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        doctorProfile: {
          upsert: {
            create: {
              firstName: firstName ?? '',
              lastName: lastName ?? '',
              specialization: specialization || [],
              licenseNumber,
              experience: experience ? parseInt(experience) : 0,
              consultationFee: consultationFee ? parseFloat(consultationFee) : 0,
              isVerified: false
            },
            update: {
              firstName: firstName ?? undefined,
              lastName: lastName ?? undefined,
              specialization: specialization || [],
              licenseNumber,
              experience: experience ? parseInt(experience) : undefined,
              consultationFee: consultationFee ? parseFloat(consultationFee) : undefined
            }
          }
        }
      },
      include: {
        doctorProfile: true
      }
    });

    res.json({
      status: 'success',
      data: updatedUser
    });

  } catch (error) {
    next(error);
  }
});

// Get doctor appointments
router.get('/appointments', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { status, date, limit = '10', offset = '0' } = req.query;
    const db = getDatabase();

    const whereClause: any = { doctorId: userId };
    if (status) {
      whereClause.status = status;
    }
    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      whereClause.scheduledAt = {
        gte: startDate,
        lt: endDate
      };
    }

    const appointments = await db.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: {
            patientProfile: true
          }
        }
      },
      orderBy: { scheduledAt: 'asc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await db.appointment.count({
      where: whereClause
    });

    res.json({
      status: 'success',
      data: {
        appointments,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get availability slots
router.get('/availability', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { date } = req.query;
    const db = getDatabase();

    let whereClause: any = { doctorId: userId };
    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      whereClause.startTime = {
        gte: startDate,
        lt: endDate
      };
    }

    const availabilitySlots = await db.availabilitySlot.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' }
    });

    res.json({
      status: 'success',
      data: availabilitySlots
    });

  } catch (error) {
    next(error);
  }
});

// Create availability slot
router.post('/availability', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { startTime, endTime, dayOfWeek, isAvailable } = req.body;
    const db = getDatabase();

    const availabilitySlot = await db.availabilitySlot.create({
      data: {
        doctorId: userId!,
        dayOfWeek,
        startTime,
        endTime,
        isAvailable: isAvailable !== false
      }
    });

    res.json({
      status: 'success',
      data: availabilitySlot
    });

  } catch (error) {
    next(error);
  }
});

// Update availability slot
router.put('/availability/:slotId', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { slotId } = req.params;
    const { dayOfWeek, startTime, endTime, isAvailable } = req.body as {
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      isAvailable?: boolean;
    };
    const db = getDatabase();

    // Verify slot belongs to doctor
    const existingSlot = await db.availabilitySlot.findFirst({
      where: {
        id: slotId,
        doctorId: userId
      }
    });

    if (!existingSlot) {
      throw createError('Availability slot not found', 404);
    }

    const updatedSlot = await db.availabilitySlot.update({
      where: { id: slotId },
      data: {
        dayOfWeek: dayOfWeek ?? undefined,
        startTime: startTime ?? undefined,
        endTime: endTime ?? undefined,
        isAvailable
      }
    });

    res.json({
      status: 'success',
      data: updatedSlot
    });

  } catch (error) {
    next(error);
  }
});

// Get quality metrics
router.get('/quality-metrics', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const db = getDatabase();

    const qualityMetrics = await db.doctorQualityMetrics.findUnique({
      where: { doctorId: userId }
    });

    res.json({
      status: 'success',
      data: qualityMetrics || {
        patientSatisfactionScore: 0,
        averageConsultationTime: 0,
        totalConsultations: 0,
        responseTimeScore: 0,
        treatmentSuccessRate: 0
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get patient insights
router.get('/patient-insights', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const db = getDatabase();

    // Get recent appointments and patient data
    const appointments = await db.appointment.findMany({
      where: { doctorId: userId },
      include: {
        patient: {
          include: { patientProfile: true }
        }
      },
      orderBy: { scheduledAt: 'desc' },
      take: 20
    });

    const insights = {
      totalPatients: appointments.length,
      recentPatients: appointments.slice(0, 5).map(apt => ({
        id: apt.patient.id,
        name: `${apt.patient.patientProfile?.firstName || ''} ${apt.patient.patientProfile?.lastName || ''}`.trim(),
        lastVisit: apt.scheduledAt,
        status: apt.status
      })),
      patientDemographics: {
        ageGroups: { '18-30': 5, '31-50': 8, '51-70': 4, '70+': 3 },
        commonConditions: ['Hypertension', 'Diabetes', 'Anxiety']
      }
    };

    res.json({
      status: 'success',
      data: insights
    });

  } catch (error) {
    next(error);
  }
});

// Create prescription
router.post('/prescription', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { medicalRecordId, medications, instructions, diagnosis } = req.body;
    const db = getDatabase();

    const prescription = await db.prescription.create({
      data: {
        medicalRecordId,
        medicationName: medications?.medicationName ?? '',
        genericName: medications?.genericName,
        dosage: medications?.dosage ?? '',
        frequency: medications?.frequency ?? '',
        duration: medications?.duration ?? '',
        instructions,
        warnings: medications?.warnings || [],
        interactions: medications?.interactions || []
      }
    });

    res.json({
      status: 'success',
      data: prescription
    });

  } catch (error) {
    next(error);
  }
});

// Create medical record
router.post('/medical-record', authenticateToken, requireRole('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { patientId, appointmentId, treatment, notes, diagnosis, symptoms, visitSummary, followUpRequired } = req.body as {
      patientId: string;
      appointmentId?: string;
      treatment?: string;
      notes?: string;
      diagnosis: string;
      symptoms?: string[];
      visitSummary?: string;
      followUpRequired?: boolean;
    };
    const db = getDatabase();

    const medicalRecord = await db.medicalRecord.create({
      data: {
        patientId,
        doctorId: userId!,
        diagnosis,
        symptoms: symptoms || [],
        visitSummary: visitSummary || treatment || notes || '',
        aiRecommendation: notes || '',
        riskLevel: 'LOW',
        riskScore: 0,
        riskFactors: [],
        followUpRequired: followUpRequired || false
      }
    });

    res.json({
      status: 'success',
      data: medicalRecord
    });

  } catch (error) {
    next(error);
  }
});

export default router;
