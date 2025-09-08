import express, { Request, Response } from 'express';
import { PrismaClient, VideoConsultationStatus } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

// Get available doctors for video consultation
router.get('/doctors/available', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you'd check doctor availability
    // For now, return mock available doctors
    const availableDoctors = [
      {
        id: 'doc1',
        name: 'Dr. Sarah Johnson',
        specialization: ['General Medicine', 'Internal Medicine'],
        experience: 8,
        rating: 4.8,
        availability: 'online' as const,
        profileImage: 'https://via.placeholder.com/100',
        nextAvailable: '2024-12-15T10:00:00Z'
      },
      {
        id: 'doc2',
        name: 'Dr. Michael Chen',
        specialization: ['Cardiology', 'Emergency Medicine'],
        experience: 12,
        rating: 4.9,
        availability: 'online' as const,
        profileImage: 'https://via.placeholder.com/100',
        nextAvailable: '2024-12-15T11:30:00Z'
      },
      {
        id: 'doc3',
        name: 'Dr. Emily Rodriguez',
        specialization: ['Pediatrics', 'Family Medicine'],
        experience: 6,
        rating: 4.7,
        availability: 'busy' as const,
        profileImage: 'https://via.placeholder.com/100',
        nextAvailable: '2024-12-15T14:00:00Z'
      }
    ];

    res.json({
      success: true,
      data: { doctors: availableDoctors },
      count: availableDoctors.length
    });

  } catch (error) {
    logger.error('Failed to get available doctors:', error);
    res.status(500).json({ error: 'Failed to get available doctors' });
  }
});

// Create instant video consultation
router.post('/instant', authenticateToken, async (req, res) => {
  try {
    const { doctorId, type = 'VIDEO', symptoms = [], notes } = req.body;
    const patientId = req.user?.id;

    if (!patientId) return res.status(401).json({ error: 'Unauthorized' });
    if (!doctorId) return res.status(400).json({ error: 'Doctor ID is required' });

    // Create appointment first
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        scheduledAt: new Date(), // Immediate consultation
        duration: 30,
        type: type,
        symptoms,
        consultationNotes: `Instant video consultation - ${notes || 'Emergency consultation'}`,
        riskLevel: 'HIGH',
        riskScore: 80,
        paymentAmount: 500,
        status: 'IN_PROGRESS'
      }
    });

    // Generate unique room ID and access token
    const roomId = crypto.randomUUID();
    const accessToken = crypto.randomBytes(32).toString('hex');

    // Create video consultation record
    const videoConsultation = await prisma.videoConsultation.create({
      data: {
        appointmentId: appointment.id,
        roomId,
        accessToken,
        patientId,
        doctorId,
        status: 'WAITING'
      }
    });

    // In a real implementation, you'd send notifications here
    // sendNotificationToDoctor(doctorId, videoConsultation);
    // sendNotificationToPatient(patientId, videoConsultation);

    res.json({
      success: true,
      data: {
        room: {
          id: videoConsultation.id,
          roomName: roomId,
          accessToken,
          appointmentId: appointment.id,
          status: videoConsultation.status,
          doctorId,
          patientId
        }
      },
      message: 'Video consultation room created successfully'
    });

  } catch (error) {
    logger.error('Failed to create instant consultation:', error);
    res.status(500).json({ error: 'Failed to create consultation' });
  }
});

// Join video consultation room
router.post('/join', authenticateToken, async (req, res) => {
  try {
    const { roomName, userId } = req.body;
    const currentUserId = req.user?.id;

    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });

    // Find the video consultation
    const videoConsultation = await prisma.videoConsultation.findUnique({
      where: { roomId: roomName },
      include: { appointment: true }
    });

    if (!videoConsultation) {
      return res.status(404).json({ error: 'Consultation room not found' });
    }

    // Verify user has access to this room
    if (videoConsultation.patientId !== currentUserId && videoConsultation.doctorId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied to this consultation' });
    }

    // Update participant status
    const updateData: any = {};
    if (videoConsultation.patientId === currentUserId) {
      updateData.patientJoined = true;
    } else if (videoConsultation.doctorId === currentUserId) {
      updateData.doctorJoined = true;
    }

    // If both participants have joined, start the consultation
    if (videoConsultation.patientJoined || videoConsultation.doctorJoined) {
      updateData.status = 'ACTIVE';
      updateData.startedAt = new Date();
    }

    const updatedConsultation = await prisma.videoConsultation.update({
      where: { id: videoConsultation.id },
      data: updateData
    });

    res.json({
      success: true,
      data: {
        consultation: {
          id: updatedConsultation.id,
          roomId: updatedConsultation.roomId,
          status: updatedConsultation.status,
          startedAt: updatedConsultation.startedAt,
          patientJoined: updatedConsultation.patientJoined,
          doctorJoined: updatedConsultation.doctorJoined
        }
      },
      message: 'Successfully joined consultation room'
    });

  } catch (error) {
    logger.error('Failed to join consultation room:', error);
    res.status(500).json({ error: 'Failed to join consultation' });
  }
});

// End video consultation
router.put('/:consultationId/end', authenticateToken, async (req, res) => {
  try {
    const { consultationId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const videoConsultation = await prisma.videoConsultation.findUnique({
      where: { id: consultationId },
      include: { appointment: true }
    });

    if (!videoConsultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    // Verify user has permission to end this consultation
    if (videoConsultation.patientId !== userId && videoConsultation.doctorId !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // End the video consultation
    const endedConsultation = await prisma.videoConsultation.update({
      where: { id: consultationId },
      data: {
        status: 'ENDED',
        endedAt: new Date()
      }
    });

    // Update the appointment status
    await prisma.appointment.update({
      where: { id: videoConsultation.appointmentId },
      data: { status: 'COMPLETED' }
    });

    res.json({
      success: true,
      data: { consultation: endedConsultation },
      message: 'Consultation ended successfully'
    });

  } catch (error) {
    logger.error('Failed to end consultation:', error);
    res.status(500).json({ error: 'Failed to end consultation' });
  }
});

// Get consultation history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { limit = 10 } = req.query;

    const consultations = await prisma.videoConsultation.findMany({
      where: {
        OR: [
          { patientId: userId },
          { doctorId: userId }
        ]
      },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, email: true } },
            doctor: { select: { id: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: { consultations },
      count: consultations.length
    });

  } catch (error) {
    logger.error('Failed to get consultation history:', error);
    res.status(500).json({ error: 'Failed to get consultation history' });
  }
});

// Get active consultation for user
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const activeConsultation = await prisma.videoConsultation.findFirst({
      where: {
        OR: [
          { patientId: userId },
          { doctorId: userId }
        ],
        status: 'ACTIVE'
      },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, email: true } },
            doctor: { select: { id: true, email: true } }
          }
        }
      }
    });

    if (!activeConsultation) {
      return res.json({
        success: true,
        data: { consultation: null },
        message: 'No active consultation found'
      });
    }

    res.json({
      success: true,
      data: { consultation: activeConsultation }
    });

  } catch (error) {
    logger.error('Failed to get active consultation:', error);
    res.status(500).json({ error: 'Failed to get active consultation' });
  }
});

// WebRTC Signaling endpoints (for peer-to-peer connection)
router.post('/signal', authenticateToken, async (req, res) => {
  try {
    const { roomId, signalType, signalData, targetUserId } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Verify user has access to this room
    const consultation = await prisma.videoConsultation.findUnique({
      where: { roomId }
    });

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation room not found' });
    }

    if (consultation.patientId !== userId && consultation.doctorId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // In a real implementation, you'd use WebSocket/Socket.io for signaling
    // For now, we'll just acknowledge the signal
    logger.info(`WebRTC signal received: ${signalType} in room ${roomId} from user ${userId}`);

    res.json({
      success: true,
      message: 'Signal processed successfully',
      data: {
        signalType,
        timestamp: new Date().toISOString(),
        roomId
      }
    });

  } catch (error) {
    logger.error('WebRTC signaling error:', error);
    res.status(500).json({ error: 'Signaling failed' });
  }
});

// Get ICE servers for WebRTC
router.get('/ice-servers', authenticateToken, async (req, res) => {
  try {
    // In production, you'd get these from a TURN/STUN server provider
    // For demo purposes, using public STUN servers
    const iceServers = [
      {
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
      }
    ];

    res.json({
      success: true,
      data: { iceServers }
    });

  } catch (error) {
    logger.error('Failed to get ICE servers:', error);
    res.status(500).json({ error: 'Failed to get ICE servers' });
  }
});

export default router;
