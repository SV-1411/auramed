import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { healthInsightsService } from '../services/HealthInsightsService';
import { logger } from '../utils/logger';

const router = express.Router();

// Get health insights for current authenticated user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 5 } = req.query;

    const insights = await healthInsightsService.generateHealthInsights(userId!);

    res.json({
      success: true,
      data: { insights: insights.slice(0, parseInt(limit as string)) }
    });
  } catch (error) {
    logger.error('Failed to get health insights:', error);
    res.status(500).json({ error: 'Failed to get health insights' });
  }
});

// Get health insights for a patient
router.get('/:patientId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.id;

    // Ensure user can only access their own insights or is a doctor/admin
    if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const insights = await healthInsightsService.generateHealthInsights(patientId);

    res.json({
      success: true,
      data: { insights }
    });

  } catch (error) {
    logger.error('Failed to get health insights:', error);
    res.status(500).json({ error: 'Failed to get health insights' });
  }
});

// Get predictive analysis for a patient
router.get('/:patientId/predictive-analysis', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.id;

    // Ensure user can only access their own analysis or is a doctor/admin
    if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analysis = await healthInsightsService.generatePredictiveAnalysis(patientId);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Failed to get predictive analysis:', error);
    res.status(500).json({ error: 'Failed to get predictive analysis' });
  }
});

// Refresh health insights for a patient
router.post('/:patientId/refresh', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.id;

    // Ensure user can only refresh their own insights or is a doctor/admin
    if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const insights = await healthInsightsService.generateHealthInsights(patientId);

    res.json({
      success: true,
      message: 'Health insights refreshed successfully',
      data: { insights }
    });

  } catch (error) {
    logger.error('Failed to refresh health insights:', error);
    res.status(500).json({ error: 'Failed to refresh health insights' });
  }
});

export default router;
