import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface ComplianceViolation {
  entityType: string;
  entityId: string;
  description: string;
  regulation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataRetentionViolation {
  recordId: string;
  recordType: string;
  description: string;
  retentionPeriod: number;
  actualAge: number;
}

export class ComplianceService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async checkHIPAACompliance(): Promise<ComplianceViolation[]> {
    try {
      const violations: ComplianceViolation[] = [];

      // Check for unencrypted sensitive data
      const unencryptedRecords = await this.findUnencryptedMedicalRecords();
      for (const record of unencryptedRecords) {
        violations.push({
          entityType: 'medical_record',
          entityId: record.id,
          description: 'Medical record contains unencrypted sensitive data',
          regulation: 'HIPAA',
          severity: 'high'
        });
      }

      // Check for unauthorized access attempts
      const unauthorizedAccess = await this.detectUnauthorizedAccess();
      for (const access of unauthorizedAccess) {
        violations.push({
          entityType: 'access_log',
          entityId: access.id,
          description: `Unauthorized access attempt to patient data by ${access.userId}`,
          regulation: 'HIPAA',
          severity: 'critical'
        });
      }

      // Check for missing patient consent
      const missingConsent = await this.findMissingPatientConsent();
      for (const consent of missingConsent) {
        violations.push({
          entityType: 'patient',
          entityId: consent.patientId,
          description: 'Patient data processed without proper consent documentation',
          regulation: 'HIPAA',
          severity: 'medium'
        });
      }

      // Check for data sharing violations
      const dataSharingViolations = await this.detectDataSharingViolations();
      for (const violation of dataSharingViolations) {
        violations.push({
          entityType: 'data_sharing',
          entityId: violation.id,
          description: 'Patient data shared without proper authorization',
          regulation: 'HIPAA',
          severity: 'high'
        });
      }

      logger.info(`HIPAA compliance check completed: ${violations.length} violations found`);
      return violations;
    } catch (error) {
      logger.error('Error checking HIPAA compliance:', error);
      return [];
    }
  }

  async checkDataRetention(): Promise<DataRetentionViolation[]> {
    try {
      const violations: DataRetentionViolation[] = [];
      const currentDate = new Date();

      // Define retention policies (in days)
      const retentionPolicies = {
        medical_records: 2555, // 7 years
        appointments: 1095,    // 3 years
        payments: 2190,        // 6 years
        audit_logs: 365,       // 1 year
        user_sessions: 30      // 30 days
      };

      // Check medical records retention
      const oldMedicalRecords = await this.prisma.medicalRecord.findMany({
        where: {
          createdAt: {
            lt: new Date(currentDate.getTime() - retentionPolicies.medical_records * 24 * 60 * 60 * 1000)
          }
        }
      });

      for (const record of oldMedicalRecords) {
        const age = Math.floor((currentDate.getTime() - new Date(record.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        violations.push({
          recordId: record.id,
          recordType: 'medical_record',
          description: 'Medical record exceeds retention period and should be archived or deleted',
          retentionPeriod: retentionPolicies.medical_records,
          actualAge: age
        });
      }

      // Check appointments retention
      const oldAppointments = await this.prisma.appointment.findMany({
        where: {
          createdAt: {
            lt: new Date(currentDate.getTime() - retentionPolicies.appointments * 24 * 60 * 60 * 1000)
          }
        }
      });

      for (const appointment of oldAppointments) {
        const age = Math.floor((currentDate.getTime() - new Date(appointment.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        violations.push({
          recordId: appointment.id,
          recordType: 'appointment',
          description: 'Appointment record exceeds retention period',
          retentionPeriod: retentionPolicies.appointments,
          actualAge: age
        });
      }

      // Check audit logs retention
      const oldAuditLogs = await this.prisma.auditLog.findMany({
        where: {
          timestamp: {
            lt: new Date(currentDate.getTime() - retentionPolicies.audit_logs * 24 * 60 * 60 * 1000)
          }
        }
      });

      for (const log of oldAuditLogs) {
        const age = Math.floor((currentDate.getTime() - new Date(log.timestamp).getTime()) / (24 * 60 * 60 * 1000));
        violations.push({
          recordId: log.id,
          recordType: 'audit_log',
          description: 'Audit log exceeds retention period',
          retentionPeriod: retentionPolicies.audit_logs,
          actualAge: age
        });
      }

      logger.info(`Data retention check completed: ${violations.length} violations found`);
      return violations;
    } catch (error) {
      logger.error('Error checking data retention:', error);
      return [];
    }
  }

  async checkGDPRCompliance(): Promise<ComplianceViolation[]> {
    try {
      const violations: ComplianceViolation[] = [];

      // Check for users without explicit consent
      const usersWithoutConsent = await this.prisma.user.findMany({
        where: {
          consentGiven: false,
          isActive: true
        }
      });

      for (const user of usersWithoutConsent) {
        violations.push({
          entityType: 'user',
          entityId: user.id,
          description: 'User data processed without explicit GDPR consent',
          regulation: 'GDPR',
          severity: 'high'
        });
      }

      // Check for data processing without legal basis
      const unauthorizedProcessing = await this.detectUnauthorizedDataProcessing();
      for (const processing of unauthorizedProcessing) {
        violations.push({
          entityType: 'data_processing',
          entityId: processing.id,
          description: 'Data processing without valid legal basis',
          regulation: 'GDPR',
          severity: 'critical'
        });
      }

      // Check for unfulfilled data subject requests
      const pendingRequests = await this.findPendingDataSubjectRequests();
      for (const request of pendingRequests) {
        violations.push({
          entityType: 'data_subject_request',
          entityId: request.id,
          description: `Data subject request pending beyond 30-day limit: ${request.type}`,
          regulation: 'GDPR',
          severity: 'medium'
        });
      }

      logger.info(`GDPR compliance check completed: ${violations.length} violations found`);
      return violations;
    } catch (error) {
      logger.error('Error checking GDPR compliance:', error);
      return [];
    }
  }

  private async findUnencryptedMedicalRecords(): Promise<any[]> {
    // Mock implementation - in production, check for actual encryption status
    return await this.prisma.medicalRecord.findMany({
      where: {
        // Simulate finding records that should be encrypted but aren't
        diagnosis: { contains: 'UNENCRYPTED' }
      },
      take: 5
    });
  }

  private async detectUnauthorizedAccess(): Promise<any[]> {
    // Mock implementation - check audit logs for suspicious access patterns
    const suspiciousLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'DATA_ACCESS',
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      take: 10
    });

    // Filter for potentially unauthorized access
    return suspiciousLogs.filter(log => {
      const details = JSON.parse(log.details || '{}');
      return details.accessTime && new Date(details.accessTime).getHours() < 6; // Access outside business hours
    });
  }

  private async findMissingPatientConsent(): Promise<any[]> {
    // Find patients without proper consent documentation
    return await this.prisma.user.findMany({
      where: {
        role: 'PATIENT',
        consentGiven: false,
        createdAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
        }
      },
      select: { id: true },
      take: 5
    }).then(users => users.map(user => ({ patientId: user.id })));
  }

  private async detectDataSharingViolations(): Promise<any[]> {
    // Mock implementation - detect unauthorized data sharing
    return await this.prisma.auditLog.findMany({
      where: {
        action: 'DATA_EXPORT',
        details: { contains: 'external' }
      },
      take: 3
    });
  }

  private async detectUnauthorizedDataProcessing(): Promise<any[]> {
    // Mock implementation - find data processing without proper authorization
    return await this.prisma.auditLog.findMany({
      where: {
        action: 'DATA_PROCESSING',
        details: { not: { contains: 'authorized' } }
      },
      take: 3
    });
  }

  private async findPendingDataSubjectRequests(): Promise<any[]> {
    // Mock implementation - find overdue data subject requests
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return await this.prisma.auditLog.findMany({
      where: {
        action: 'DATA_SUBJECT_REQUEST',
        timestamp: { lt: thirtyDaysAgo },
        details: { contains: 'pending' }
      },
      take: 3
    }).then(logs => logs.map(log => ({
      id: log.id,
      type: JSON.parse(log.details || '{}').requestType || 'unknown'
    })));
  }

  async generateComplianceReport(): Promise<{
    hipaaViolations: ComplianceViolation[];
    gdprViolations: ComplianceViolation[];
    dataRetentionViolations: DataRetentionViolation[];
    overallScore: number;
  }> {
    try {
      const hipaaViolations = await this.checkHIPAACompliance();
      const gdprViolations = await this.checkGDPRCompliance();
      const dataRetentionViolations = await this.checkDataRetention();

      // Calculate overall compliance score
      const totalViolations = hipaaViolations.length + gdprViolations.length + dataRetentionViolations.length;
      const criticalViolations = [...hipaaViolations, ...gdprViolations].filter(v => v.severity === 'critical').length;
      
      let overallScore = 100;
      overallScore -= (criticalViolations * 20);
      overallScore -= (totalViolations * 5);
      overallScore = Math.max(0, overallScore);

      return {
        hipaaViolations,
        gdprViolations,
        dataRetentionViolations,
        overallScore
      };
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      return {
        hipaaViolations: [],
        gdprViolations: [],
        dataRetentionViolations: [],
        overallScore: 0
      };
    }
  }
}
