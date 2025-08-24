import { PrismaClient, User, Role } from '@prisma/client';
import { logger } from '../utils/logger';

export class UserService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          appointments: true,
          medicalRecords: true
        }
      });
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
        include: {
          profile: true
        }
      });
    } catch (error) {
      logger.error('Error fetching user by email:', error);
      throw error;
    }
  }

  async getAllDoctors(): Promise<User[]> {
    try {
      return await this.prisma.user.findMany({
        where: { role: 'DOCTOR' },
        include: {
          profile: true,
          appointments: true
        }
      });
    } catch (error) {
      logger.error('Error fetching all doctors:', error);
      throw error;
    }
  }

  async updateDoctorQualityScore(doctorId: string, qualityScore: number): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: doctorId },
        data: {
          profile: {
            update: {
              qualityScore: qualityScore
            }
          }
        }
      });
      logger.info(`Updated quality score for doctor ${doctorId}: ${qualityScore}`);
    } catch (error) {
      logger.error('Error updating doctor quality score:', error);
      throw error;
    }
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: Role;
    phoneNumber?: string;
  }): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          phoneNumber: userData.phoneNumber,
          isActive: true,
          emailVerified: false
        }
      });
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      });
      logger.info(`User ${userId} deactivated`);
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  async verifyUserCredentials(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: { profile: true }
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
    } catch (error) {
      logger.error('Error verifying user credentials:', error);
      throw error;
    }
  }

  async getUsersByRole(role: Role): Promise<User[]> {
    try {
      return await this.prisma.user.findMany({
        where: { role, isActive: true },
        include: { profile: true }
      });
    } catch (error) {
      logger.error('Error fetching users by role:', error);
      throw error;
    }
  }
}
