import express, { Request, Response } from 'express';
import { PrismaClient, UserRole, AlertType, AppointmentStatus } from '@prisma/client';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Get admin dashboard stats
router.get('/dashboard-stats', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalDoctors,
      totalPatients,
      totalAppointments,
      pendingVerifications,
      systemAlerts
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.DOCTOR } }),
      prisma.user.count({ where: { role: UserRole.PATIENT } }),
      prisma.appointment.count(),
      prisma.user.count({ 
        where: { 
          role: UserRole.DOCTOR,
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

  } catch (error) {
    logger.error('Failed to get admin dashboard stats:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// Get all users with pagination
router.get('/users', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, status, limit = 20, offset = 0, search } = req.query;

    const whereClause: any = {};
    if (role) {
      const roleKey = String(role).toUpperCase() as keyof typeof UserRole;
      if (UserRole[roleKey]) {
        whereClause.role = UserRole[roleKey];
      }
    }
    if (status) whereClause.isActive = status === 'active';
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        doctorProfile: true,
        patientProfile: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.user.count({ where: whereClause });

    res.json({
      success: true,
      data: {
        users,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    logger.error('Failed to get users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Verify doctor
router.put('/verify-doctor/:doctorId', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId } = req.params;
    const { isVerified, verificationNotes } = req.body;

    const doctor = await prisma.user.findFirst({
      where: {
        id: doctorId,
        role: UserRole.DOCTOR
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
            isVerified
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

  } catch (error) {
    logger.error('Failed to verify doctor:', error);
    res.status(500).json({ error: 'Failed to verify doctor' });
  }
});

// Get system alerts
router.get('/system-alerts', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { severity, isResolved, limit = 20, offset = 0 } = req.query;

    const whereClause: any = {};
    if (severity) whereClause.severity = severity;
    if (isResolved !== undefined) whereClause.isResolved = isResolved === 'true';

    const alerts = await prisma.systemAlert.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.systemAlert.count({ where: whereClause });

    res.json({
      success: true,
      data: {
        alerts,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    logger.error('Failed to get system alerts:', error);
    res.status(500).json({ error: 'Failed to get system alerts' });
  }
});

// Resolve system alert
router.put('/system-alerts/:alertId/resolve', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolutionNotes } = req.body;

    const alert = await prisma.systemAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
          }
    });

    res.json({
      success: true,
      data: alert
    });

  } catch (error) {
    logger.error('Failed to resolve system alert:', error);
    res.status(500).json({ error: 'Failed to resolve system alert' });
  }
});

// Get fraud detection reports
router.get('/fraud-reports', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { severity, isResolved, limit = 20, offset = 0 } = req.query;

    const whereClause: any = { type: AlertType.FRAUD_DETECTION };
    if (severity) whereClause.severity = severity;
    if (isResolved !== undefined) whereClause.isResolved = isResolved === 'true';

    const fraudReports = await prisma.systemAlert.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.systemAlert.count({ where: whereClause });
    res.json({
      success: true,
      data: {
        fraudReports,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    logger.error('Failed to get fraud reports:', error);
    res.status(500).json({ error: 'Failed to get fraud reports' });
  }
});

// Update fraud report status
router.put('/fraud-reports/:reportId', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    const isResolved = String(status).toLowerCase() === 'resolved';

    const fraudReport = await prisma.systemAlert.update({
      where: { id: reportId },
      data: {
        isResolved,
        resolvedAt: isResolved ? new Date() : null
      }
    });

    res.json({
      success: true,
      data: fraudReport
    });

  } catch (error) {
    logger.error('Failed to update fraud report:', error);
    res.status(500).json({ error: 'Failed to update fraud report' });
  }
});

// Get platform analytics
router.get('/analytics', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
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

    const [
      newUsers,
      newAppointments,
      completedAppointments
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: startDate } }
      }),
      prisma.appointment.count({
        where: { createdAt: { gte: startDate } }
      }),
      prisma.appointment.count({
        where: { 
          status: AppointmentStatus.COMPLETED,
          updatedAt: { gte: startDate }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        period,
        newUsers,
        newAppointments,
        completedAppointments,
        revenue: 0,
        averageRating: 0
      }
    });

  } catch (error) {
    logger.error('Failed to get analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Suspend/unsuspend user
router.put('/users/:userId/suspend', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive
      }
    });

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    logger.error('Failed to suspend/unsuspend user:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

export default router;
