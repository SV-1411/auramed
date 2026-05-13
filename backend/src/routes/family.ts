import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient, AppointmentType, RiskLevel } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Add family member with comprehensive profile
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      firstName,
      lastName,
      relationship,
      dateOfBirth,
      gender,
      phone,
      emergencyContact,
      medicalHistory,
      allergies,
      currentMedications
    } = req.body;

    const userId = (req as any).user?.userId;
    if (!userId) throw createError('Unauthorized', 401);

    if (!firstName || !lastName || !relationship) {
      throw createError('firstName, lastName, and relationship are required', 400);
    }

    let patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) {
      // Auto-create a minimal patient profile so the Family page doesn't 400 for new users
      patientProfile = await prisma.patientProfile.create({
        data: {
          userId,
          firstName: 'Patient',
          lastName: 'User',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'OTHER',
          emergencyContact: '',
          preferredLanguage: 'en'
        }
      });
    }

    const familyMember = await prisma.familyMember.create({
      data: {
        patientId: patientProfile.id,
        firstName,
        lastName,
        relationship,
        dateOfBirth: new Date(dateOfBirth),
        gender: gender || 'OTHER',
        phone,
        emergencyContact,
        medicalHistory: medicalHistory || [],
        allergies: allergies || [],
        currentMedications: currentMedications || [],
        isActive: true
      }
    });

    res.json({
      status: 'success',
      data: { familyMember },
      message: 'Family member added successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Get all family members with comprehensive data
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw createError('Unauthorized', 401);

    let patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) {
      // Auto-create a minimal profile so Family page loads for first-time users
      patientProfile = await prisma.patientProfile.create({
        data: {
          userId,
          firstName: 'Patient',
          lastName: 'User',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'OTHER',
          emergencyContact: '',
          preferredLanguage: 'en'
        }
      });
    }

    const familyMembers = await prisma.familyMember.findMany({
      where: {
        patientId: patientProfile.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: { familyMembers },
      count: familyMembers.length
    });

  } catch (error) {
    next(error);
  }
});

// Update family member with comprehensive data
router.put('/:memberId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    const userId = (req as any).user?.userId;
    const updateData = req.body;

    if (!userId) throw createError('Unauthorized', 401);

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) throw createError('Patient profile not found', 400);

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      throw createError('Family member not found', 404);
    }

    const updatedMember = await prisma.familyMember.update({
      where: { id: memberId },
      data: {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        relationship: updateData.relationship,
        dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
        gender: updateData.gender,
        phone: updateData.phone,
        emergencyContact: updateData.emergencyContact,
        medicalHistory: updateData.medicalHistory || [],
        allergies: updateData.allergies || [],
        currentMedications: updateData.currentMedications || []
      }
    });

    res.json({
      status: 'success',
      data: { familyMember: updatedMember },
      message: 'Family member updated successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Delete family member (soft delete)
router.delete('/:memberId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) throw createError('Unauthorized', 401);

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) throw createError('Patient profile not found', 400);

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      throw createError('Family member not found', 404);
    }

    // Soft delete - mark as inactive
    await prisma.familyMember.update({
      where: { id: memberId },
      data: { isActive: false }
    });

    res.json({
      status: 'success',
      message: 'Family member removed successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Get family member statistics
router.get('/stats', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw createError('Unauthorized', 401);

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) throw createError('Patient profile not found', 400);

    const familyMembers = await prisma.familyMember.findMany({
      where: {
        patientId: patientProfile.id,
        isActive: true
      }
    });

    const stats = {
      totalMembers: familyMembers.length,
      totalMedicalRecords: familyMembers.reduce((acc, member) => acc + (member.medicalHistory?.length || 0), 0),
      totalAllergies: familyMembers.reduce((acc, member) => acc + (member.allergies?.length || 0), 0),
      totalMedications: familyMembers.reduce((acc, member) => acc + (member.currentMedications?.length || 0), 0),
      byRelationship: familyMembers.reduce((acc, member) => {
        acc[member.relationship] = (acc[member.relationship] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      status: 'success',
      data: { stats }
    });

  } catch (error) {
    next(error);
  }
});

// Book appointment for family member
router.post('/:memberId/appointment', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    const {
      doctorId,
      scheduledAt,
      symptoms,
      notes,
      appointmentType = 'VIDEO',
      duration = 30
    } = req.body;

    const userId = (req as any).user?.userId;
    if (!userId) throw createError('Unauthorized', 401);

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) throw createError('Patient profile not found', 400);

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      throw createError('Family member not found', 404);
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: userId,
        doctorId,
        scheduledAt: new Date(scheduledAt),
        duration,
        type: appointmentType as AppointmentType,
        symptoms: symptoms || [],
        consultationNotes: `Appointment for family member: ${familyMember.firstName} ${familyMember.lastName} (${familyMember.relationship}). ${notes || ''}`,
        riskLevel: RiskLevel.LOW,
        riskScore: 0,
        paymentAmount: 500,
        status: 'SCHEDULED'
      }
    });

    res.json({
      status: 'success',
      data: { appointment },
      message: `Appointment booked for ${familyMember.firstName} ${familyMember.lastName}`
    });

  } catch (error) {
    next(error);
  }
});

// Get family member medical history
router.get('/:memberId/medical-history', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) throw createError('Unauthorized', 401);

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) throw createError('Patient profile not found', 400);

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      throw createError('Family member not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        familyMember: {
          id: familyMember.id,
          name: `${familyMember.firstName} ${familyMember.lastName}`,
          medicalHistory: familyMember.medicalHistory,
          allergies: familyMember.allergies,
          currentMedications: familyMember.currentMedications
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;
