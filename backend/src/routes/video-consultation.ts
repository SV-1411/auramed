import express, { Request, Response } from 'express';
import { PrismaClient, VideoConsultationStatus } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { NextFunction } from 'express';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

// Get available doctors for video consultation
router.get('/doctors/available', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
      status: 'success',
      data: { doctors: availableDoctors },
      count: availableDoctors.length
    });

  } catch (error) {
    next(error);
  }
});

// Create instant video consultation
router.post('/instant', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { doctorId, type = 'VIDEO', symptoms = [], notes } = req.body;
    const patientId = (req as any).user?.userId;
    if (!patientId) {
      throw createError('Unauthorized', 401);
    }
    if (!doctorId) {
      throw createError('Doctor ID is required', 400);
    }

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

    res.json({
      status: 'success',
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
    next(error);
  }
});

// Join video consultation room
router.post('/join', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomName } = req.body;
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      throw createError('Unauthorized', 401);
    }

    // Find the video consultation
    const videoConsultation = await prisma.videoConsultation.findUnique({
      where: { roomId: roomName },
      include: { appointment: true }
    });

    if (!videoConsultation) {
      throw createError('Consultation room not found', 404);
    }

    // Verify user has access to this room
    if (videoConsultation.patientId !== currentUserId && videoConsultation.doctorId !== currentUserId) {
      throw createError('Access denied to this consultation', 403);
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
      status: 'success',
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
    next(error);
  }
});

// End video consultation
router.put('/:consultationId/end', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consultationId } = req.params;
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw createError('Unauthorized', 401);
    }

    const videoConsultation = await prisma.videoConsultation.findUnique({
      where: { id: consultationId },
      include: { appointment: true }
    });

    if (!videoConsultation) {
      throw createError('Consultation not found', 404);
    }

    // Verify user has permission to end this consultation
    if (videoConsultation.patientId !== userId && videoConsultation.doctorId !== userId) {
      throw createError('Permission denied', 403);
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
      status: 'success',
      data: { consultation: endedConsultation },
      message: 'Consultation ended successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Get consultation history
router.get('/history', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw createError('Unauthorized', 401);
    }

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
      status: 'success',
      data: { consultations },
      count: consultations.length
    });

  } catch (error) {
    next(error);
  }
});

// Get active consultation for user
router.get('/active', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw createError('Unauthorized', 401);
    }

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
        status: 'success',
        data: { consultation: null },
        message: 'No active consultation found'
      });
    }

    res.json({
      status: 'success',
      data: { consultation: activeConsultation }
    });

  } catch (error) {
    next(error);
  }
});

// WebRTC Signaling endpoints (for peer-to-peer connection)
router.post('/signal', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId, signalType, signalData, targetUserId } = req.body;
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw createError('Unauthorized', 401);
    }

    // Verify user has access to this room
    const consultation = await prisma.videoConsultation.findUnique({
      where: { roomId }
    });

    if (!consultation) {
      throw createError('Consultation room not found', 404);
    }

    if (consultation.patientId !== userId && consultation.doctorId !== userId) {
      throw createError('Access denied', 403);
    }

    // In a real implementation, you'd use WebSocket/Socket.io for signaling
    // For now, we'll just acknowledge the signal
    logger.info(`WebRTC signal received: ${signalType} in room ${roomId} from user ${userId}`);

    res.json({
      status: 'success',
      message: 'Signal processed successfully',
      data: {
        signalType,
        timestamp: new Date().toISOString(),
        roomId
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get ICE servers for WebRTC
router.get('/ice-servers', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In production, you'd get these from a TURN/STUN server provider
    // For demo purposes, using public STUN servers
    const iceServers = [
      {
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
      }
    ];

    res.json({
      status: 'success',
      data: { iceServers }
    });

  } catch (error) {
    next(error);
  }
});

export default router;
