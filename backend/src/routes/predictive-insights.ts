import express, { Request, Response } from 'express';
import { PrismaClient, InsightType, Severity } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { OpenAIService } from '../services/OpenAIService';

const router = express.Router();
const prisma = new PrismaClient();
const openAIService = new OpenAIService();

// Get all health insights for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { limit = 20, type, severity } = req.query;

    const where: any = { patientId: userId };
    if (type) where.type = type as InsightType;
    if (severity) where.severity = severity as Severity;

    const insights = await prisma.healthInsight.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: { insights },
      count: insights.length
    });

  } catch (error) {
    logger.error('Failed to get health insights:', error);
    res.status(500).json({ error: 'Failed to get health insights' });
  }
});

// Get predictive metrics for user
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get user's medical history and appointments for analysis
    const [medicalRecords, appointments] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: { patientId: userId },
        orderBy: { date: 'desc' },
        take: 10
      }),
      prisma.appointment.findMany({
        where: { patientId: userId },
        orderBy: { scheduledAt: 'desc' },
        take: 20
      })
    ]);

    // Generate predictive metrics based on historical data
    const metrics = generatePredictiveMetrics(medicalRecords, appointments);

    res.json({
      success: true,
      data: { metrics }
    });

  } catch (error) {
    logger.error('Failed to get predictive metrics:', error);
    res.status(500).json({ error: 'Failed to get predictive metrics' });
  }
});

// Generate AI health insights
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get user's health data for analysis
    const userData = await getUserHealthData(userId);

    // Generate insights using AI
    const insights = await generateHealthInsights(userData, userId);

    // Save insights to database
    const savedInsights = [];
    for (const insight of insights) {
      const savedInsight = await prisma.healthInsight.create({
        data: {
          patientId: userId,
          type: insight.type as InsightType,
          title: insight.title,
          description: insight.description,
          severity: insight.severity as Severity,
          confidence: insight.confidence,
          actionRequired: insight.actionRequired
        }
      });
      savedInsights.push(savedInsight);
    }

    res.json({
      success: true,
      data: { insights: savedInsights },
      message: `${savedInsights.length} health insights generated`
    });

  } catch (error) {
    logger.error('Failed to generate health insights:', error);
    res.status(500).json({ error: 'Failed to generate health insights' });
  }
});

// Mark insight as read
router.put('/:insightId/read', authenticateToken, async (req, res) => {
  try {
    const { insightId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const insight = await prisma.healthInsight.findFirst({
      where: {
        id: insightId,
        patientId: userId
      }
    });

    if (!insight) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    const updatedInsight = await prisma.healthInsight.update({
      where: { id: insightId },
      data: { isRead: true }
    });

    res.json({
      success: true,
      data: { insight: updatedInsight },
      message: 'Insight marked as read'
    });

  } catch (error) {
    logger.error('Failed to mark insight as read:', error);
    res.status(500).json({ error: 'Failed to update insight' });
  }
});

// Get regional health trends (mock data for demo)
router.get('/regional-trends', authenticateToken, async (req, res) => {
  try {
    const { region = 'global' } = req.query;

    // In production, this would fetch real regional health data
    const trends = generateMockRegionalTrends(region as string);

    res.json({
      success: true,
      data: { trends, region }
    });

  } catch (error) {
    logger.error('Failed to get regional trends:', error);
    res.status(500).json({ error: 'Failed to get regional trends' });
  }
});

// Helper functions
async function getUserHealthData(userId: string) {
  const [medicalRecords, appointments, patientProfile] = await Promise.all([
    prisma.medicalRecord.findMany({
      where: { patientId: userId },
      orderBy: { date: 'desc' },
      take: 20
    }),
    prisma.appointment.findMany({
      where: { patientId: userId },
      orderBy: { scheduledAt: 'desc' },
      take: 20
    }),
    prisma.patientProfile.findUnique({
      where: { userId }
    })
  ]);

  return {
    medicalRecords,
    appointments,
    patientProfile,
    age: patientProfile ? calculateAge(patientProfile.dateOfBirth) : 30,
    gender: patientProfile?.gender || 'OTHER'
  };
}

async function generateHealthInsights(userData: any, userId: string) {
  const insights = [];

  // Analyze appointment patterns
  if (userData.appointments.length > 0) {
    const recentAppointments = userData.appointments.slice(0, 5);
    const avgRiskScore = recentAppointments.reduce((sum: number, apt: any) => sum + (apt.riskScore || 0), 0) / recentAppointments.length;

    if (avgRiskScore > 70) {
      insights.push({
        type: 'ALERT',
        title: 'Elevated Health Risk Detected',
        description: 'Your recent appointments show elevated risk scores. Consider scheduling a comprehensive health check-up.',
        severity: 'WARNING',
        confidence: 0.85,
        actionRequired: true
      });
    }
  }

  // Analyze medical history patterns
  if (userData.medicalRecords.length > 0) {
    const chronicConditions = userData.medicalRecords.filter((record: any) =>
      record.diagnosis.toLowerCase().includes('chronic') ||
      record.diagnosis.toLowerCase().includes('hypertension') ||
      record.diagnosis.toLowerCase().includes('diabetes')
    );

    if (chronicConditions.length > 2) {
      insights.push({
        type: 'RECOMMENDATION',
        title: 'Chronic Condition Management',
        description: 'Multiple chronic conditions detected. Consider regular monitoring and lifestyle modifications.',
        severity: 'INFO',
        confidence: 0.90,
        actionRequired: false
      });
    }
  }

  // Age-based preventive care
  if (userData.age > 50) {
    insights.push({
      type: 'RECOMMENDATION',
      title: 'Age-Appropriate Screenings',
      description: `At age ${userData.age}, consider regular screenings for age-related conditions.`,
      severity: 'INFO',
      confidence: 0.95,
      actionRequired: false
    });
  }

  // Generate AI-powered insights using OpenAI
  try {
    const aiInsights = await generateAIInsights(userData);
    insights.push(...aiInsights);
  } catch (error) {
    logger.error('AI insight generation failed:', error);
  }

  return insights;
}

async function generateAIInsights(userData: any) {
  const prompt = `Analyze this patient's health data and generate 2-3 predictive health insights:

Patient Age: ${userData.age}
Gender: ${userData.gender}
Recent Appointments: ${userData.appointments.length}
Medical Records: ${userData.medicalRecords.length}

Recent symptoms: ${userData.medicalRecords.slice(0, 3).map((r: any) => r.symptoms.join(', ')).join('; ')}

Generate JSON array of insights with: type, title, description, severity, confidence, actionRequired

Focus on preventive care and early detection.`;

  try {
    const response = await openAIService.generateResponse(
      'You are a predictive healthcare AI. Generate personalized health insights based on patient data.',
      prompt,
      'system-predictive-insights'
    );

    const parsed = JSON.parse(response);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function generatePredictiveMetrics(medicalRecords: any[], appointments: any[]) {
  const metrics = [];

  // Appointment frequency metric
  const lastMonthAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.scheduledAt);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return aptDate > lastMonth;
  });

  metrics.push({
    id: 'appointment-frequency',
    metric: 'Appointment Frequency',
    currentValue: lastMonthAppointments.length,
    predictedValue: Math.max(1, lastMonthAppointments.length * 0.8),
    trend: lastMonthAppointments.length > 2 ? 'stable' : 'decreasing',
    timeframe: 'next month',
    confidence: 0.75
  });

  // Risk score trend
  const recentRiskScores = appointments.slice(0, 5).map(apt => apt.riskScore || 0);
  const avgRiskScore = recentRiskScores.reduce((sum, score) => sum + score, 0) / recentRiskScores.length;

  metrics.push({
    id: 'risk-score-trend',
    metric: 'Health Risk Score',
    currentValue: Math.round(avgRiskScore),
    predictedValue: Math.round(avgRiskScore * 0.9),
    trend: avgRiskScore > 60 ? 'decreasing' : 'stable',
    timeframe: 'next 3 months',
    confidence: 0.70
  });

  // Symptom frequency
  const allSymptoms = medicalRecords.flatMap(record => record.symptoms || []);
  const symptomFrequency = allSymptoms.length / Math.max(1, medicalRecords.length);

  metrics.push({
    id: 'symptom-frequency',
    metric: 'Symptom Frequency',
    currentValue: symptomFrequency.toFixed(1),
    predictedValue: (symptomFrequency * 0.8).toFixed(1),
    trend: symptomFrequency > 2 ? 'decreasing' : 'stable',
    timeframe: 'next 2 months',
    confidence: 0.65
  });

  return metrics;
}

function generateMockRegionalTrends(region: string) {
  return {
    diseaseOutbreaks: [
      {
        condition: 'Seasonal Flu',
        riskLevel: 'medium',
        predictedCases: 15000,
        timeFrame: '2 weeks',
        affectedAreas: ['Urban districts', 'Schools'],
        preventionTips: ['Get vaccinated', 'Practice hand hygiene']
      },
      {
        condition: 'Respiratory Infections',
        riskLevel: 'low',
        predictedCases: 8000,
        timeFrame: '1 month',
        affectedAreas: ['Industrial areas'],
        preventionTips: ['Wear masks in polluted areas', 'Stay hydrated']
      }
    ],
    preventiveMeasures: [
      {
        title: 'Vaccination Campaign',
        description: 'Annual flu vaccination recommended for high-risk groups',
        priority: 'high'
      },
      {
        title: 'Air Quality Monitoring',
        description: 'Monitor air quality and limit outdoor activities during poor air quality',
        priority: 'medium'
      }
    ],
    healthTrends: [
      {
        metric: 'Mental Health Consultations',
        trend: 'increasing',
        percentageChange: 15,
        reason: 'Increased stress from work and lifestyle changes'
      },
      {
        metric: 'Preventive Screenings',
        trend: 'increasing',
        percentageChange: 8,
        reason: 'Better awareness and early detection programs'
      }
    ]
  };
}

// Export the function to ensure it's available
export function calculateHealthScore(userData: any): number {
  let score = 100; // Start with perfect score

  // Age factor (older age slightly reduces score)
  if (userData.age > 65) {
    score -= 10;
  } else if (userData.age > 50) {
    score -= 5;
  }

  // Medical records factor (more records = more health issues tracked)
  const medicalRecordsCount = userData.medicalRecords?.length || 0;
  if (medicalRecordsCount > 10) {
    score -= 15; // Many medical records indicate health issues
  } else if (medicalRecordsCount > 5) {
    score -= 8;
  }

  // Appointment frequency factor
  const appointmentCount = userData.appointments?.length || 0;
  if (appointmentCount > 15) {
    score -= 20; // Frequent appointments indicate health concerns
  } else if (appointmentCount > 8) {
    score -= 10;
  }

  // Risk score factor (from recent appointments)
  const recentAppointments = userData.appointments?.slice(0, 5) || [];
  const avgRiskScore = recentAppointments.length > 0
    ? recentAppointments.reduce((sum: number, apt: any) => sum + (apt.riskScore || 0), 0) / recentAppointments.length
    : 0;

  if (avgRiskScore > 70) {
    score -= 25;
  } else if (avgRiskScore > 50) {
    score -= 15;
  } else if (avgRiskScore > 30) {
    score -= 8;
  }

  // Chronic conditions factor
  const chronicConditions = userData.medicalRecords?.filter((record: any) =>
    record.diagnosis?.toLowerCase().includes('chronic') ||
    record.diagnosis?.toLowerCase().includes('hypertension') ||
    record.diagnosis?.toLowerCase().includes('diabetes') ||
    record.diagnosis?.toLowerCase().includes('heart disease')
  ) || [];

  if (chronicConditions.length > 2) {
    score -= 20;
  } else if (chronicConditions.length > 0) {
    score -= 10;
  }

  // Gender-specific adjustments (simplified)
  if (userData.gender === 'FEMALE' && userData.age > 40) {
    // Consider women's health screenings
    score -= 2; // Slight adjustment for regular screenings needed
  }

  // Ensure score stays within 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Calculate age from date of birth
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

export { router };

// Get predictive metrics (additional endpoint for frontend compatibility)
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get user data for metrics calculation
    const userData = await getUserHealthData(userId);

    const metrics = {
      totalConsultations: userData.appointments?.length || 0,
      averageRiskScore: userData.appointments?.length > 0
        ? userData.appointments.reduce((sum: number, apt: any) => sum + (apt.riskScore || 0), 0) / userData.appointments.length
        : 0,
      healthScore: calculateHealthScore(userData),
      trend: 'stable', // Could be calculated based on historical data
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: { metrics }
    });

  } catch (error) {
    logger.error('Predictive metrics error:', error);
    res.status(500).json({ error: 'Failed to get predictive metrics' });
  }
});
