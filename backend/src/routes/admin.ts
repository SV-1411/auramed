import express, { Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { getDatabase } from '../config/database';

const router = express.Router();

// Get admin dashboard stats
router.get('/dashboard-stats', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();
    const [
      totalUsers,
      totalDoctors,
      totalPatients,
      totalAppointments,
      pendingVerifications,
      systemAlerts
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: 'DOCTOR' } }),
      db.user.count({ where: { role: 'PATIENT' } }),
      db.appointment.count(),
      db.user.count({ 
        where: { 
          role: 'DOCTOR',
          doctorProfile: {
            isVerified: false
          }
        }
      }),
      db.systemAlert.count({ where: { isResolved: false } })
    ]);

    res.json({
      status: 'success',
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
    next(error);
  }
});

// Get all users with pagination
router.get('/users', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { role, status, limit = '20', offset = '0', search } = req.query;
    const db = getDatabase();

    const whereClause: any = {};
    if (role) {
      const roleKey = String(role).toUpperCase();
      const validRoles = ['ADMIN', 'DOCTOR', 'PATIENT', 'LAB', 'PHARMACY', 'AMBULANCE'];
      if (validRoles.includes(roleKey)) {
        whereClause.role = roleKey;
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

    const users = await db.user.findMany({
      where: whereClause,
      include: {
        doctorProfile: true,
        patientProfile: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await db.user.count({ where: whereClause });

    res.json({
      status: 'success',
      data: {
        users,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    next(error);
  }
});

// Verify doctor
router.put('/verify-doctor/:doctorId', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { doctorId } = req.params;
    const { isVerified, verificationNotes } = req.body;
    const db = getDatabase();

    const doctor = await db.user.findFirst({
      where: {
        id: doctorId,
        role: 'DOCTOR'
      },
      include: {
        doctorProfile: true
      }
    });

    if (!doctor) {
      throw createError('Doctor not found', 404);
    }

    const updatedDoctor = await db.user.update({
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
      status: 'success',
      data: updatedDoctor
    });

  } catch (error) {
    next(error);
  }
});

// Get system alerts
router.get('/system-alerts', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { severity, isResolved, limit = '20', offset = '0' } = req.query;
    const db = getDatabase();

    const whereClause: any = {};
    if (severity) whereClause.severity = severity;
    if (isResolved !== undefined) whereClause.isResolved = isResolved === 'true';

    const alerts = await db.systemAlert.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await db.systemAlert.count({ where: whereClause });

    res.json({
      status: 'success',
      data: {
        alerts,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    next(error);
  }
});

// Resolve system alert
router.put('/system-alerts/:alertId/resolve', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { alertId } = req.params;
    const { resolutionNotes } = req.body;
    const db = getDatabase();

    const alert = await db.systemAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
          }
    });

    res.json({
      status: 'success',
      data: alert
    });

  } catch (error) {
    next(error);
  }
});

// Get fraud detection reports
router.get('/fraud-reports', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { severity, isResolved, limit = '20', offset = '0' } = req.query;
    const db = getDatabase();

    const whereClause: any = { type: 'FRAUD_DETECTION' };
    if (severity) whereClause.severity = severity;
    if (isResolved !== undefined) whereClause.isResolved = isResolved === 'true';

    const fraudReports = await db.systemAlert.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await db.systemAlert.count({ where: whereClause });
    res.json({
      status: 'success',
      data: {
        fraudReports,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    next(error);
  }
});

// Update fraud report status
router.put('/fraud-reports/:reportId', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;
    const db = getDatabase();

    const isResolved = String(status).toLowerCase() === 'resolved';

    const fraudReport = await db.systemAlert.update({
      where: { id: reportId },
      data: {
        isResolved,
        resolvedAt: isResolved ? new Date() : null
      }
    });

    res.json({
      status: 'success',
      data: fraudReport
    });

  } catch (error) {
    next(error);
  }
});

// Get platform analytics
router.get('/analytics', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { period = '30d' } = req.query;
    const db = getDatabase();
    
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
      db.user.count({
        where: { createdAt: { gte: startDate } }
      }),
      db.appointment.count({
        where: { createdAt: { gte: startDate } }
      }),
      db.appointment.count({
        where: { 
          status: 'COMPLETED',
          updatedAt: { gte: startDate }
        }
      })
    ]);

    res.json({
      status: 'success',
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
    next(error);
  }
});

// Suspend/unsuspend user
router.put('/users/:userId/suspend', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const db = getDatabase();

    const user = await db.user.update({
      where: { id: userId },
      data: {
        isActive
      }
    });

    res.json({
      status: 'success',
      data: user
    });

  } catch (error) {
    next(error);
  }
});

export default router;
