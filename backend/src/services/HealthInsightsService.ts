import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface HealthMetric {
  type: 'blood_pressure' | 'heart_rate' | 'weight' | 'blood_sugar' | 'temperature' | 'bmi';
  value: number;
  unit: string;
  recordedAt: Date;
  isNormal: boolean;
  trend?: 'improving' | 'stable' | 'declining';
}

export interface HealthInsight {
  id: string;
  patientId: string;
  type: 'risk_alert' | 'improvement' | 'recommendation' | 'trend_analysis' | 'preventive_care';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: boolean;
  recommendations: string[];
  relatedMetrics: string[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface PredictiveAnalysis {
  riskFactors: {
    diabetes: number;
    hypertension: number;
    cardiovascular: number;
    obesity: number;
  };
  recommendations: string[];
  nextCheckupSuggestion: Date;
  preventiveMeasures: string[];
}

export class HealthInsightsService {
  /**
   * Generate health insights for a patient based on their medical history
   */
  async generateHealthInsights(patientId: string): Promise<HealthInsight[]> {
    try {
      const patient = await prisma.user.findUnique({
        where: { id: patientId },
        include: {
          patientProfile: true,
          medicalRecords: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          appointments: {
            where: { status: 'completed' },
            orderBy: { scheduledAt: 'desc' },
            take: 5
          }
        }
      });

      if (!patient) {
        throw new Error('Patient not found');
      }

      const insights: HealthInsight[] = [];

      // Analyze appointment frequency
      const appointmentInsights = await this.analyzeAppointmentPatterns(patient);
      insights.push(...appointmentInsights);

      // Analyze medical history for risk factors
      const riskInsights = await this.analyzeRiskFactors(patient);
      insights.push(...riskInsights);

      // Generate preventive care recommendations
      const preventiveInsights = await this.generatePreventiveCareInsights(patient);
      insights.push(...preventiveInsights);

      // Store insights in database
      for (const insight of insights) {
        await prisma.healthInsight.upsert({
          where: { id: insight.id },
          create: {
            id: insight.id,
            patientId: insight.patientId,
            type: insight.type,
            title: insight.title,
            description: insight.description,
            severity: insight.severity,
            actionRequired: insight.actionRequired,
            recommendations: insight.recommendations,
            relatedMetrics: insight.relatedMetrics,
            expiresAt: insight.expiresAt
          },
          update: {
            description: insight.description,
            severity: insight.severity,
            actionRequired: insight.actionRequired,
            recommendations: insight.recommendations
          }
        });
      }

      logger.info(`Generated ${insights.length} health insights for patient ${patientId}`);
      return insights;

    } catch (error) {
      logger.error('Failed to generate health insights:', error);
      throw error;
    }
  }

  /**
   * Analyze appointment patterns and frequency
   */
  private async analyzeAppointmentPatterns(patient: any): Promise<HealthInsight[]> {
    const insights: HealthInsight[] = [];
    const appointments = patient.appointments;

    if (appointments.length === 0) {
      insights.push({
        id: `${patient.id}-no-appointments`,
        patientId: patient.id,
        type: 'recommendation',
        title: 'Schedule Regular Check-up',
        description: 'You haven\'t had any recent appointments. Regular health check-ups are important for preventive care.',
        severity: 'medium',
        actionRequired: true,
        recommendations: [
          'Schedule an annual health check-up',
          'Consider basic health screening tests',
          'Discuss your health goals with a doctor'
        ],
        relatedMetrics: [],
        createdAt: new Date()
      });
      return insights;
    }

    // Check for overdue appointments
    const lastAppointment = appointments[0];
    const daysSinceLastAppointment = Math.floor(
      (new Date().getTime() - new Date(lastAppointment.scheduledAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastAppointment > 365) {
      insights.push({
        id: `${patient.id}-overdue-checkup`,
        patientId: patient.id,
        type: 'recommendation',
        title: 'Annual Check-up Overdue',
        description: `It's been ${Math.floor(daysSinceLastAppointment / 30)} months since your last appointment. Consider scheduling a check-up.`,
        severity: 'medium',
        actionRequired: true,
        recommendations: [
          'Schedule an appointment with your primary care doctor',
          'Update your medical history and current medications',
          'Discuss any new symptoms or concerns'
        ],
        relatedMetrics: [],
        createdAt: new Date()
      });
    }

    return insights;
  }

  /**
   * Analyze medical records for risk factors
   */
  private async analyzeRiskFactors(patient: any): Promise<HealthInsight[]> {
    const insights: HealthInsight[] = [];
    const medicalRecords = patient.medicalRecords;
    const allergies = patient.patientProfile?.allergies || [];

    // Analyze chronic conditions
    const chronicConditions = this.extractChronicConditions(medicalRecords);
    
    if (chronicConditions.includes('diabetes') || chronicConditions.includes('pre-diabetes')) {
      insights.push({
        id: `${patient.id}-diabetes-management`,
        patientId: patient.id,
        type: 'risk_alert',
        title: 'Diabetes Management',
        description: 'Your medical history indicates diabetes. Regular monitoring and lifestyle management are crucial.',
        severity: 'high',
        actionRequired: true,
        recommendations: [
          'Monitor blood sugar levels regularly',
          'Maintain a balanced diet with controlled carbohydrates',
          'Exercise regularly as recommended by your doctor',
          'Take medications as prescribed',
          'Schedule regular eye and foot examinations'
        ],
        relatedMetrics: ['blood_sugar', 'weight', 'bmi'],
        createdAt: new Date()
      });
    }

    if (chronicConditions.includes('hypertension') || chronicConditions.includes('high blood pressure')) {
      insights.push({
        id: `${patient.id}-hypertension-management`,
        patientId: patient.id,
        type: 'risk_alert',
        title: 'Blood Pressure Management',
        description: 'Your medical history indicates hypertension. Regular monitoring and lifestyle changes are important.',
        severity: 'high',
        actionRequired: true,
        recommendations: [
          'Monitor blood pressure regularly',
          'Reduce sodium intake',
          'Exercise regularly',
          'Manage stress levels',
          'Take prescribed medications consistently'
        ],
        relatedMetrics: ['blood_pressure', 'heart_rate'],
        createdAt: new Date()
      });
    }

    // Allergy alerts
    if (allergies.length > 0) {
      insights.push({
        id: `${patient.id}-allergy-alert`,
        patientId: patient.id,
        type: 'risk_alert',
        title: 'Allergy Information',
        description: `You have ${allergies.length} known allergies. Always inform healthcare providers about your allergies.`,
        severity: 'medium',
        actionRequired: false,
        recommendations: [
          'Carry an updated list of your allergies',
          'Inform all healthcare providers about your allergies',
          'Consider wearing a medical alert bracelet',
          'Keep emergency medications (like EpiPen) if prescribed'
        ],
        relatedMetrics: [],
        createdAt: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate preventive care insights
   */
  private async generatePreventiveCareInsights(patient: any): Promise<HealthInsight[]> {
    const insights: HealthInsight[] = [];
    const age = this.calculateAge(patient.patientProfile?.dateOfBirth);
    const gender = patient.patientProfile?.gender;

    // Age-based screening recommendations
    if (age >= 40) {
      insights.push({
        id: `${patient.id}-annual-screening`,
        patientId: patient.id,
        type: 'preventive_care',
        title: 'Annual Health Screening',
        description: 'At your age, annual health screenings are recommended to detect potential health issues early.',
        severity: 'low',
        actionRequired: false,
        recommendations: [
          'Annual blood pressure check',
          'Cholesterol screening every 5 years',
          'Diabetes screening every 3 years',
          'Annual eye exam',
          'Dental check-up every 6 months'
        ],
        relatedMetrics: ['blood_pressure', 'blood_sugar'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      });
    }

    if (age >= 50) {
      insights.push({
        id: `${patient.id}-cancer-screening`,
        patientId: patient.id,
        type: 'preventive_care',
        title: 'Cancer Screening Recommendations',
        description: 'Regular cancer screenings are important for early detection and prevention.',
        severity: 'medium',
        actionRequired: false,
        recommendations: [
          'Colonoscopy every 10 years (or as recommended)',
          gender === 'female' ? 'Annual mammogram' : 'Prostate screening discussion with doctor',
          'Skin cancer screening annually',
          'Discuss family history with your doctor'
        ],
        relatedMetrics: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });
    }

    // Vaccination reminders
    insights.push({
      id: `${patient.id}-vaccination-reminder`,
      patientId: patient.id,
      type: 'preventive_care',
      title: 'Vaccination Status',
      description: 'Keep your vaccinations up to date for optimal health protection.',
      severity: 'low',
      actionRequired: false,
      recommendations: [
        'Annual flu vaccination',
        'COVID-19 vaccination as recommended',
        age >= 65 ? 'Pneumonia vaccination' : 'Discuss vaccination schedule with doctor',
        'Tetanus booster every 10 years'
      ],
      relatedMetrics: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });

    return insights;
  }

  /**
   * Generate predictive health analysis
   */
  async generatePredictiveAnalysis(patientId: string): Promise<PredictiveAnalysis> {
    try {
      const patient = await prisma.user.findUnique({
        where: { id: patientId },
        include: {
          patientProfile: true,
          medicalRecords: true,
          familyMembers: true
        }
      });

      if (!patient) {
        throw new Error('Patient not found');
      }

      const age = this.calculateAge(patient.patientProfile?.dateOfBirth);
      const medicalHistory = patient.patientProfile?.medicalHistory || [];
      const allergies = patient.patientProfile?.allergies || [];

      // Calculate risk factors (simplified algorithm)
      const riskFactors = {
        diabetes: this.calculateDiabetesRisk(age, medicalHistory),
        hypertension: this.calculateHypertensionRisk(age, medicalHistory),
        cardiovascular: this.calculateCardiovascularRisk(age, medicalHistory),
        obesity: this.calculateObesityRisk(medicalHistory)
      };

      const recommendations = this.generateRiskBasedRecommendations(riskFactors);
      const nextCheckupSuggestion = this.calculateNextCheckupDate(age, riskFactors);
      const preventiveMeasures = this.generatePreventiveMeasures(age, riskFactors);

      return {
        riskFactors,
        recommendations,
        nextCheckupSuggestion,
        preventiveMeasures
      };

    } catch (error) {
      logger.error('Failed to generate predictive analysis:', error);
      throw error;
    }
  }

  /**
   * Extract chronic conditions from medical records
   */
  private extractChronicConditions(medicalRecords: any[]): string[] {
    const conditions: string[] = [];
    const chronicKeywords = [
      'diabetes', 'hypertension', 'high blood pressure', 'heart disease',
      'asthma', 'copd', 'arthritis', 'depression', 'anxiety'
    ];

    medicalRecords.forEach(record => {
      const diagnosis = record.diagnosis?.toLowerCase() || '';
      chronicKeywords.forEach(keyword => {
        if (diagnosis.includes(keyword) && !conditions.includes(keyword)) {
          conditions.push(keyword);
        }
      });
    });

    return conditions;
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth?: Date): number {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Calculate diabetes risk (0-1 scale)
   */
  private calculateDiabetesRisk(age: number, medicalHistory: string[]): number {
    let risk = 0;
    if (age > 45) risk += 0.3;
    if (age > 65) risk += 0.2;
    if (medicalHistory.some(h => h.toLowerCase().includes('pre-diabetes'))) risk += 0.4;
    if (medicalHistory.some(h => h.toLowerCase().includes('obesity'))) risk += 0.3;
    return Math.min(risk, 1);
  }

  /**
   * Calculate hypertension risk (0-1 scale)
   */
  private calculateHypertensionRisk(age: number, medicalHistory: string[]): number {
    let risk = 0;
    if (age > 40) risk += 0.2;
    if (age > 60) risk += 0.3;
    if (medicalHistory.some(h => h.toLowerCase().includes('high blood pressure'))) risk += 0.5;
    return Math.min(risk, 1);
  }

  /**
   * Calculate cardiovascular risk (0-1 scale)
   */
  private calculateCardiovascularRisk(age: number, medicalHistory: string[]): number {
    let risk = 0;
    if (age > 50) risk += 0.2;
    if (age > 65) risk += 0.3;
    if (medicalHistory.some(h => h.toLowerCase().includes('heart'))) risk += 0.4;
    if (medicalHistory.some(h => h.toLowerCase().includes('cholesterol'))) risk += 0.2;
    return Math.min(risk, 1);
  }

  /**
   * Calculate obesity risk (0-1 scale)
   */
  private calculateObesityRisk(medicalHistory: string[]): number {
    let risk = 0;
    if (medicalHistory.some(h => h.toLowerCase().includes('obesity'))) risk += 0.6;
    if (medicalHistory.some(h => h.toLowerCase().includes('overweight'))) risk += 0.3;
    return Math.min(risk, 1);
  }

  /**
   * Generate recommendations based on risk factors
   */
  private generateRiskBasedRecommendations(riskFactors: any): string[] {
    const recommendations: string[] = [];

    if (riskFactors.diabetes > 0.3) {
      recommendations.push('Monitor blood sugar levels regularly');
      recommendations.push('Maintain a balanced diet with controlled carbohydrates');
    }

    if (riskFactors.hypertension > 0.3) {
      recommendations.push('Monitor blood pressure regularly');
      recommendations.push('Reduce sodium intake and exercise regularly');
    }

    if (riskFactors.cardiovascular > 0.3) {
      recommendations.push('Consider cardiovascular screening');
      recommendations.push('Maintain heart-healthy diet and regular exercise');
    }

    if (riskFactors.obesity > 0.3) {
      recommendations.push('Focus on weight management through diet and exercise');
      recommendations.push('Consider consulting with a nutritionist');
    }

    return recommendations;
  }

  /**
   * Calculate next checkup date based on risk factors
   */
  private calculateNextCheckupDate(age: number, riskFactors: any): Date {
    const now = new Date();
    let monthsUntilNext = 12; // Default annual checkup

    // More frequent checkups for higher risk patients
    const highRisk = Object.values(riskFactors).some((risk: any) => risk > 0.5);
    if (highRisk || age > 65) {
      monthsUntilNext = 6; // Every 6 months
    }

    return new Date(now.getFullYear(), now.getMonth() + monthsUntilNext, now.getDate());
  }

  /**
   * Generate preventive measures based on age and risk
   */
  private generatePreventiveMeasures(age: number, riskFactors: any): string[] {
    const measures: string[] = [
      'Maintain regular exercise routine',
      'Follow a balanced, nutritious diet',
      'Get adequate sleep (7-9 hours per night)',
      'Manage stress through relaxation techniques',
      'Avoid smoking and limit alcohol consumption'
    ];

    if (age > 50) {
      measures.push('Schedule regular cancer screenings');
      measures.push('Consider bone density testing');
    }

    if (Object.values(riskFactors).some((risk: any) => risk > 0.3)) {
      measures.push('Monitor relevant health metrics regularly');
      measures.push('Take prescribed medications consistently');
    }

    return measures;
  }
}

export const healthInsightsService = new HealthInsightsService();
