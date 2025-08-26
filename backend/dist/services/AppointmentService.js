"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentService = void 0;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
class AppointmentService {
    constructor() {
        this.db = (0, database_1.getDatabase)();
        this.redis = (0, redis_1.getRedis)();
    }
    async createAppointment(appointmentData) {
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
            logger_1.logger.info(`Appointment created: ${appointment.id}`);
            return appointment;
        }
        catch (error) {
            logger_1.logger.error('Error creating appointment:', error);
            throw error;
        }
    }
    async getAppointmentById(appointmentId) {
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
        }
        catch (error) {
            logger_1.logger.error('Error fetching appointment:', error);
            throw error;
        }
    }
    async findAvailableUrgentDoctor(specializations) {
        try {
            let whereClause = {
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
                                lte: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
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
        }
        catch (error) {
            logger_1.logger.error('Error finding available urgent doctor:', error);
            return null;
        }
    }
    async updateAppointmentStatus(appointmentId, status) {
        try {
            return await this.db.appointment.update({
                where: { id: appointmentId },
                data: { status }
            });
        }
        catch (error) {
            logger_1.logger.error('Error updating appointment status:', error);
            throw error;
        }
    }
    async getPatientAppointments(patientId, limit = 20) {
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
        }
        catch (error) {
            logger_1.logger.error('Error fetching patient appointments:', error);
            throw error;
        }
    }
    async getDoctorAppointments(doctorId, limit = 20) {
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
        }
        catch (error) {
            logger_1.logger.error('Error fetching doctor appointments:', error);
            throw error;
        }
    }
    async checkDoctorAvailability(doctorId, scheduledAt) {
        try {
            const existingAppointment = await this.db.appointment.findFirst({
                where: {
                    doctorId,
                    scheduledAt,
                    status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
                }
            });
            return !existingAppointment;
        }
        catch (error) {
            logger_1.logger.error('Error checking doctor availability:', error);
            return false;
        }
    }
}
exports.AppointmentService = AppointmentService;
//# sourceMappingURL=AppointmentService.js.map