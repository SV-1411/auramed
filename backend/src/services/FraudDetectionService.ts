import { PrismaClient, UserRole, AlertType, Severity } from '@prisma/client';
import { logger } from '../utils/logger';

export interface SuspiciousPayment {
  id: string;
  userId: string;
  amount: number;
  frequency: number;
  riskScore: number;
  reason: string;
}

export interface FakeAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  riskScore: number;
  suspiciousPatterns: string[];
}

export interface CredentialFraud {
  doctorId: string;
  licenseNumber: string;
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class FraudDetectionService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async detectSuspiciousPayments(): Promise<SuspiciousPayment[]> {
    try {
      const suspiciousPayments: SuspiciousPayment[] = [];
      
      // Get recent payments for analysis
      const recentPayments = await this.prisma.paymentTransaction.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        include: {
          patient: true
        }
      });

      // Group payments by user
      const paymentsByUser = recentPayments.reduce((acc, payment) => {
        if (!acc[payment.patientId]) {
          acc[payment.patientId] = [];
        }
        acc[payment.patientId].push(payment);
        return acc;
      }, {} as { [userId: string]: any[] });

      // Analyze each user's payment patterns
      for (const [userId, payments] of Object.entries(paymentsByUser)) {
        const analysis = this.analyzePaymentPattern(payments);
        
        if (analysis.riskScore > 70) {
          suspiciousPayments.push({
            id: `fraud_${Date.now()}_${userId}`,
            userId,
            amount: analysis.totalAmount,
            frequency: payments.length,
            riskScore: analysis.riskScore,
            reason: analysis.reason
          });
        }
      }

      logger.info(`Detected ${suspiciousPayments.length} suspicious payment patterns`);
      return suspiciousPayments;
    } catch (error) {
      logger.error('Error detecting suspicious payments:', error);
      return [];
    }
  }

  async detectFakeAppointments(): Promise<FakeAppointment[]> {
    try {
      const fakeAppointments: FakeAppointment[] = [];
      
      // Get recent appointments
      const recentAppointments = await this.prisma.appointment.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        include: {
          patient: true,
          doctor: true
        }
      });

      // Analyze appointment patterns
      for (const appointment of recentAppointments) {
        const suspiciousPatterns = this.analyzeFakeAppointmentPatterns(appointment);
        
        if (suspiciousPatterns.length > 0) {
          const riskScore = this.calculateAppointmentRiskScore(suspiciousPatterns);
          
          if (riskScore > 60) {
            fakeAppointments.push({
              id: appointment.id,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              riskScore,
              suspiciousPatterns
            });
          }
        }
      }

      logger.info(`Detected ${fakeAppointments.length} potentially fake appointments`);
      return fakeAppointments;
    } catch (error) {
      logger.error('Error detecting fake appointments:', error);
      return [];
    }
  }

  async detectCredentialFraud(): Promise<CredentialFraud[]> {
    try {
      const credentialIssues: CredentialFraud[] = [];
      
      // Get all doctors for credential verification
      const doctors = await this.prisma.user.findMany({
        where: { role: UserRole.DOCTOR },
        include: { doctorProfile: true }
      });

      for (const doctor of doctors) {
        const profile = (doctor as any).doctorProfile as any;
        if (!profile) continue;

        const issues = this.validateDoctorCredentials(doctor.id, profile);
        credentialIssues.push(...issues);
      }

      logger.info(`Detected ${credentialIssues.length} credential fraud issues`);
      return credentialIssues;
    } catch (error) {
      logger.error('Error detecting credential fraud:', error);
      return [];
    }
  }

  private analyzePaymentPattern(payments: any[]): { riskScore: number; totalAmount: number; reason: string } {
    let riskScore = 0;
    let reason = '';
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const avgAmount = totalAmount / payments.length;

    // Check for unusual frequency
    if (payments.length > 20) {
      riskScore += 30;
      reason += 'High payment frequency; ';
    }

    // Check for round number amounts (potential fake)
    const roundAmounts = payments.filter(p => p.amount % 100 === 0).length;
    if (roundAmounts / payments.length > 0.8) {
      riskScore += 25;
      reason += 'Suspicious round amounts; ';
    }

    // Check for identical amounts
    const uniqueAmounts = new Set(payments.map(p => p.amount)).size;
    if (uniqueAmounts === 1 && payments.length > 5) {
      riskScore += 40;
      reason += 'Identical payment amounts; ';
    }

    // Check for unusually high amounts
    if (avgAmount > 5000) {
      riskScore += 20;
      reason += 'High average payment amount; ';
    }

    // Check payment timing patterns
    const timeDiffs = payments.slice(1).map((p, i) => 
      new Date(p.createdAt).getTime() - new Date(payments[i].createdAt).getTime()
    );
    const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    
    // Payments made at very regular intervals (potential automation)
    if (timeDiffs.every(diff => Math.abs(diff - avgTimeDiff) < 3600000)) { // Within 1 hour
      riskScore += 35;
      reason += 'Regular payment intervals; ';
    }

    return {
      riskScore: Math.min(riskScore, 100),
      totalAmount,
      reason: reason.trim()
    };
  }

  private analyzeFakeAppointmentPatterns(appointment: any): string[] {
    const patterns: string[] = [];

    // Check if appointment was created and scheduled for same day
    const createdDate = new Date(appointment.createdAt);
    const scheduledDate = new Date(appointment.scheduledAt);
    const timeDiff = scheduledDate.getTime() - createdDate.getTime();
    
    if (timeDiff < 3600000) { // Less than 1 hour
      patterns.push('Same-day booking');
    }

    // Check for suspicious symptoms patterns
    if (appointment.symptoms && appointment.symptoms.length === 1) {
      patterns.push('Single vague symptom');
    }

    // Check for new patient with immediate booking
    const patientAge = Date.now() - new Date(appointment.patient.createdAt).getTime();
    if (patientAge < 24 * 60 * 60 * 1000) { // Account less than 24 hours old
      patterns.push('New patient account');
    }

    // Check for appointment outside normal hours
    const hour = scheduledDate.getHours();
    if (hour < 8 || hour > 20) {
      patterns.push('Outside normal hours');
    }

    return patterns;
  }

  private calculateAppointmentRiskScore(patterns: string[]): number {
    const riskWeights = {
      'Same-day booking': 25,
      'Single vague symptom': 20,
      'New patient account': 30,
      'Outside normal hours': 15
    };

    return patterns.reduce((score, pattern) => {
      return score + (riskWeights[pattern as keyof typeof riskWeights] || 10);
    }, 0);
  }

  private validateDoctorCredentials(doctorId: string, profile: any): CredentialFraud[] {
    const issues: CredentialFraud[] = [];

    // Check license number format
    if (!profile.licenseNumber || !/^[A-Z]{2}\d{6,8}$/.test(profile.licenseNumber)) {
      issues.push({
        doctorId,
        licenseNumber: profile.licenseNumber || 'MISSING',
        issueType: 'Invalid license number format',
        severity: 'high'
      });
    }

    // Check for blacklisted license numbers
    const blacklistedLicenses = ['XX000000', 'INVALID1', 'TEST1234'];
    if (blacklistedLicenses.includes(profile.licenseNumber)) {
      issues.push({
        doctorId,
        licenseNumber: profile.licenseNumber,
        issueType: 'Blacklisted license number',
        severity: 'critical'
      });
    }

    // Check for missing qualifications
    if (!profile.qualifications || profile.qualifications.length === 0) {
      issues.push({
        doctorId,
        licenseNumber: profile.licenseNumber || 'MISSING',
        issueType: 'Missing qualifications',
        severity: 'medium'
      });
    }

    // Check for suspicious qualification patterns
    if (profile.qualifications && profile.qualifications.some((q: string) => 
      q.toLowerCase().includes('fake') || q.toLowerCase().includes('test'))) {
      issues.push({
        doctorId,
        licenseNumber: profile.licenseNumber || 'MISSING',
        issueType: 'Suspicious qualification entries',
        severity: 'high'
      });
    }

    return issues;
  }

  async reportFraudIncident(incidentData: {
    type: 'payment' | 'appointment' | 'credential';
    entityId: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    evidence: any;
  }): Promise<void> {
    try {
      // No FraudIncident model in schema; raising a SystemAlert instead
      await this.prisma.systemAlert.create({
        data: {
          type: AlertType.FRAUD_DETECTION,
          severity: this.mapSeverity(incidentData.severity),
          title: `Fraud incident: ${incidentData.type}`,
          description: incidentData.description,
          affectedEntity: incidentData.type,
          entityId: incidentData.entityId,
          isResolved: false,
          assignedTo: null,
          // createdAt is defaulted by schema
        }
      });

      logger.info(`Fraud incident reported: ${incidentData.type} - ${incidentData.entityId}`);
    } catch (error) {
      logger.error('Error reporting fraud incident:', error);
      throw error;
    }
  }

  private mapSeverity(sev: 'low' | 'medium' | 'high' | 'critical'): Severity {
    switch (sev) {
      case 'low': return Severity.INFO;
      case 'medium': return Severity.WARNING;
      case 'high':
      case 'critical': return Severity.CRITICAL;
      default: return Severity.WARNING;
    }
  }
}
