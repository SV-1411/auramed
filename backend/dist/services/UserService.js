"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
class UserService {
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    async getUserById(userId) {
        try {
            return await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    patientProfile: true,
                    doctorProfile: true,
                    adminProfile: true,
                    appointments: true,
                    doctorAppointments: true,
                    medicalRecords: true,
                    doctorRecords: true
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching user by ID:', error);
            throw error;
        }
    }
    async getUserByEmail(email) {
        try {
            return await this.prisma.user.findUnique({
                where: { email },
                include: {
                    patientProfile: true,
                    doctorProfile: true,
                    adminProfile: true
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching user by email:', error);
            throw error;
        }
    }
    async getAllDoctors() {
        try {
            return await this.prisma.user.findMany({
                where: { role: client_1.UserRole.DOCTOR },
                include: {
                    doctorProfile: true,
                    doctorAppointments: true
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching all doctors:', error);
            throw error;
        }
    }
    async updateDoctorQualityScore(doctorId, qualityScore) {
        try {
            await this.prisma.user.update({
                where: { id: doctorId },
                data: {
                    doctorProfile: {
                        update: {
                            qualityScore: qualityScore
                        }
                    }
                }
            });
            logger_1.logger.info(`Updated quality score for doctor ${doctorId}: ${qualityScore}`);
        }
        catch (error) {
            logger_1.logger.error('Error updating doctor quality score:', error);
            throw error;
        }
    }
    async createUser(userData) {
        try {
            return await this.prisma.user.create({
                data: {
                    email: userData.email,
                    password: userData.password,
                    role: userData.role,
                    phone: userData.phone
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error creating user:', error);
            throw error;
        }
    }
    async updateUser(userId, updateData) {
        try {
            return await this.prisma.user.update({
                where: { id: userId },
                data: updateData
            });
        }
        catch (error) {
            logger_1.logger.error('Error updating user:', error);
            throw error;
        }
    }
    async deleteUser(userId) {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: { isActive: false }
            });
            logger_1.logger.info(`User ${userId} deactivated`);
        }
        catch (error) {
            logger_1.logger.error('Error deactivating user:', error);
            throw error;
        }
    }
    async verifyUserCredentials(email, password) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { email },
                include: {
                    patientProfile: true,
                    doctorProfile: true,
                    adminProfile: true
                }
            });
            if (!user || !user.isActive) {
                return null;
            }
            // In production, use proper password hashing (bcrypt)
            // For now, simple comparison
            if (user.password === password) {
                return user;
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error verifying user credentials:', error);
            throw error;
        }
    }
    async getUsersByRole(role) {
        try {
            return await this.prisma.user.findMany({
                where: { role, isActive: true },
                include: {
                    patientProfile: true,
                    doctorProfile: true,
                    adminProfile: true
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching users by role:', error);
            throw error;
        }
    }
}
exports.UserService = UserService;
//# sourceMappingURL=UserService.js.map