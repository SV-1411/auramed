"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Get doctor profile
router.get('/profile', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const doctor = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                doctorProfile: true,
                qualityMetrics: true
            }
        });
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }
        res.json({
            success: true,
            data: doctor
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get doctor profile:', error);
        res.status(500).json({ error: 'Failed to get doctor profile' });
    }
});
// Update doctor profile
router.put('/profile', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const { firstName, lastName, specialization, licenseNumber, experience, bio, consultationFee, availableHours } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                firstName,
                lastName,
                doctorProfile: {
                    upsert: {
                        create: {
                            specialization: specialization || [],
                            licenseNumber,
                            experience: experience ? parseInt(experience) : null,
                            bio,
                            consultationFee: consultationFee ? parseFloat(consultationFee) : null,
                            availableHours: availableHours || {},
                            isVerified: false
                        },
                        update: {
                            specialization: specialization || [],
                            licenseNumber,
                            experience: experience ? parseInt(experience) : undefined,
                            bio,
                            consultationFee: consultationFee ? parseFloat(consultationFee) : undefined,
                            availableHours: availableHours || {}
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
    }
    catch (error) {
        logger_1.logger.error('Failed to update doctor profile:', error);
        res.status(500).json({ error: 'Failed to update doctor profile' });
    }
});
// Get doctor appointments
router.get('/appointments', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const { status, date, limit = 10, offset = 0 } = req.query;
        const whereClause = { doctorId: userId };
        if (status) {
            whereClause.status = status;
        }
        if (date) {
            const startDate = new Date(date);
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
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        const total = await prisma.appointment.count({
            where: whereClause
        });
        res.json({
            success: true,
            data: {
                appointments,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get doctor appointments:', error);
        res.status(500).json({ error: 'Failed to get doctor appointments' });
    }
});
// Get availability slots
router.get('/availability', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const { date } = req.query;
        let whereClause = { doctorId: userId };
        if (date) {
            const startDate = new Date(date);
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get availability slots:', error);
        res.status(500).json({ error: 'Failed to get availability slots' });
    }
});
// Create availability slot
router.post('/availability', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const { startTime, endTime, isAvailable } = req.body;
        const availabilitySlot = await prisma.availabilitySlot.create({
            data: {
                doctorId: userId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                isAvailable: isAvailable !== false
            }
        });
        res.json({
            success: true,
            data: availabilitySlot
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create availability slot:', error);
        res.status(500).json({ error: 'Failed to create availability slot' });
    }
});
// Update availability slot
router.put('/availability/:slotId', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const { slotId } = req.params;
        const { startTime, endTime, isAvailable } = req.body;
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
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                isAvailable
            }
        });
        res.json({
            success: true,
            data: updatedSlot
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update availability slot:', error);
        res.status(500).json({ error: 'Failed to update availability slot' });
    }
});
// Get quality metrics
router.get('/quality-metrics', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get quality metrics:', error);
        res.status(500).json({ error: 'Failed to get quality metrics' });
    }
});
// Create prescription
router.post('/prescription', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const { patientId, appointmentId, medications, instructions, diagnosis } = req.body;
        // Verify appointment belongs to doctor
        const appointment = await prisma.appointment.findFirst({
            where: {
                id: appointmentId,
                doctorId: userId
            }
        });
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        const prescription = await prisma.prescription.create({
            data: {
                patientId,
                doctorId: userId,
                appointmentId,
                medications: medications || [],
                instructions,
                diagnosis,
                issuedAt: new Date()
            }
        });
        res.json({
            success: true,
            data: prescription
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create prescription:', error);
        res.status(500).json({ error: 'Failed to create prescription' });
    }
});
// Create medical record
router.post('/medical-record', auth_1.authenticateToken, (0, auth_1.requireRole)('doctor'), async (req, res) => {
    try {
        const userId = req.user?.id;
        const { patientId, appointmentId, diagnosis, symptoms, treatment, notes, followUpRequired } = req.body;
        const medicalRecord = await prisma.medicalRecord.create({
            data: {
                patientId,
                doctorId: userId,
                appointmentId,
                diagnosis,
                symptoms: symptoms || [],
                treatment,
                notes,
                followUpRequired: followUpRequired || false
            }
        });
        res.json({
            success: true,
            data: medicalRecord
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create medical record:', error);
        res.status(500).json({ error: 'Failed to create medical record' });
    }
});
exports.default = router;
//# sourceMappingURL=doctor.js.map