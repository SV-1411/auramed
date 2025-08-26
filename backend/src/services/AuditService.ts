import { PrismaClient, AppointmentStatus } from '@prisma/client';
import { logger } from '../utils/logger';

export interface ConsultationStats {
  totalConsultations: number;
  successfulDiagnoses: number;
  followUpsRequired: number;
  followUpsCompleted: number;
}

export interface PatientFeedback {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { [key: number]: number };
}

export interface ResponseTimeData {
  averageMinutes: number;
  medianMinutes: number;
  totalResponses: number;
}

export class AuditService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async logCredentialVerification(doctorId: string, verified: boolean): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'CREDENTIAL_VERIFICATION',
          entity: 'DOCTOR',
          entityId: doctorId,
          details: { verified },
          userId: null,
          createdAt: new Date()
        }
      });
      logger.info(`Credential verification logged for doctor ${doctorId}: ${verified}`);
    } catch (error) {
      logger.error('Error logging credential verification:', error);
      throw error;
    }
  }

  async logQualityRankingUpdate(doctorsUpdated: number): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'QUALITY_RANKING_UPDATE',
          entity: 'SYSTEM',
          entityId: 'quality-rankings',
          details: { doctorsUpdated },
          userId: null,
          createdAt: new Date()
        }
      });
      logger.info(`Quality ranking update logged for ${doctorsUpdated} doctors`);
    } catch (error) {
      logger.error('Error logging quality ranking update:', error);
      throw error;
    }
  }

  async getDoctorConsultationStats(doctorId: string): Promise<ConsultationStats> {
    try {
      const appointments = await this.prisma.appointment.findMany({
        where: { 
          doctorId,
          status: AppointmentStatus.COMPLETED
        }
      });

      const totalConsultations = appointments.length;
      // If medicalRecord relation is not present on Appointment in Prisma, fall back to total consultations
      const successfulDiagnoses = appointments.length;

      // Mock follow-up data - in production, track actual follow-ups
      const followUpsRequired = Math.floor(totalConsultations * 0.3);
      const followUpsCompleted = Math.floor(followUpsRequired * 0.8);

      return {
        totalConsultations,
        successfulDiagnoses,
        followUpsRequired,
        followUpsCompleted
      };
    } catch (error) {
      logger.error('Error getting doctor consultation stats:', error);
      return {
        totalConsultations: 0,
        successfulDiagnoses: 0,
        followUpsRequired: 0,
        followUpsCompleted: 0
      };
    }
  }

  async getDoctorPatientFeedback(doctorId: string): Promise<PatientFeedback> {
    try {
      // doctorId refers to User.id; join via DoctorProfile.userId
      const profile = await this.prisma.doctorProfile.findUnique({
        where: { userId: doctorId },
        include: { qualityMetrics: true }
      });

      if (!profile || !profile.qualityMetrics) {
        return { averageRating: 0, totalReviews: 0, ratingDistribution: {} };
      }

      const avg = profile.qualityMetrics.averageRating || 0;
      const total = profile.qualityMetrics.totalConsultations || 0;
      return { averageRating: avg, totalReviews: total, ratingDistribution: {} };
    } catch (error) {
      logger.error('Error getting doctor patient feedback:', error);
      return { averageRating: 0, totalReviews: 0, ratingDistribution: {} };
    }
  }

  async getDoctorResponseTimes(doctorId: string): Promise<ResponseTimeData> {
    try {
      const appointments = await this.prisma.appointment.findMany({
        where: { 
          doctorId,
          status: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.IN_PROGRESS] }
        },
        orderBy: { scheduledAt: 'desc' },
        take: 50 // Last 50 appointments for response time calculation
      });

      if (appointments.length === 0) {
        return {
          averageMinutes: 0,
          medianMinutes: 0,
          totalResponses: 0
        };
      }

      // Mock response time calculation
      // In production, track actual response times from message timestamps
      const responseTimes = appointments.map(() => Math.floor(Math.random() * 60) + 5); // 5-65 minutes
      
      const averageMinutes = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const medianMinutes = sortedTimes[Math.floor(sortedTimes.length / 2)];

      return {
        averageMinutes: Math.round(averageMinutes),
        medianMinutes,
        totalResponses: responseTimes.length
      };
    } catch (error) {
      logger.error('Error getting doctor response times:', error);
      return {
        averageMinutes: 0,
        medianMinutes: 0,
        totalResponses: 0
      };
    }
  }

  async logUserAction(userId: string, action: string, entityType: string, entityId: string, details?: any): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entity: entityType,
          entityId,
          details: details ?? null,
          userId,
          createdAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error logging user action:', error);
      throw error;
    }
  }

  async getAuditLogs(filters: {
    entityType?: string;
    entityId?: string;
    performedBy?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<any[]> {
    try {
      const where: any = {};
      
      if (filters.entityType) where.entity = filters.entityType;
      if (filters.entityId) where.entityId = filters.entityId;
      if (filters.performedBy) where.userId = filters.performedBy;
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      return await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100
      });
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      return [];
    }
  }
}
