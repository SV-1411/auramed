import { AIAgentMessage, SystemAlert, DoctorQualityMetrics, User } from '../../../shared/types';
import { logger } from '../utils/logger';
import { PrismaClient, UserRole } from '@prisma/client';
import { OpenAIService } from '../services/OpenAIService';
import { UserService } from '../services/UserService';
import { AuditService } from '../services/AuditService';
import { FraudDetectionService } from '../services/FraudDetectionService';
import { ComplianceService } from '../services/ComplianceService';

export class AdminAIAgent {
  private openAI: OpenAIService;
  private userService: UserService;
  private auditService: AuditService;
  private fraudDetection: FraudDetectionService;
  private complianceService: ComplianceService;
  private prisma: PrismaClient;

  constructor() {
    this.openAI = new OpenAIService();
    this.userService = new UserService();
    this.auditService = new AuditService();
    this.fraudDetection = new FraudDetectionService();
    this.complianceService = new ComplianceService();
    this.prisma = new PrismaClient();
  }

  async processMessage(message: AIAgentMessage): Promise<AIAgentMessage> {
    try {
      logger.info(`Admin AI Agent processing message: ${message.id}`);

      switch (message.messageType) {
        case 'text':
          return await this.handleAdminQuery(message);
        case 'alert':
          return await this.handleSystemAlert(message);
        default:
          return await this.handleAdminQuery(message);
      }
    } catch (error) {
      logger.error('Admin AI Agent error:', error);
      return this.createErrorResponse(message, 'Unable to process admin request. Please try again.');
    }
  }

  async verifyDoctorCredentials(doctorId: string): Promise<{ verified: boolean; issues: string[] }> {
    try {
      const doctor = await this.userService.getUserById(doctorId);
      if (!doctor || doctor.role !== UserRole.DOCTOR) {
        return { verified: false, issues: ['Doctor not found'] };
      }
      // Fetch DoctorProfile from DB to ensure we have correct schema-aligned fields
      const profile = await this.prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
      if (!profile) {
        return { verified: false, issues: ['Doctor profile not found'] };
      }
      const issues: string[] = [];

      // Check license number format and validity
      if (!profile.licenseNumber || profile.licenseNumber.length < 8) {
        issues.push('Invalid license number format');
      }

      // Check qualifications
      if (!profile.qualifications || profile.qualifications.length === 0) {
        issues.push('No qualifications listed');
      }

      // Check specialization
      if (!profile.specialization || profile.specialization.length === 0) {
        issues.push('No specialization specified');
      }

      // Simulate external license verification
      const licenseValid = await this.verifyLicenseWithAuthority(profile.licenseNumber);
      if (!licenseValid) {
        issues.push('License not verified with medical authority');
      }

      // Log verification attempt
      await this.auditService.logCredentialVerification(doctorId, issues.length === 0);

      return {
        verified: issues.length === 0,
        issues
      };
    } catch (error) {
      logger.error('Error verifying doctor credentials:', error);
      return { verified: false, issues: ['Verification system error'] };
    }
  }

  async detectFraudulentActivity(): Promise<SystemAlert[]> {
    try {
      const alerts: SystemAlert[] = [];

      // Check for unusual payment patterns
      const suspiciousPayments = await this.fraudDetection.detectSuspiciousPayments();
      for (const payment of suspiciousPayments) {
        alerts.push({
          id: this.generateId(),
          type: 'fraud_detection',
          severity: 'high',
          title: 'Suspicious Payment Activity',
          description: `Unusual payment pattern detected for user ${payment.userId}`,
          affectedEntity: 'payment',
          entityId: payment.id,
          isResolved: false,
          createdAt: new Date()
        });
      }

      // Check for fake appointments
      const fakeAppointments = await this.fraudDetection.detectFakeAppointments();
      for (const appointment of fakeAppointments) {
        alerts.push({
          id: this.generateId(),
          type: 'fraud_detection',
          severity: 'medium',
          title: 'Potential Fake Appointment',
          description: `Suspicious appointment pattern detected`,
          affectedEntity: 'appointment',
          entityId: appointment.id,
          isResolved: false,
          createdAt: new Date()
        });
      }

      // Check for credential fraud
      const credentialIssues = await this.fraudDetection.detectCredentialFraud();
      for (const issue of credentialIssues) {
        alerts.push({
          id: this.generateId(),
          type: 'fraud_detection',
          severity: 'critical',
          title: 'Credential Fraud Detected',
          description: `Invalid or fraudulent credentials detected for doctor ${issue.doctorId}`,
          affectedEntity: 'doctor',
          entityId: issue.doctorId,
          isResolved: false,
          createdAt: new Date()
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Error detecting fraudulent activity:', error);
      return [];
    }
  }

  async updateDoctorQualityRankings(): Promise<DoctorQualityMetrics[]> {
    try {
      const doctors = await this.userService.getAllDoctors();
      const updatedMetrics: DoctorQualityMetrics[] = [];

      for (const doctor of doctors) {
        const metrics = await this.calculateDoctorQualityScore(doctor.id);
        updatedMetrics.push(metrics);
        
        // Update in database
        await this.userService.updateDoctorQualityScore(doctor.id, metrics.qualityScore);
      }

      // Log ranking update
      await this.auditService.logQualityRankingUpdate(updatedMetrics.length);

      return updatedMetrics;
    } catch (error) {
      logger.error('Error updating doctor quality rankings:', error);
      return [];
    }
  }

  async monitorCompliance(): Promise<SystemAlert[]> {
    try {
      const alerts: SystemAlert[] = [];

      // Check HIPAA compliance
      const hipaaViolations = await this.complianceService.checkHIPAACompliance();
      for (const violation of hipaaViolations) {
        alerts.push({
          id: this.generateId(),
          type: 'compliance_violation',
          severity: 'high',
          title: 'HIPAA Compliance Violation',
          description: violation.description,
          affectedEntity: violation.entityType,
          entityId: violation.entityId,
          isResolved: false,
          createdAt: new Date()
        });
      }

      // Check data retention policies
      const retentionViolations = await this.complianceService.checkDataRetention();
      for (const violation of retentionViolations) {
        alerts.push({
          id: this.generateId(),
          type: 'compliance_violation',
          severity: 'medium',
          title: 'Data Retention Policy Violation',
          description: violation.description,
          affectedEntity: 'data',
          entityId: violation.recordId,
          isResolved: false,
          createdAt: new Date()
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Error monitoring compliance:', error);
      return [];
    }
  }

  private async handleAdminQuery(message: AIAgentMessage): Promise<AIAgentMessage> {
    const systemPrompt = `You are an Admin AI Agent for AuraMed healthcare platform. Your role is to:
    1. Verify doctor credentials and licenses automatically
    2. Detect fraudulent activities and suspicious patterns
    3. Monitor compliance with healthcare regulations (HIPAA, GDPR)
    4. Maintain audit logs and system accountability
    5. Generate dynamic quality rankings for healthcare providers
    6. Coordinate between Patient and Doctor AI agents
    7. Ensure system security and data privacy
    
    Always prioritize patient safety, data security, and regulatory compliance.
    Provide clear, actionable insights for system administrators.`;

    const response = await this.openAI.generateResponse(
      systemPrompt,
      message.content,
      message.fromUserId
    );

    return {
      id: this.generateId(),
      agentType: 'admin',
      fromUserId: 'admin-ai-agent',
      toUserId: message.fromUserId,
      content: response,
      messageType: 'text',
      timestamp: new Date(),
      isProcessed: false
    };
  }

  private async handleSystemAlert(message: AIAgentMessage): Promise<AIAgentMessage> {
    const { alertType, severity, details } = message.metadata || {};

    let response = '';
    switch (alertType) {
      case 'fraud_detection':
        response = await this.handleFraudAlert(details);
        break;
      case 'compliance_violation':
        response = await this.handleComplianceAlert(details);
        break;
      case 'system_error':
        response = await this.handleSystemErrorAlert(details);
        break;
      default:
        response = `🔔 **System Alert**\n\nSeverity: ${severity}\nDetails: ${details}`;
    }

    return {
      id: this.generateId(),
      agentType: 'admin',
      fromUserId: 'admin-ai-agent',
      toUserId: message.fromUserId,
      content: response,
      messageType: 'alert',
      metadata: message.metadata,
      timestamp: new Date(),
      isProcessed: false
    };
  }

  private async handleFraudAlert(details: any): Promise<string> {
    let response = '🚨 **FRAUD ALERT DETECTED**\n\n';
    response += `**Type:** ${details.type}\n`;
    response += `**Affected Entity:** ${details.entityType} (${details.entityId})\n`;
    response += `**Risk Level:** ${details.riskLevel}\n\n`;
    response += `**Details:** ${details.description}\n\n`;
    response += '**Automated Actions Taken:**\n';
    response += '• Account flagged for review\n';
    response += '• Suspicious transactions blocked\n';
    response += '• Audit trail preserved\n\n';
    response += '**Manual Review Required:** Yes\n';
    response += '**Recommended Actions:**\n';
    response += '• Investigate user activity patterns\n';
    response += '• Contact affected parties if necessary\n';
    response += '• Update fraud detection rules\n';

    return response;
  }

  private async handleComplianceAlert(details: any): Promise<string> {
    let response = '⚖️ **COMPLIANCE VIOLATION DETECTED**\n\n';
    response += `**Regulation:** ${details.regulation}\n`;
    response += `**Violation Type:** ${details.violationType}\n`;
    response += `**Severity:** ${details.severity}\n\n`;
    response += `**Description:** ${details.description}\n\n`;
    response += '**Immediate Actions Required:**\n';
    response += '• Review and remediate violation\n';
    response += '• Update compliance procedures\n';
    response += '• Document corrective measures\n';
    response += '• Report to regulatory bodies if required\n';

    return response;
  }

  private async handleSystemErrorAlert(details: any): Promise<string> {
    let response = '🔧 **SYSTEM ERROR ALERT**\n\n';
    response += `**Component:** ${details.component}\n`;
    response += `**Error Type:** ${details.errorType}\n`;
    response += `**Impact Level:** ${details.impact}\n\n`;
    response += `**Error Details:** ${details.message}\n\n`;
    response += '**Automated Recovery:**\n';
    response += details.autoRecovery ? '✅ Attempted' : '❌ Not available';
    response += '\n\n**Manual Intervention Required:** ';
    response += details.manualIntervention ? 'Yes' : 'No';

    return response;
  }

  private async verifyLicenseWithAuthority(licenseNumber: string): Promise<boolean> {
    // Simulate external API call to medical licensing authority
    // In production, this would integrate with actual medical board APIs
    try {
      // Mock verification logic
      const isValidFormat = /^[A-Z]{2}\d{6,8}$/.test(licenseNumber);
      const isNotBlacklisted = !['XX000000', 'INVALID1'].includes(licenseNumber);
      
      return isValidFormat && isNotBlacklisted;
    } catch (error) {
      logger.error('License verification failed:', error);
      return false;
    }
  }

  private async calculateDoctorQualityScore(doctorId: string): Promise<DoctorQualityMetrics> {
    try {
      // Get doctor's performance data
      const consultationData = await this.auditService.getDoctorConsultationStats(doctorId);
      const patientFeedback = await this.auditService.getDoctorPatientFeedback(doctorId);
      const responseTimeData = await this.auditService.getDoctorResponseTimes(doctorId);

      // Calculate composite quality score
      const diagnosticAccuracy = consultationData.successfulDiagnoses / consultationData.totalConsultations;
      const avgRating = patientFeedback.averageRating;
      const avgResponseTime = responseTimeData.averageMinutes;
      const followUpCompliance = consultationData.followUpsCompleted / consultationData.followUpsRequired;

      // Weighted quality score calculation
      const qualityScore = Math.round(
        (diagnosticAccuracy * 0.3 + 
         (avgRating / 5) * 0.25 + 
         Math.max(0, (30 - avgResponseTime) / 30) * 0.2 + 
         followUpCompliance * 0.25) * 100
      );

      return {
        doctorId,
        totalConsultations: consultationData.totalConsultations,
        averageRating: avgRating,
        diagnosticAccuracy: Math.round(diagnosticAccuracy * 100),
        responseTime: avgResponseTime,
        followUpCompliance: Math.round(followUpCompliance * 100),
        patientSatisfaction: Math.round((avgRating / 5) * 100),
        qualityScore,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error calculating doctor quality score:', error);
      // Return default metrics
      return {
        doctorId,
        totalConsultations: 0,
        averageRating: 0,
        diagnosticAccuracy: 0,
        responseTime: 0,
        followUpCompliance: 0,
        patientSatisfaction: 0,
        qualityScore: 0,
        lastUpdated: new Date()
      };
    }
  }

  private createErrorResponse(originalMessage: AIAgentMessage, errorText: string): AIAgentMessage {
    return {
      id: this.generateId(),
      agentType: 'admin',
      fromUserId: 'admin-ai-agent',
      toUserId: originalMessage.fromUserId,
      content: errorText,
      messageType: 'text',
      timestamp: new Date(),
      isProcessed: false
    };
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
