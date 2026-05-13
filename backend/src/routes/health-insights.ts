import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { healthInsightsService } from '../services/HealthInsightsService';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { NextFunction } from 'express';

const router = express.Router();

// Get health insights for current authenticated user
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { limit = 5 } = req.query;

    const insights = await healthInsightsService.generateHealthInsights(userId!);

    res.json({
      status: 'success',
      data: { insights: insights.slice(0, parseInt(limit as string)) }
    });
  } catch (error) {
    next(error);
  }
});

// Get health insights for a patient
router.get('/:patientId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.id;

    if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
      throw createError('Access denied', 403);
    }

    const insights = await healthInsightsService.generateHealthInsights(patientId);

    res.json({
      status: 'success',
      data: { insights }
    });

  } catch (error) {
    next(error);
  }
});

// Get predictive analysis for a patient
router.get('/:patientId/predictive-analysis', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.id;

    if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
      throw createError('Access denied', 403);
    }

    const analysis = await healthInsightsService.generatePredictiveAnalysis(patientId);

    res.json({
      status: 'success',
      data: analysis
    });

  } catch (error) {
    next(error);
  }
});

// Refresh health insights for a patient
router.post('/:patientId/refresh', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.id;

    if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
      throw createError('Access denied', 403);
    }

    const insights = await healthInsightsService.generateHealthInsights(patientId);

    res.json({
      status: 'success',
      message: 'Health insights refreshed successfully',
      data: { insights }
    });

  } catch (error) {
    next(error);
  }
});

export default router;
