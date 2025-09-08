import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Get doctor profile
router.get('/profile', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const doctor = await prisma.user.findUnique({
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
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      success: true,
      data: doctor
    });

  } catch (error) {
    logger.error('Failed to get doctor profile:', error);
    res.status(500).json({ error: 'Failed to get doctor profile' });
  }
});

// Update doctor profile
router.put('/profile', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, specialization, licenseNumber, experience, consultationFee } = req.body as {
      firstName?: string;
      lastName?: string;
      specialization?: string[];
      licenseNumber: string;
      experience?: string;
      consultationFee?: string;
    };

    const updatedUser = await prisma.user.update({
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
      success: true,
      data: updatedUser
    });

  } catch (error) {
    logger.error('Failed to update doctor profile:', error);
    res.status(500).json({ error: 'Failed to update doctor profile' });
  }
});

// Get doctor appointments
router.get('/appointments', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status, date, limit = 10, offset = 0 } = req.query;

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

    const appointments = await prisma.appointment.findMany({
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
    logger.error('Failed to get doctor appointments:', error);
    res.status(500).json({ error: 'Failed to get doctor appointments' });
  }
});

// Get availability slots
router.get('/availability', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { date } = req.query;

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

    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' }
    });

    res.json({
      success: true,
      data: availabilitySlots
    });

  } catch (error) {
    logger.error('Failed to get availability slots:', error);
    res.status(500).json({ error: 'Failed to get availability slots' });
  }
});

// Create availability slot
router.post('/availability', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { startTime, endTime, dayOfWeek, isAvailable } = req.body;

    const availabilitySlot = await prisma.availabilitySlot.create({
      data: {
        doctorId: userId!,
        dayOfWeek,
        startTime,
        endTime,
        isAvailable: isAvailable !== false
      }
    });

    res.json({
      success: true,
      data: availabilitySlot
    });

  } catch (error) {
    logger.error('Failed to create availability slot:', error);
    res.status(500).json({ error: 'Failed to create availability slot' });
  }
});

// Update availability slot
router.put('/availability/:slotId', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { slotId } = req.params;
    const { dayOfWeek, startTime, endTime, isAvailable } = req.body as {
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      isAvailable?: boolean;
    };

    // Verify slot belongs to doctor
    const existingSlot = await prisma.availabilitySlot.findFirst({
      where: {
        id: slotId,
        doctorId: userId
      }
    });

    if (!existingSlot) {
      return res.status(404).json({ error: 'Availability slot not found' });
    }

    const updatedSlot = await prisma.availabilitySlot.update({
      where: { id: slotId },
      data: {
        dayOfWeek: dayOfWeek ?? undefined,
        startTime: startTime ?? undefined,
        endTime: endTime ?? undefined,
        isAvailable
      }
    });

    res.json({
      success: true,
      data: updatedSlot
    });

  } catch (error) {
    logger.error('Failed to update availability slot:', error);
    res.status(500).json({ error: 'Failed to update availability slot' });
  }
});

// Get quality metrics
router.get('/quality-metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const qualityMetrics = await prisma.doctorQualityMetrics.findUnique({
      where: { doctorId: userId }
    });

    res.json({
      success: true,
      data: qualityMetrics || {
        patientSatisfactionScore: 0,
        averageConsultationTime: 0,
        totalConsultations: 0,
        responseTimeScore: 0,
        treatmentSuccessRate: 0
      }
    });

  } catch (error) {
    logger.error('Failed to get quality metrics:', error);
    res.status(500).json({ error: 'Failed to get quality metrics' });
  }
});

// Get patient insights
router.get('/patient-insights', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    // Get recent appointments and patient data
    const appointments = await prisma.appointment.findMany({
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
      success: true,
      data: insights
    });

  } catch (error) {
    logger.error('Failed to get patient insights:', error);
    res.status(500).json({ error: 'Failed to get patient insights' });
  }
});

// Create prescription
router.post('/prescription', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { medicalRecordId, medications, instructions, diagnosis } = req.body;

        const prescription = await prisma.prescription.create({
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
      success: true,
      data: prescription
    });

  } catch (error) {
    logger.error('Failed to create prescription:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// Create medical record
router.post('/medical-record', authenticateToken, requireRole('doctor'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
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

    const medicalRecord = await prisma.medicalRecord.create({
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
      success: true,
      data: medicalRecord
    });

  } catch (error) {
    logger.error('Failed to create medical record:', error);
    res.status(500).json({ error: 'Failed to create medical record' });
  }
});

export default router;
