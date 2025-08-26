import { PrismaClient, MedicalRecord, UserRole, RiskLevel } from '@prisma/client';
import { logger } from '../utils/logger';

export class MedicalRecordService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createMedicalRecord(data: {
    patientId: string;
    doctorId?: string;
    diagnosis: string;
    symptoms: string[];
    visitSummary?: string;
    riskLevel?: MedicalRecord['riskLevel'];
    riskScore?: number;
    riskFactors?: string[];
    aiRecommendation?: string;
    followUpRequired?: boolean;
    followUpDate?: Date | null;
  }): Promise<MedicalRecord> {
    try {
      return await this.prisma.medicalRecord.create({
        data: {
          patientId: data.patientId,
          doctorId: data.doctorId,
          diagnosis: data.diagnosis,
          symptoms: data.symptoms,
          visitSummary: data.visitSummary ?? '',
          riskLevel: (data.riskLevel as RiskLevel | undefined) ?? RiskLevel.LOW,
          riskScore: data.riskScore ?? 0,
          riskFactors: data.riskFactors ?? [],
          aiRecommendation: data.aiRecommendation ?? '',
          followUpRequired: data.followUpRequired ?? false,
          followUpDate: data.followUpDate ?? undefined
        }
      });
    } catch (error) {
      logger.error('Error creating medical record:', error);
      throw error;
    }
  }

  async getMedicalRecordById(recordId: string): Promise<MedicalRecord | null> {
    try {
      return await this.prisma.medicalRecord.findUnique({
        where: { id: recordId },
        include: {
          patient: true,
          doctor: true
        }
      });
    } catch (error) {
      logger.error('Error fetching medical record by ID:', error);
      throw error;
    }
  }

  async getPatientMedicalHistory(patientId: string): Promise<MedicalRecord[]> {
    try {
      return await this.prisma.medicalRecord.findMany({
        where: { patientId },
        include: {
          doctor: { include: { doctorProfile: true } }
        },
        orderBy: { date: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching patient medical history:', error);
      throw error;
    }
  }

  async getDoctorMedicalRecords(doctorId: string): Promise<MedicalRecord[]> {
    try {
      return await this.prisma.medicalRecord.findMany({
        where: { doctorId },
        include: {
          patient: { include: { patientProfile: true } }
        },
        orderBy: { date: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching doctor medical records:', error);
      throw error;
    }
  }

  async updateMedicalRecord(recordId: string, updateData: Partial<MedicalRecord>): Promise<MedicalRecord> {
    try {
      return await this.prisma.medicalRecord.update({
        where: { id: recordId },
        data: {
          ...updateData
        }
      });
    } catch (error) {
      logger.error('Error updating medical record:', error);
      throw error;
    }
  }

  async searchMedicalRecords(searchParams: {
    patientId?: string;
    doctorId?: string;
    diagnosis?: string;
    symptoms?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<MedicalRecord[]> {
    try {
      const where: any = {};

      if (searchParams.patientId) where.patientId = searchParams.patientId;
      if (searchParams.doctorId) where.doctorId = searchParams.doctorId;
      if (searchParams.diagnosis) {
        where.diagnosis = { contains: searchParams.diagnosis, mode: 'insensitive' };
      }
      if (searchParams.symptoms && searchParams.symptoms.length > 0) {
        where.symptoms = { hasSome: searchParams.symptoms };
      }
      if (searchParams.dateFrom || searchParams.dateTo) {
        where.date = {};
        if (searchParams.dateFrom) where.date.gte = searchParams.dateFrom;
        if (searchParams.dateTo) where.date.lte = searchParams.dateTo;
      }

      return await this.prisma.medicalRecord.findMany({
        where,
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        },
        orderBy: { date: 'desc' },
        take: searchParams.limit || 50
      });
    } catch (error) {
      logger.error('Error searching medical records:', error);
      throw error;
    }
  }

  // Note: MedicalRecord does not reference Appointment in schema; getRecordsByAppointment removed.

  async generateMedicalSummary(patientId: string, dateRange?: { from: Date; to: Date }): Promise<{
    totalRecords: number;
    commonDiagnoses: { diagnosis: string; count: number }[];
    commonSymptoms: { symptom: string; count: number }[];
    recentTreatments: string[];
    chronicConditions: string[];
  }> {
    try {
      const where: any = { patientId };
      if (dateRange) {
        where.date = {
          gte: dateRange.from,
          lte: dateRange.to
        };
      }

      const records = await this.prisma.medicalRecord.findMany({
        where,
        orderBy: { date: 'desc' }
      });

      // Analyze diagnoses
      const diagnosisCount: { [key: string]: number } = {};
      records.forEach(record => {
        if (record.diagnosis) {
          diagnosisCount[record.diagnosis] = (diagnosisCount[record.diagnosis] || 0) + 1;
        }
      });

      // Analyze symptoms
      const symptomCount: { [key: string]: number } = {};
      records.forEach(record => {
        record.symptoms.forEach(symptom => {
          symptomCount[symptom] = (symptomCount[symptom] || 0) + 1;
        });
      });

      // Get common diagnoses and symptoms
      const commonDiagnoses = Object.entries(diagnosisCount)
        .map(([diagnosis, count]) => ({ diagnosis, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const commonSymptoms = Object.entries(symptomCount)
        .map(([symptom, count]) => ({ symptom, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get recent visit summaries (as treatments proxy)
      const recentTreatments = records
        .slice(0, 5)
        .map(record => record.visitSummary)
        .filter(summary => summary) as string[];

      // Identify chronic conditions (diagnoses appearing multiple times)
      const chronicConditions = commonDiagnoses
        .filter(item => item.count >= 3)
        .map(item => item.diagnosis);

      return {
        totalRecords: records.length,
        commonDiagnoses,
        commonSymptoms,
        recentTreatments,
        chronicConditions
      };
    } catch (error) {
      logger.error('Error generating medical summary:', error);
      return {
        totalRecords: 0,
        commonDiagnoses: [],
        commonSymptoms: [],
        recentTreatments: [],
        chronicConditions: []
      };
    }
  }

  async deleteMedicalRecord(recordId: string): Promise<void> {
    try {
      await this.prisma.medicalRecord.delete({
        where: { id: recordId }
      });
      logger.info(`Medical record ${recordId} deleted`);
    } catch (error) {
      logger.error('Error deleting medical record:', error);
      throw error;
    }
  }

  async validateRecordAccess(recordId: string, userId: string, userRole: UserRole): Promise<boolean> {
    try {
      const record = await this.prisma.medicalRecord.findUnique({
        where: { id: recordId },
        include: {
          patient: true,
          doctor: true
        }
      });

      if (!record) return false;

      // Admin can access all records
      if (userRole === UserRole.ADMIN) return true;

      // Patient can access their own records
      if (userRole === UserRole.PATIENT && record.patientId === userId) return true;

      // Doctor can access records they created
      if (userRole === UserRole.DOCTOR && record.doctorId === userId) return true;

      return false;
    } catch (error) {
      logger.error('Error validating record access:', error);
      return false;
    }
  }

  // Placeholder to support DoctorAIAgent metrics update without schema coupling
  async updateDoctorMetrics(doctorId: string, metrics: Partial<any>): Promise<void> {
    try {
      // If a DoctorQualityMetrics model exists, you can implement an upsert here.
      // For now, just log the metrics update intent.
      logger.info(`updateDoctorMetrics called for doctor ${doctorId}: ${JSON.stringify(metrics)}`);
    } catch (error) {
      logger.error('Error updating doctor metrics (stub):', error);
    }
  }
}
