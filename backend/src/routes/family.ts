import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Add family member
router.post('/add-member', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, relationship, dateOfBirth, gender, phoneNumber, medicalConditions } = req.body;
    const userId = req.user?.id;

    const familyMember = await prisma.familyMember.create({
      data: {
        primaryUserId: userId!,
        firstName,
        lastName,
        relationship,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        phoneNumber,
        medicalConditions: medicalConditions || []
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

    const familyMembers = await prisma.familyMember.findMany({
      where: { primaryUserId: userId },
      orderBy: { createdAt: 'desc' }
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
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        primaryUserId: userId
      }
    });

    if (!familyMember) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    const updatedMember = await prisma.familyMember.update({
      where: { id: memberId },
      data: {
        ...updateData,
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
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        primaryUserId: userId
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
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        primaryUserId: userId
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
        type: 'video',
        symptoms: symptoms || [],
        notes: `Appointment for family member: ${familyMember.firstName} ${familyMember.lastName} (${familyMember.relationship}). ${notes || ''}`,
        paymentStatus: 'pending',
        paymentAmount: 500,
        familyMemberId: memberId
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
