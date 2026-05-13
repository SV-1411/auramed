import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { getDatabase } from '../config/database';

const router = express.Router();

// Get patient profile
router.get('/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const db = getDatabase();

    const profile = await db.patientProfile.findUnique({
      where: { userId },
      include: { familyMembers: true }
    });

    if (!profile) {
      throw createError('Patient profile not found', 404);
    }

    res.json({
      status: 'success',
      data: profile
    });

  } catch (error) {
    next(error);
  }
});

// Update patient profile
router.put('/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { firstName, lastName, dateOfBirth, gender, emergencyContact, preferredLanguage } = req.body;
    const db = getDatabase();

    const updated = await db.patientProfile.upsert({
      where: { userId },
      update: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        emergencyContact,
        preferredLanguage
      },
      create: {
        userId: userId!,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
        gender: gender || 'OTHER',
        emergencyContact,
        preferredLanguage: preferredLanguage || 'en'
      }
    });

    res.json({
      status: 'success',
      data: updated
    });

  } catch (error) {
    next(error);
  }
});

// Get patient appointments
router.get('/appointments', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { status, limit = '10', offset = '0' } = req.query;
    const db = getDatabase();

    const whereClause: any = { patientId: userId };
    if (status) {
      const st = String(status).toUpperCase();
      const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (validStatuses.includes(st)) {
        whereClause.status = st;
      }
    }

    const appointments = await db.appointment.findMany({
      where: whereClause,
      include: {
        doctor: {
          include: {
            doctorProfile: true
          }
        }
      },
      orderBy: { scheduledAt: 'desc' },
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

// Get medical records
router.get('/medical-records', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const db = getDatabase();

    const medicalRecords = await db.medicalRecord.findMany({
      where: { patientId: userId },
      include: {
        doctor: {
          include: {
            doctorProfile: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json({
      status: 'success',
      data: medicalRecords
    });

  } catch (error) {
    next(error);
  }
});

// Get prescriptions
router.get('/prescriptions', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const db = getDatabase();

    const prescriptions = await db.prescription.findMany({
      where: { medicalRecord: { patientId: userId } },
      include: {
        medicalRecord: {
          include: {
            doctor: { include: { doctorProfile: true } }
          }
        }
      },
      orderBy: { medicalRecord: { date: 'desc' } }
    });

    res.json({
      status: 'success',
      data: prescriptions
    });

  } catch (error) {
    next(error);
  }
});

// Get health insights
router.get('/health-insights', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { limit = '5' } = req.query;
    const db = getDatabase();

    const insights = await db.healthInsight.findMany({
      where: { patientId: userId },
      orderBy: { generatedAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      status: 'success',
      data: { insights }
    });

  } catch (error) {
    next(error);
  }
});

export default router;

