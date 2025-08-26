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
// Get patient profile
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const patient = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                patientProfile: true,
                familyMembers: true
            }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json({
            success: true,
            data: patient
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get patient profile:', error);
        res.status(500).json({ error: 'Failed to get patient profile' });
    }
});
// Update patient profile
router.put('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { firstName, lastName, dateOfBirth, gender, phoneNumber, address, emergencyContact, medicalHistory, allergies } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                firstName,
                lastName,
                patientProfile: {
                    upsert: {
                        create: {
                            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                            gender,
                            phoneNumber,
                            address,
                            emergencyContact,
                            medicalHistory: medicalHistory || [],
                            allergies: allergies || []
                        },
                        update: {
                            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                            gender,
                            phoneNumber,
                            address,
                            emergencyContact,
                            medicalHistory: medicalHistory || [],
                            allergies: allergies || []
                        }
                    }
                }
            },
            include: {
                patientProfile: true
            }
        });
        res.json({
            success: true,
            data: updatedUser
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update patient profile:', error);
        res.status(500).json({ error: 'Failed to update patient profile' });
    }
});
// Get patient appointments
router.get('/appointments', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { status, limit = 10, offset = 0 } = req.query;
        const whereClause = { patientId: userId };
        if (status) {
            whereClause.status = status;
        }
        const appointments = await prisma.appointment.findMany({
            where: whereClause,
            include: {
                doctor: {
                    include: {
                        doctorProfile: true
                    }
                }
            },
            orderBy: { scheduledAt: 'desc' },
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
        logger_1.logger.error('Failed to get patient appointments:', error);
        res.status(500).json({ error: 'Failed to get patient appointments' });
    }
});
// Get medical records
router.get('/medical-records', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const medicalRecords = await prisma.medicalRecord.findMany({
            where: { patientId: userId },
            include: {
                doctor: {
                    include: {
                        doctorProfile: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: medicalRecords
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get medical records:', error);
        res.status(500).json({ error: 'Failed to get medical records' });
    }
});
// Get prescriptions
router.get('/prescriptions', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const prescriptions = await prisma.prescription.findMany({
            where: { patientId: userId },
            include: {
                doctor: {
                    include: {
                        doctorProfile: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: prescriptions
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get prescriptions:', error);
        res.status(500).json({ error: 'Failed to get prescriptions' });
    }
});
// Get health insights
router.get('/health-insights', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { limit = 5 } = req.query;
        const insights = await prisma.healthInsight.findMany({
            where: { patientId: userId },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });
        res.json({
            success: true,
            data: { insights }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get health insights:', error);
        res.status(500).json({ error: 'Failed to get health insights' });
    }
});
exports.default = router;
//# sourceMappingURL=patient.js.map