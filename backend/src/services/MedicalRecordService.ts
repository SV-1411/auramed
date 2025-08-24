import { PrismaClient, MedicalRecord } from '@prisma/client';
import { logger } from '../utils/logger';

export class MedicalRecordService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createMedicalRecord(data: {
    patientId: string;
    doctorId: string;
    appointmentId: string;
    diagnosis: string;
    symptoms: string[];
    treatment: string;
    prescription?: string;
    notes?: string;
  }): Promise<MedicalRecord> {
    try {
      return await this.prisma.medicalRecord.create({
        data: {
          patientId: data.patientId,
          doctorId: data.doctorId,
          appointmentId: data.appointmentId,
          diagnosis: data.diagnosis,
          symptoms: data.symptoms,
          treatment: data.treatment,
          prescription: data.prescription,
          notes: data.notes,
          createdAt: new Date()
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
          doctor: true,
          appointment: true
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
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true
            }
          },
          appointment: true
        },
        orderBy: { createdAt: 'desc' }
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
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true
            }
          },
          appointment: true
        },
        orderBy: { createdAt: 'desc' }
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
          ...updateData,
          updatedAt: new Date()
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
        where.createdAt = {};
        if (searchParams.dateFrom) where.createdAt.gte = searchParams.dateFrom;
        if (searchParams.dateTo) where.createdAt.lte = searchParams.dateTo;
      }

      return await this.prisma.medicalRecord.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: searchParams.limit || 50
      });
    } catch (error) {
      logger.error('Error searching medical records:', error);
      throw error;
    }
  }

  async getRecordsByAppointment(appointmentId: string): Promise<MedicalRecord[]> {
    try {
      return await this.prisma.medicalRecord.findMany({
        where: { appointmentId },
        include: {
          patient: true,
          doctor: true
        }
      });
    } catch (error) {
      logger.error('Error fetching records by appointment:', error);
      throw error;
    }
  }

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
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to
        };
      }

      const records = await this.prisma.medicalRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' }
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

      // Get recent treatments
      const recentTreatments = records
        .slice(0, 5)
        .map(record => record.treatment)
        .filter(treatment => treatment);

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

  async validateRecordAccess(recordId: string, userId: string, userRole: string): Promise<boolean> {
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
      if (userRole === 'ADMIN') return true;

      // Patient can access their own records
      if (userRole === 'PATIENT' && record.patientId === userId) return true;

      // Doctor can access records they created
      if (userRole === 'DOCTOR' && record.doctorId === userId) return true;

      return false;
    } catch (error) {
      logger.error('Error validating record access:', error);
      return false;
    }
  }
}
