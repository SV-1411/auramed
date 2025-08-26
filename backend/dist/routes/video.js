"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const twilio_1 = __importDefault(require("twilio"));
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Initialize Twilio client
const twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// Generate video consultation room
router.post('/create-room', auth_1.authenticateToken, async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const userId = req.user?.id;
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
            return res.status(404).json({ error: 'Appointment not found' });
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
        const AccessToken = twilio_1.default.jwt.AccessToken;
        const VideoGrant = AccessToken.VideoGrant;
        const patientToken = new AccessToken(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, { identity: `patient_${appointment.patientId}` });
        const doctorToken = new AccessToken(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, { identity: `doctor_${appointment.doctorId}` });
        const videoGrant = new VideoGrant({ room: room.uniqueName });
        patientToken.addGrant(videoGrant);
        doctorToken.addGrant(videoGrant);
        // Update appointment with video consultation details
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                videoConsultation: {
                    create: {
                        roomId: room.sid,
                        roomName: room.uniqueName,
                        status: 'created',
                        patientToken: patientToken.toJwt(),
                        doctorToken: doctorToken.toJwt(),
                        createdAt: new Date()
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
    }
    catch (error) {
        logger_1.logger.error('Failed to create video room:', error);
        res.status(500).json({ error: 'Failed to create video consultation room' });
    }
});
// Join video consultation
router.get('/join/:appointmentId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const userId = req.user?.id;
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
            return res.status(404).json({ error: 'Video consultation not found' });
        }
        // Update consultation status
        await prisma.videoConsultation.update({
            where: { id: videoConsultation.id },
            data: {
                status: 'in_progress',
                startedAt: new Date()
            }
        });
        const isPatient = userId === videoConsultation.appointment.patientId;
        const token = isPatient ? videoConsultation.patientToken : videoConsultation.doctorToken;
        res.json({
            success: true,
            data: {
                roomName: videoConsultation.roomName,
                token,
                isPatient,
                appointment: videoConsultation.appointment
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to join video consultation:', error);
        res.status(500).json({ error: 'Failed to join video consultation' });
    }
});
// End video consultation
router.post('/end/:appointmentId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { duration, summary } = req.body;
        const videoConsultation = await prisma.videoConsultation.findFirst({
            where: {
                appointment: { id: appointmentId }
            }
        });
        if (!videoConsultation) {
            return res.status(404).json({ error: 'Video consultation not found' });
        }
        // End Twilio room
        await twilioClient.video.v1.rooms(videoConsultation.roomId).update({
            status: 'completed'
        });
        // Update consultation record
        await prisma.videoConsultation.update({
            where: { id: videoConsultation.id },
            data: {
                status: 'completed',
                endedAt: new Date(),
                duration: duration || null,
                summary: summary || null
            }
        });
        // Update appointment status
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'completed' }
        });
        res.json({
            success: true,
            message: 'Video consultation ended successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to end video consultation:', error);
        res.status(500).json({ error: 'Failed to end video consultation' });
    }
});
// Get consultation recordings
router.get('/recordings/:appointmentId', auth_1.authenticateToken, async (req, res) => {
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
            success: true,
            data: {
                recordings: recordings.map(recording => ({
                    sid: recording.sid,
                    status: recording.status,
                    dateCreated: recording.dateCreated,
                    duration: recording.duration,
                    size: recording.size,
                    url: recording.url
                }))
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get recordings:', error);
        res.status(500).json({ error: 'Failed to get consultation recordings' });
    }
});
// Webhook for video events
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const event = req.body;
        logger_1.logger.info('Video webhook received:', event);
        // Handle different video events
        switch (event.StatusCallbackEvent) {
            case 'room-created':
                logger_1.logger.info(`Room created: ${event.RoomName}`);
                break;
            case 'participant-connected':
                logger_1.logger.info(`Participant connected to room: ${event.RoomName}`);
                break;
            case 'participant-disconnected':
                logger_1.logger.info(`Participant disconnected from room: ${event.RoomName}`);
                break;
            case 'room-ended':
                logger_1.logger.info(`Room ended: ${event.RoomName}`);
                break;
        }
        res.status(200).send('OK');
    }
    catch (error) {
        logger_1.logger.error('Video webhook error:', error);
        res.status(500).send('Error');
    }
});
exports.default = router;
//# sourceMappingURL=video.js.map