import express, { Request, Response } from 'express';
import { PrismaClient, AppointmentStatus } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Get patient profile
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      include: { familyMembers: true }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    logger.error('Failed to get patient profile:', error);
    res.status(500).json({ error: 'Failed to get patient profile' });
  }
});

// Update patient profile
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, dateOfBirth, gender, emergencyContact, preferredLanguage } = req.body;

    const updated = await prisma.patientProfile.upsert({
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
        dateOfBirth: new Date(dateOfBirth),
        gender,
        emergencyContact,
        preferredLanguage: preferredLanguage || 'en'
      }
    });

    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    logger.error('Failed to update patient profile:', error);
    res.status(500).json({ error: 'Failed to update patient profile' });
  }
});

// Get patient appointments
router.get('/appointments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status, limit = 10, offset = 0 } = req.query;

    const whereClause: any = { patientId: userId };
    if (status) {
      const st = String(status).toUpperCase() as keyof typeof AppointmentStatus;
      if (AppointmentStatus[st]) whereClause.status = AppointmentStatus[st];
    }

    const appointments = await prisma.appointment.findMany({
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

    const total = await prisma.appointment.count({
      where: whereClause
    });

    res.json({
      success: true,
      data: {
        appointments,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    logger.error('Failed to get patient appointments:', error);
    res.status(500).json({ error: 'Failed to get patient appointments' });
  }
});

// Get medical records
router.get('/medical-records', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const medicalRecords = await prisma.medicalRecord.findMany({
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
      success: true,
      data: medicalRecords
    });

  } catch (error) {
    logger.error('Failed to get medical records:', error);
    res.status(500).json({ error: 'Failed to get medical records' });
  }
});

// Get prescriptions
router.get('/prescriptions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const prescriptions = await prisma.prescription.findMany({
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
      success: true,
      data: prescriptions
    });

  } catch (error) {
    logger.error('Failed to get prescriptions:', error);
    res.status(500).json({ error: 'Failed to get prescriptions' });
  }
});

// Get health insights
router.get('/health-insights', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 5 } = req.query;

    const insights = await prisma.healthInsight.findMany({
      where: { patientId: userId },
      orderBy: { generatedAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: { insights }
    });

  } catch (error) {
    logger.error('Failed to get health insights:', error);
    res.status(500).json({ error: 'Failed to get health insights' });
  }
});

export default router;
