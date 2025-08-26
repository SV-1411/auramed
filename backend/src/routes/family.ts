import express from 'express';
import { PrismaClient, AppointmentType, RiskLevel } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Add family member
router.post('/add-member', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, name, relationship, dateOfBirth } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!relationship || !dateOfBirth || (!name && (!firstName || !lastName))) {
      return res.status(400).json({ error: 'firstName/lastName or name, relationship and dateOfBirth are required' });
    }

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const fullName = name || `${firstName} ${lastName}`.trim();

    const familyMember = await prisma.familyMember.create({
      data: {
        patientId: patientProfile.id,
        name: fullName,
        relationship,
        dateOfBirth: new Date(dateOfBirth)
      }
    });

    res.json({
      success: true,
      data: familyMember
    });

  } catch (error) {
    logger.error('Failed to add family member:', error);
    res.status(500).json({ error: 'Failed to add family member' });
  }
});

// Get family members
router.get('/members', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMembers = await prisma.familyMember.findMany({
      where: { patientId: patientProfile.id }
    });

    res.json({
      success: true,
      data: familyMembers
    });

  } catch (error) {
    logger.error('Failed to get family members:', error);
    res.status(500).json({ error: 'Failed to get family members' });
  }
});

// Update family member
router.put('/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user?.id;
    const updateData = req.body;

    // Verify family member belongs to user
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    const updatedMember = await prisma.familyMember.update({
      where: { id: memberId },
      data: {
        name: updateData.name || (updateData.firstName && updateData.lastName ? `${updateData.firstName} ${updateData.lastName}`.trim() : undefined),
        relationship: updateData.relationship,
        dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined
      }
    });

    res.json({
      success: true,
      data: updatedMember
    });

  } catch (error) {
    logger.error('Failed to update family member:', error);
    res.status(500).json({ error: 'Failed to update family member' });
  }
});

// Delete family member
router.delete('/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user?.id;

    // Verify family member belongs to user
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    await prisma.familyMember.delete({
      where: { id: memberId }
    });

    res.json({
      success: true,
      message: 'Family member removed successfully'
    });

  } catch (error) {
    logger.error('Failed to delete family member:', error);
    res.status(500).json({ error: 'Failed to delete family member' });
  }
});

// Book appointment for family member
router.post('/member/:memberId/appointment', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { doctorId, scheduledAt, symptoms, notes } = req.body;
    const userId = req.user?.id;

    // Verify family member belongs to user
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patientProfile) return res.status(400).json({ error: 'Patient profile not found' });

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        patientId: patientProfile.id
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: userId!, // Primary user books for family member
        doctorId,
        scheduledAt: new Date(scheduledAt),
        duration: 30,
        type: AppointmentType.VIDEO,
        symptoms: symptoms || [],
        consultationNotes: `Appointment for family member: ${familyMember.name} (${familyMember.relationship}). ${notes || ''}`,
        riskLevel: RiskLevel.LOW,
        riskScore: 0,
        paymentAmount: 500
      }
    });

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    logger.error('Failed to book family appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment for family member' });
  }
});

export default router;
