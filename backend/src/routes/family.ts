import express, { Request, Response } from 'express';
import { PrismaClient, AppointmentType, RiskLevel } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Add family member with comprehensive profile
router.post('/', authenticateToken, async (req, res) => {
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

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!firstName || !lastName || !relationship) {
      return res.status(400).json({ error: 'firstName, lastName, and relationship are required' });
    }

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

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
      success: true,
      data: { familyMember },
      message: 'Family member added successfully'
    });

  } catch (error) {
    logger.error('Failed to add family member:', error);
    res.status(500).json({ error: 'Failed to add family member' });
  }
});

// Get all family members with comprehensive data
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMembers = await prisma.familyMember.findMany({
      where: {
        patientId: patientProfile.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { familyMembers },
      count: familyMembers.length
    });

  } catch (error) {
    logger.error('Failed to get family members:', error);
    res.status(500).json({ error: 'Failed to get family members' });
  }
});

// Update family member with comprehensive data
router.put('/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user?.id;
    const updateData = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
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
      success: true,
      data: { familyMember: updatedMember },
      message: 'Family member updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update family member:', error);
    res.status(500).json({ error: 'Failed to update family member' });
  }
});

// Delete family member (soft delete)
router.delete('/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    // Soft delete - mark as inactive
    await prisma.familyMember.update({
      where: { id: memberId },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Family member removed successfully'
    });

  } catch (error) {
    logger.error('Failed to delete family member:', error);
    res.status(500).json({ error: 'Failed to remove family member' });
  }
});

// Get family member statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

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
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Failed to get family stats:', error);
    res.status(500).json({ error: 'Failed to get family statistics' });
  }
});

// Book appointment for family member
router.post('/:memberId/appointment', authenticateToken, async (req, res) => {
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

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
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
      success: true,
      data: { appointment },
      message: `Appointment booked for ${familyMember.firstName} ${familyMember.lastName}`
    });

  } catch (error) {
    logger.error('Failed to book family appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment for family member' });
  }
});

// Get family member medical history
router.get('/:memberId/medical-history', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id,
        isActive: true
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    res.json({
      success: true,
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
    logger.error('Failed to get family medical history:', error);
    res.status(500).json({ error: 'Failed to get medical history' });
  }
});

export default router;
