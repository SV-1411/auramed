import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { Appointment, User } from '../../../shared/types';

export class AppointmentService {
  private db = getDatabase();
  private redis = getRedis();

  async createAppointment(appointmentData: any): Promise<any> {
    try {
      const appointment = await this.db.appointment.create({
        data: {
          patientId: appointmentData.patientId,
          doctorId: appointmentData.doctorId,
          scheduledAt: appointmentData.scheduledAt,
          duration: appointmentData.duration || 30,
          type: appointmentData.type,
          symptoms: appointmentData.symptoms,
          riskLevel: appointmentData.riskScore.level.toUpperCase(),
          riskScore: appointmentData.riskScore.score,
          paymentAmount: appointmentData.paymentAmount,
          paymentStatus: appointmentData.paymentStatus || 'PENDING'
        },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });

      logger.info(`Appointment created: ${appointment.id}`);
      return appointment;
    } catch (error) {
      logger.error('Error creating appointment:', error);
      throw error;
    }
  }

  async getAppointmentById(appointmentId: string): Promise<any> {
    try {
      return await this.db.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } },
          videoConsultation: true,
          payments: true
        }
      });
    } catch (error) {
      logger.error('Error fetching appointment:', error);
      throw error;
    }
  }

  async findAvailableUrgentDoctor(specializations?: string[]): Promise<any> {
    try {
      let whereClause: any = {
        role: 'DOCTOR',
        isActive: true,
        doctorProfile: {
          isVerified: true
        }
      };

      if (specializations && specializations.length > 0) {
        whereClause.doctorProfile.specialization = {
          hasSome: specializations
        };
      }

      // Find doctors with no current appointments
      const availableDoctors = await this.db.user.findMany({
        where: {
          ...whereClause,
          doctorAppointments: {
            none: {
              scheduledAt: {
                gte: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                lte: new Date(Date.now() + 30 * 60 * 1000)  // 30 minutes from now
              },
              status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
            }
          }
        },
        include: {
          doctorProfile: {
            include: {
              qualityMetrics: true
            }
          }
        },
        orderBy: {
          doctorProfile: {
            qualityScore: 'desc'
          }
        },
        take: 1
      });

      return availableDoctors[0] || null;
    } catch (error) {
      logger.error('Error finding available urgent doctor:', error);
      return null;
    }
  }

  async updateAppointmentStatus(appointmentId: string, status: string): Promise<any> {
    try {
      return await this.db.appointment.update({
        where: { id: appointmentId },
        data: { status }
      });
    } catch (error) {
      logger.error('Error updating appointment status:', error);
      throw error;
    }
  }

  async getPatientAppointments(patientId: string, limit: number = 20): Promise<any[]> {
    try {
      return await this.db.appointment.findMany({
        where: { patientId },
        include: {
          doctor: { include: { doctorProfile: true } },
          videoConsultation: true
        },
        orderBy: { scheduledAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error('Error fetching patient appointments:', error);
      throw error;
    }
  }

  async getDoctorAppointments(doctorId: string, limit: number = 20): Promise<any[]> {
    try {
      return await this.db.appointment.findMany({
        where: { doctorId },
        include: {
          patient: { include: { patientProfile: true } },
          videoConsultation: true
        },
        orderBy: { scheduledAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error('Error fetching doctor appointments:', error);
      throw error;
    }
  }

  async checkDoctorAvailability(doctorId: string, scheduledAt: Date): Promise<boolean> {
    try {
      const existingAppointment = await this.db.appointment.findFirst({
        where: {
          doctorId,
          scheduledAt,
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
        }
      });

      return !existingAppointment;
    } catch (error) {
      logger.error('Error checking doctor availability:', error);
      return false;
    }
  }
}
