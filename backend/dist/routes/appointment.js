"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Create appointment
router.post('/', auth_1.authenticateToken, [
    (0, express_validator_1.body)('doctorId').isString().notEmpty(),
    (0, express_validator_1.body)('scheduledAt').isISO8601(),
    (0, express_validator_1.body)('symptoms').isArray().notEmpty(),
    (0, express_validator_1.body)('type').isIn(['VIDEO', 'CHAT', 'EMERGENCY'])
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const patientId = req.user.userId;
        const { doctorId, scheduledAt, symptoms, type, duration = 30 } = req.body;
        const db = (0, database_1.getDatabase)();
        const redis = (0, redis_1.getRedis)();
        // Verify doctor exists and is available
        const doctor = await db.user.findFirst({
            where: { id: doctorId, role: 'DOCTOR' },
            include: { doctorProfile: true }
        });
        if (!doctor) {
            throw (0, errorHandler_1.createError)('Doctor not found', 404);
        }
        // Check doctor availability (simplified)
        const appointmentTime = new Date(scheduledAt);
        const existingAppointment = await db.appointment.findFirst({
            where: {
                doctorId,
                scheduledAt: appointmentTime,
                status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
            }
        });
        if (existingAppointment) {
            throw (0, errorHandler_1.createError)('Doctor not available at this time', 409);
        }
        // Calculate risk score (simplified)
        const riskScore = symptoms.length > 3 ? 75 : 25;
        const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW';
        // Create appointment
        const appointment = await db.appointment.create({
            data: {
                patientId,
                doctorId,
                scheduledAt: appointmentTime,
                duration,
                type,
                symptoms,
                riskLevel,
                riskScore,
                paymentAmount: doctor.doctorProfile?.consultationFee || 500
            },
            include: {
                patient: {
                    include: { patientProfile: true }
                },
                doctor: {
                    include: { doctorProfile: true }
                }
            }
        });
        // Add to emergency queue if urgent
        if (type === 'EMERGENCY' || riskLevel === 'HIGH') {
            await redis.addToEmergencyQueue(patientId, riskLevel);
        }
        logger_1.logger.info(`Appointment created: ${appointment.id}`);
        res.status(201).json({
            status: 'success',
            data: { appointment }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get appointments for user
router.get('/', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { status, limit = 20, offset = 0 } = req.query;
        const db = (0, database_1.getDatabase)();
        const whereClause = userRole === 'PATIENT'
            ? { patientId: userId }
            : { doctorId: userId };
        if (status) {
            whereClause.status = status;
        }
        const appointments = await db.appointment.findMany({
            where: whereClause,
            include: {
                patient: { include: { patientProfile: true } },
                doctor: { include: { doctorProfile: true } },
                videoConsultation: true
            },
            orderBy: { scheduledAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        res.json({
            status: 'success',
            data: { appointments }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get appointment by ID
router.get('/:id', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const userId = req.user.userId;
        const db = (0, database_1.getDatabase)();
        const appointment = await db.appointment.findFirst({
            where: {
                id: appointmentId,
                OR: [
                    { patientId: userId },
                    { doctorId: userId }
                ]
            },
            include: {
                patient: { include: { patientProfile: true } },
                doctor: { include: { doctorProfile: true } },
                videoConsultation: true,
                payments: true
            }
        });
        if (!appointment) {
            throw (0, errorHandler_1.createError)('Appointment not found', 404);
        }
        res.json({
            status: 'success',
            data: { appointment }
        });
    }
    catch (error) {
        next(error);
    }
});
// Update appointment status
router.patch('/:id/status', auth_1.authenticateToken, [
    (0, express_validator_1.body)('status').isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const appointmentId = req.params.id;
        const userId = req.user.userId;
        const { status } = req.body;
        const db = (0, database_1.getDatabase)();
        // Verify appointment belongs to user
        const appointment = await db.appointment.findFirst({
            where: {
                id: appointmentId,
                OR: [
                    { patientId: userId },
                    { doctorId: userId }
                ]
            }
        });
        if (!appointment) {
            throw (0, errorHandler_1.createError)('Appointment not found', 404);
        }
        // Update appointment
        const updatedAppointment = await db.appointment.update({
            where: { id: appointmentId },
            data: { status },
            include: {
                patient: { include: { patientProfile: true } },
                doctor: { include: { doctorProfile: true } }
            }
        });
        logger_1.logger.info(`Appointment ${appointmentId} status updated to ${status}`);
        res.json({
            status: 'success',
            data: { appointment: updatedAppointment }
        });
    }
    catch (error) {
        next(error);
    }
});
// Add consultation notes (Doctor only)
router.patch('/:id/notes', auth_1.authenticateToken, (0, auth_1.requireRole)(['DOCTOR']), [
    (0, express_validator_1.body)('consultationNotes').isString().notEmpty()
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const appointmentId = req.params.id;
        const doctorId = req.user.userId;
        const { consultationNotes } = req.body;
        const db = (0, database_1.getDatabase)();
        // Verify appointment belongs to doctor
        const appointment = await db.appointment.findFirst({
            where: {
                id: appointmentId,
                doctorId
            }
        });
        if (!appointment) {
            throw (0, errorHandler_1.createError)('Appointment not found', 404);
        }
        // Update consultation notes
        const updatedAppointment = await db.appointment.update({
            where: { id: appointmentId },
            data: { consultationNotes }
        });
        logger_1.logger.info(`Consultation notes added to appointment ${appointmentId}`);
        res.json({
            status: 'success',
            data: { appointment: updatedAppointment }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get available doctors
router.get('/doctors/available', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const { specialization, date, time } = req.query;
        const db = (0, database_1.getDatabase)();
        let whereClause = {
            role: 'DOCTOR',
            isActive: true,
            doctorProfile: {
                isVerified: true
            }
        };
        if (specialization) {
            whereClause.doctorProfile.specialization = {
                has: specialization
            };
        }
        const doctors = await db.user.findMany({
            where: whereClause,
            include: {
                doctorProfile: {
                    include: {
                        availabilitySlots: true,
                        qualityMetrics: true
                    }
                }
            },
            orderBy: {
                doctorProfile: {
                    qualityScore: 'desc'
                }
            }
        });
        // Filter by availability if date/time provided
        let availableDoctors = doctors;
        if (date && time) {
            const requestedDate = new Date(date);
            const dayOfWeek = requestedDate.getDay();
            availableDoctors = doctors.filter(doctor => {
                return doctor.doctorProfile?.availabilitySlots.some(slot => slot.dayOfWeek === dayOfWeek &&
                    slot.isAvailable &&
                    slot.startTime <= time &&
                    slot.endTime >= time);
            });
        }
        res.json({
            status: 'success',
            data: {
                doctors: availableDoctors.map(doctor => ({
                    id: doctor.id,
                    profile: doctor.doctorProfile,
                    qualityScore: doctor.doctorProfile?.qualityScore || 0
                }))
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get emergency queue (Admin/Doctor only)
router.get('/emergency/queue', auth_1.authenticateToken, (0, auth_1.requireRole)(['ADMIN', 'DOCTOR']), async (req, res, next) => {
    try {
        const redis = (0, redis_1.getRedis)();
        const queueSize = await redis.getEmergencyQueueSize();
        res.json({
            status: 'success',
            data: {
                queueSize,
                message: `${queueSize} patients in emergency queue`
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=appointment.js.map