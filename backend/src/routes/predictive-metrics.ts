import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { calculateHealthScore } from './predictive-insights';

const router = express.Router();
const prisma = new PrismaClient();

// Compatibility route for frontend calling `/api/predictive-metrics`
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId; // support both shapes
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get user data for metrics calculation (mirror of predictive-insights /metrics)
    const [medicalRecords, appointments, patientProfile] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: { patientId: userId },
        orderBy: { date: 'desc' },
        take: 10
      }),
      prisma.appointment.findMany({
        where: { patientId: userId },
        orderBy: { scheduledAt: 'desc' },
        take: 20
      }),
      prisma.patientProfile.findUnique({ where: { userId } })
    ]);

    const userData = {
      medicalRecords,
      appointments,
      patientProfile,
      age: patientProfile ? (() => {
        const dob = patientProfile.dateOfBirth;
        const today = new Date();
        const birth = new Date(dob);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
      })() : 30,
      gender: patientProfile?.gender || 'OTHER'
    };

    // Build an array of metrics to match frontend expectations
    const totalConsultations = userData.appointments?.length || 0;
    const averageRiskScore = totalConsultations > 0
      ? userData.appointments.reduce((sum: number, apt: any) => sum + (apt.riskScore || 0), 0) / totalConsultations
      : 0;
    const healthScore = calculateHealthScore(userData);

    const metrics = [
      {
        id: 'total-consultations',
        metric: 'Total Consultations',
        currentValue: totalConsultations,
        predictedValue: Math.max(0, Math.round(totalConsultations * 0.9)),
        trend: totalConsultations > 5 ? 'stable' : 'increasing',
        timeframe: 'next month',
        confidence: 75
      },
      {
        id: 'average-risk-score',
        metric: 'Average Risk Score',
        currentValue: Math.round(averageRiskScore),
        predictedValue: Math.round(averageRiskScore * 0.95),
        trend: averageRiskScore > 60 ? 'decreasing' : 'stable',
        timeframe: 'next 3 months',
        confidence: 70
      },
      {
        id: 'health-score',
        metric: 'Health Score',
        currentValue: healthScore,
        predictedValue: Math.min(100, Math.round(healthScore * 1.02)),
        trend: healthScore < 60 ? 'increasing' : 'stable',
        timeframe: 'next 3 months',
        confidence: 80
      }
    ];

    res.json({ success: true, data: { metrics } });
  } catch (error) {
    logger.error('Predictive metrics (compat) error:', error as Error);
    res.status(500).json({ error: 'Failed to get predictive metrics' });
  }
});

export default router;
