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
// Get admin dashboard stats
router.get('/dashboard-stats', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const [totalUsers, totalDoctors, totalPatients, totalAppointments, pendingVerifications, systemAlerts] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: 'doctor' } }),
            prisma.user.count({ where: { role: 'patient' } }),
            prisma.appointment.count(),
            prisma.user.count({
                where: {
                    role: 'doctor',
                    doctorProfile: {
                        isVerified: false
                    }
                }
            }),
            prisma.systemAlert.count({ where: { isResolved: false } })
        ]);
        res.json({
            success: true,
            data: {
                totalUsers,
                totalDoctors,
                totalPatients,
                totalAppointments,
                pendingVerifications,
                systemAlerts
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get admin dashboard stats:', error);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});
// Get all users with pagination
router.get('/users', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { role, status, limit = 20, offset = 0, search } = req.query;
        const whereClause = {};
        if (role)
            whereClause.role = role;
        if (status)
            whereClause.isActive = status === 'active';
        if (search) {
            whereClause.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }
        const users = await prisma.user.findMany({
            where: whereClause,
            include: {
                doctorProfile: true,
                patientProfile: true
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        const total = await prisma.user.count({ where: whereClause });
        res.json({
            success: true,
            data: {
                users,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});
// Verify doctor
router.put('/verify-doctor/:doctorId', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { isVerified, verificationNotes } = req.body;
        const doctor = await prisma.user.findFirst({
            where: {
                id: doctorId,
                role: 'doctor'
            },
            include: {
                doctorProfile: true
            }
        });
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }
        const updatedDoctor = await prisma.user.update({
            where: { id: doctorId },
            data: {
                doctorProfile: {
                    update: {
                        isVerified,
                        verificationNotes,
                        verifiedAt: isVerified ? new Date() : null,
                        verifiedBy: isVerified ? req.user?.id : null
                    }
                }
            },
            include: {
                doctorProfile: true
            }
        });
        res.json({
            success: true,
            data: updatedDoctor
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to verify doctor:', error);
        res.status(500).json({ error: 'Failed to verify doctor' });
    }
});
// Get system alerts
router.get('/system-alerts', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { severity, isResolved, limit = 20, offset = 0 } = req.query;
        const whereClause = {};
        if (severity)
            whereClause.severity = severity;
        if (isResolved !== undefined)
            whereClause.isResolved = isResolved === 'true';
        const alerts = await prisma.systemAlert.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        const total = await prisma.systemAlert.count({ where: whereClause });
        res.json({
            success: true,
            data: {
                alerts,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get system alerts:', error);
        res.status(500).json({ error: 'Failed to get system alerts' });
    }
});
// Resolve system alert
router.put('/system-alerts/:alertId/resolve', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { alertId } = req.params;
        const { resolutionNotes } = req.body;
        const alert = await prisma.systemAlert.update({
            where: { id: alertId },
            data: {
                isResolved: true,
                resolvedAt: new Date(),
                resolvedBy: req.user?.id,
                resolutionNotes
            }
        });
        res.json({
            success: true,
            data: alert
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to resolve system alert:', error);
        res.status(500).json({ error: 'Failed to resolve system alert' });
    }
});
// Get fraud detection reports
router.get('/fraud-reports', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { status, riskLevel, limit = 20, offset = 0 } = req.query;
        const whereClause = {};
        if (status)
            whereClause.status = status;
        if (riskLevel)
            whereClause.riskLevel = riskLevel;
        const fraudReports = await prisma.fraudDetectionReport.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        const total = await prisma.fraudDetectionReport.count({ where: whereClause });
        res.json({
            success: true,
            data: {
                fraudReports,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get fraud reports:', error);
        res.status(500).json({ error: 'Failed to get fraud reports' });
    }
});
// Update fraud report status
router.put('/fraud-reports/:reportId', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, adminNotes } = req.body;
        const fraudReport = await prisma.fraudDetectionReport.update({
            where: { id: reportId },
            data: {
                status,
                adminNotes,
                reviewedAt: new Date(),
                reviewedBy: req.user?.id
            }
        });
        res.json({
            success: true,
            data: fraudReport
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update fraud report:', error);
        res.status(500).json({ error: 'Failed to update fraud report' });
    }
});
// Get platform analytics
router.get('/analytics', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }
        const [newUsers, newAppointments, completedAppointments, revenue, averageRating] = await Promise.all([
            prisma.user.count({
                where: { createdAt: { gte: startDate } }
            }),
            prisma.appointment.count({
                where: { createdAt: { gte: startDate } }
            }),
            prisma.appointment.count({
                where: {
                    status: 'completed',
                    updatedAt: { gte: startDate }
                }
            }),
            prisma.payment.aggregate({
                where: {
                    status: 'completed',
                    createdAt: { gte: startDate }
                },
                _sum: { amount: true }
            }),
            prisma.appointmentRating.aggregate({
                where: { createdAt: { gte: startDate } },
                _avg: { rating: true }
            })
        ]);
        res.json({
            success: true,
            data: {
                period,
                newUsers,
                newAppointments,
                completedAppointments,
                revenue: revenue._sum.amount || 0,
                averageRating: averageRating._avg.rating || 0
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});
// Suspend/unsuspend user
router.put('/users/:userId/suspend', auth_1.authenticateToken, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive, suspensionReason } = req.body;
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                isActive,
                suspensionReason: !isActive ? suspensionReason : null,
                suspendedAt: !isActive ? new Date() : null,
                suspendedBy: !isActive ? req.user?.id : null
            }
        });
        res.json({
            success: true,
            data: user
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to suspend/unsuspend user:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map