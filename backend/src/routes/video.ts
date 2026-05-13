import express, { Request, Response } from 'express';
import { PrismaClient, VideoConsultationStatus, AppointmentStatus } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { NextFunction } from 'express';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Twilio client (optional for prototype)
let twilioClient: any = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && 
      process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    logger.info('Twilio client initialized successfully');
  } else {
    logger.warn('Twilio credentials not configured or invalid - video features disabled');
  }
} catch (error) {
  logger.warn('Failed to initialize Twilio client:', error);
}

// Generate video consultation room
router.post('/create-room', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.body;
    const userId = (req as any).user?.userId;

    // Verify appointment exists and user has access
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        OR: [
          { patientId: userId },
          { doctorId: userId }
        ]
      },
      include: {
        patient: { include: { patientProfile: true } },
        doctor: { include: { doctorProfile: true } }
      }
    });

    if (!appointment) {
      throw createError('Appointment not found', 404);
    }

    // Check if Twilio is available
    if (!twilioClient) {
      throw createError('Video consultation service not available - Twilio not configured', 503);
    }

    // Create Twilio video room
    const room = await twilioClient.video.v1.rooms.create({
      uniqueName: `consultation_${appointmentId}`,
      type: 'group',
      maxParticipants: 2,
      recordParticipantsOnConnect: true,
      statusCallback: `${process.env.BACKEND_URL}/api/video/webhook`
    });

    // Generate access tokens for patient and doctor
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    const patientToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: `patient_${appointment.patientId}` }
    );

    const doctorToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: `doctor_${appointment.doctorId}` }
    );

    const videoGrant = new VideoGrant({ room: room.uniqueName });
    patientToken.addGrant(videoGrant);
    doctorToken.addGrant(videoGrant);

    // Update appointment with video consultation details (schema-aligned)
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        videoConsultation: {
          create: {
            roomId: room.sid,
            accessToken: '',
            status: VideoConsultationStatus.WAITING,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId
          }
        }
      }
    });

    const userToken = userId === appointment.patientId ? patientToken.toJwt() : doctorToken.toJwt();

    res.json({
      success: true,
      data: {
        roomName: room.uniqueName,
        token: userToken,
        appointment: {
          id: appointment.id,
          scheduledAt: appointment.scheduledAt,
          patient: {
            name: `${appointment.patient.patientProfile?.firstName} ${appointment.patient.patientProfile?.lastName}`,
            age: appointment.patient.patientProfile?.dateOfBirth ? 
              new Date().getFullYear() - new Date(appointment.patient.patientProfile.dateOfBirth).getFullYear() : null
          },
          doctor: {
            name: `Dr. ${appointment.doctor.doctorProfile?.firstName} ${appointment.doctor.doctorProfile?.lastName}`,
            specialization: appointment.doctor.doctorProfile?.specialization
          }
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// Join video consultation
router.get('/join/:appointmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.params;
    const userId = (req as any).user?.userId;

    const videoConsultation = await prisma.videoConsultation.findFirst({
      where: {
        appointment: {
          id: appointmentId,
          OR: [
            { patientId: userId },
            { doctorId: userId }
          ]
        }
      },
      include: {
        appointment: {
          include: {
            patient: { include: { patientProfile: true } },
            doctor: { include: { doctorProfile: true } }
          }
        }
      }
    });

    if (!videoConsultation) {
      throw createError('Video consultation not found', 404);
    }

    // Update consultation status
    await prisma.videoConsultation.update({
      where: { id: videoConsultation.id },
      data: { 
        status: VideoConsultationStatus.ACTIVE,
        startedAt: new Date()
      }
    });

    const isPatient = userId === videoConsultation.appointment.patientId;
    // Generate a fresh access token on join (do not rely on stored tokens)
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;
    const grant = new VideoGrant({ room: `consultation_${appointmentId}` });
    const joinToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: isPatient ? `patient_${videoConsultation.appointment.patientId}` : `doctor_${videoConsultation.appointment.doctorId}` }
    );
    joinToken.addGrant(grant);
    const token = joinToken.toJwt();

    res.json({
      status: 'success',
      data: {
        roomName: `consultation_${appointmentId}`,
        token,
        isPatient,
        appointment: videoConsultation.appointment
      }
    });

  } catch (error) {
    next(error);
  }
});

// End video consultation
router.post('/end/:appointmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.params;
    const { duration, summary } = req.body;

    const videoConsultation = await prisma.videoConsultation.findFirst({
      where: {
        appointment: { id: appointmentId }
      }
    });

    if (!videoConsultation) {
      throw createError('Video consultation not found', 404);
    }

    // End Twilio room
    await twilioClient.video.v1.rooms(videoConsultation.roomId).update({
      status: 'completed'
    });

    // Update consultation record
    await prisma.videoConsultation.update({
      where: { id: videoConsultation.id },
      data: {
        status: VideoConsultationStatus.ENDED,
        endedAt: new Date()
      }
    });

    // Update appointment status
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED }
    });

    res.json({
      status: 'success',
      message: 'Video consultation ended successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Get consultation recordings
router.get('/recordings/:appointmentId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.params;

    const videoConsultation = await prisma.videoConsultation.findFirst({
      where: {
        appointment: { id: appointmentId }
      }
    });

    if (!videoConsultation) {
      return res.status(404).json({ error: 'Video consultation not found' });
    }

    // Get recordings from Twilio
    const recordings = await twilioClient.video.v1.rooms(videoConsultation.roomId)
      .recordings.list();

    res.json({
      status: 'success',
      data: {
        recordings: recordings.map((recording: any) => ({
          sid: recording.sid,
          status: recording.status,
          dateCreated: recording.dateCreated,
          duration: recording.duration,
          size: recording.size,
          url: recording.url
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});

// Webhook for video events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.body;
    logger.info('Video webhook received:', event);

    // Handle different video events
    switch (event.StatusCallbackEvent) {
      case 'room-created':
        logger.info(`Room created: ${event.RoomName}`);
        break;
      case 'participant-connected':
        logger.info(`Participant connected to room: ${event.RoomName}`);
        break;
      case 'participant-disconnected':
        logger.info(`Participant disconnected from room: ${event.RoomName}`);
        break;
      case 'room-ended':
        logger.info(`Room ended: ${event.RoomName}`);
        break;
    }

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Video webhook error:', error);
    res.status(500).send('Error');
  }
});

export default router;
