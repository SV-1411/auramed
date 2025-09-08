import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { OpenAIService } from './OpenAIService';
import { MessageType } from '@prisma/client';

export interface ConsultationMessage {
  id: string;
  consultationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  timestamp: Date;
  isRead: boolean;
}

export interface ConsultationSummary {
  patientSummary: string;
  doctorSummary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpRequired: boolean;
  generatedAt: Date;
}

export class ConsultationService {
  private get db() { return getDatabase(); }
  private openAI: OpenAIService;

  constructor() {
    this.openAI = new OpenAIService();
  }

  /**
   * Fetch appointment by ID with necessary relations
   */
  async getAppointmentById(appointmentId: string): Promise<any> {
    try {
      return await this.db.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create consultation conversation for appointment
   */
  async createConsultation(appointmentId: string, patientId: string, doctorId: string): Promise<any> {
    try {
      const consultation = await this.db.consultation.create({
        data: {
          appointmentId,
          patientId,
          doctorId,
          status: 'ACTIVE',
          startedAt: new Date()
        }
      });

      // Create initial system message
      await this.addMessage(
        consultation.id,
        'system',
        'Consultation started. This conversation will be summarized by AI for both parties.',
        MessageType.SYSTEM
      );

      logger.info(`Consultation created: ${consultation.id}`);
      return consultation;
    } catch (error) {
      logger.error('Error creating consultation:', error);
      throw error;
    }
  }

  /**
   * Add message to consultation
   */
  async addMessage(
    consultationId: string, 
    senderId: string, 
    content: string, 
    messageType: MessageType = MessageType.TEXT
  ): Promise<ConsultationMessage> {
    try {
      const message = await this.db.consultationMessage.create({
        data: {
          consultationId,
          senderId,
          content,
          messageType,
          timestamp: new Date(),
          isRead: false
        }
      });

      // Generate AI summary after every 5 messages
      const messageCount = await this.db.consultationMessage.count({
        where: { consultationId, messageType: { not: 'SYSTEM' } }
      });

      if (messageCount % 5 === 0 && messageCount > 0) {
        await this.generateLiveSummary(consultationId);
      }

      return message;
    } catch (error) {
      logger.error('Error adding consultation message:', error);
      throw error;
    }
  }

  /**
   * Get consultation messages
   */
  async getConsultationMessages(consultationId: string, userId: string): Promise<ConsultationMessage[]> {
    try {
      // Verify user has access to this consultation
      const consultation = await this.db.consultation.findFirst({
        where: {
          id: consultationId,
          OR: [
            { patientId: userId },
            { doctorId: userId }
          ]
        }
      });

      if (!consultation) {
        throw new Error('Consultation not found or access denied');
      }

      const messages = await this.db.consultationMessage.findMany({
        where: { consultationId },
        orderBy: { timestamp: 'asc' }
      });

      // Mark messages as read for this user
      await this.markMessagesAsRead(consultationId, userId);

      return messages;
    } catch (error) {
      logger.error('Error fetching consultation messages:', error);
      throw error;
    }
  }

  /**
   * Generate live AI summary during consultation
   */
  private async generateLiveSummary(consultationId: string): Promise<void> {
    try {
      const consultation = await this.db.consultation.findUnique({
        where: { id: consultationId },
        include: {
          messages: {
            where: { messageType: { not: 'SYSTEM' } },
            orderBy: { timestamp: 'asc' }
          },
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });

      if (!consultation) return;

      const conversationText = consultation.messages
        .map(msg => `${msg.senderId === consultation.patientId ? 'Patient' : 'Doctor'}: ${msg.content}`)
        .join('\n');

      const summaryPrompt = `
      Generate a live consultation summary for this ongoing medical conversation:

      Patient: ${consultation.patient.patientProfile?.firstName} ${consultation.patient.patientProfile?.lastName}
      Doctor: Dr. ${consultation.doctor.doctorProfile?.firstName} ${consultation.doctor.doctorProfile?.lastName}

      Conversation so far:
      ${conversationText}

      Create two summaries:
      1. For the Doctor: Focus on medical insights, patient responses, symptoms progression
      2. For the Patient: Focus on doctor's explanations, recommendations, next steps

      Format as JSON:
      {
        "doctorSummary": "summary for doctor",
        "patientSummary": "summary for patient",
        "keyPoints": ["point1", "point2"],
        "currentStatus": "consultation progress status"
      }
      `;

      const summaryResponse = await this.openAI.generateResponse(
        'You are a medical AI creating live consultation summaries.',
        summaryPrompt,
        'system'
      );

      const summary = JSON.parse(summaryResponse);

      // Add AI summary message
      await this.db.consultationMessage.create({
        data: {
          consultationId,
          senderId: 'ai-assistant',
          content: `**Live Summary Update**\n\n**Key Points:**\n${summary.keyPoints.join('\n- ')}\n\n**Status:** ${summary.currentStatus}`,
          messageType: 'AI_SUMMARY',
          timestamp: new Date(),
          isRead: false
        }
      });

      // Store detailed summaries
      await this.db.consultationSummary.upsert({
        where: { consultationId },
        create: {
          consultationId,
          doctorSummary: summary.doctorSummary,
          patientSummary: summary.patientSummary,
          keyPoints: summary.keyPoints,
          currentStatus: summary.currentStatus,
          generatedAt: new Date()
        },
        update: {
          doctorSummary: summary.doctorSummary,
          patientSummary: summary.patientSummary,
          keyPoints: summary.keyPoints,
          currentStatus: summary.currentStatus,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Error generating live summary:', error);
    }
  }

  /**
   * Complete consultation and generate final summary
   */
  async completeConsultation(consultationId: string, userId: string): Promise<ConsultationSummary> {
    try {
      const consultation = await this.db.consultation.findFirst({
        where: {
          id: consultationId,
          OR: [
            { patientId: userId },
            { doctorId: userId }
          ]
        },
        include: {
          messages: { orderBy: { timestamp: 'asc' } },
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } },
          appointment: true
        }
      });

      if (!consultation) {
        throw new Error('Consultation not found or access denied');
      }

      // Generate final comprehensive summary
      const finalSummary = await this.generateFinalSummary(consultation);

      // Update consultation status
      await this.db.consultation.update({
        where: { id: consultationId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // Update appointment status
      await this.db.appointment.update({
        where: { id: consultation.appointmentId },
        data: { status: 'COMPLETED' }
      });

      return finalSummary;
    } catch (error) {
      logger.error('Error completing consultation:', error);
      throw error;
    }
  }

  /**
   * Generate final consultation summary
   */
  private async generateFinalSummary(consultation: any): Promise<ConsultationSummary> {
    try {
      const conversationText = consultation.messages
        .filter((msg: any) => msg.messageType !== 'SYSTEM')
        .map((msg: any) => `${msg.senderId === consultation.patientId ? 'Patient' : 'Doctor'}: ${msg.content}`)
        .join('\n');

      const finalPrompt = `
      Generate a comprehensive final summary for this completed medical consultation:

      Patient: ${consultation.patient.patientProfile?.firstName} ${consultation.patient.patientProfile?.lastName}
      Doctor: Dr. ${consultation.doctor.doctorProfile?.firstName} ${consultation.doctor.doctorProfile?.lastName}
      Appointment Type: ${consultation.appointment.type}
      Symptoms: ${consultation.appointment.symptoms.join(', ')}

      Full Conversation:
      ${conversationText}

      Create a detailed final summary including:
      1. Patient summary (what they should remember and do)
      2. Doctor summary (medical notes and observations)
      3. Key discussion points
      4. Recommendations and prescriptions
      5. Follow-up requirements
      6. Next steps

      Format as JSON:
      {
        "patientSummary": "comprehensive summary for patient",
        "doctorSummary": "detailed medical notes for doctor",
        "keyPoints": ["important point 1", "important point 2"],
        "recommendations": ["recommendation 1", "recommendation 2"],
        "prescriptions": ["medication 1", "medication 2"],
        "followUpRequired": true/false,
        "nextSteps": ["step 1", "step 2"],
        "diagnosis": "preliminary diagnosis if any",
        "treatmentPlan": "treatment plan summary"
      }
      `;

      const summaryResponse = await this.openAI.generateResponse(
        'You are a medical AI creating comprehensive consultation summaries.',
        finalPrompt,
        'system'
      );

      const summary = JSON.parse(summaryResponse);

      // Store final summary
      const finalSummaryRecord = await this.db.consultationSummary.upsert({
        where: { consultationId: consultation.id },
        create: {
          consultationId: consultation.id,
          doctorSummary: summary.doctorSummary,
          patientSummary: summary.patientSummary,
          keyPoints: summary.keyPoints,
          recommendations: summary.recommendations,
          prescriptions: summary.prescriptions || [],
          followUpRequired: summary.followUpRequired,
          diagnosis: summary.diagnosis,
          treatmentPlan: summary.treatmentPlan,
          generatedAt: new Date(),
          isComplete: true
        },
        update: {
          doctorSummary: summary.doctorSummary,
          patientSummary: summary.patientSummary,
          keyPoints: summary.keyPoints,
          recommendations: summary.recommendations,
          prescriptions: summary.prescriptions || [],
          followUpRequired: summary.followUpRequired,
          diagnosis: summary.diagnosis,
          treatmentPlan: summary.treatmentPlan,
          updatedAt: new Date(),
          isComplete: true
        }
      });

      return {
        patientSummary: summary.patientSummary,
        doctorSummary: summary.doctorSummary,
        keyPoints: summary.keyPoints,
        recommendations: summary.recommendations,
        followUpRequired: summary.followUpRequired,
        generatedAt: finalSummaryRecord.generatedAt
      };

    } catch (error) {
      logger.error('Error generating final summary:', error);
      throw error;
    }
  }

  /**
   * Get consultation summary for user
   */
  async getConsultationSummary(consultationId: string, userId: string): Promise<any> {
    try {
      const consultation = await this.db.consultation.findFirst({
        where: {
          id: consultationId,
          OR: [
            { patientId: userId },
            { doctorId: userId }
          ]
        }
      });

      if (!consultation) {
        throw new Error('Consultation not found or access denied');
      }

      const summary = await this.db.consultationSummary.findUnique({
        where: { consultationId }
      });

      if (!summary) {
        return null;
      }

      // Return appropriate summary based on user role
      const isPatient = consultation.patientId === userId;
      
      return {
        summary: isPatient ? summary.patientSummary : summary.doctorSummary,
        keyPoints: summary.keyPoints,
        recommendations: summary.recommendations,
        followUpRequired: summary.followUpRequired,
        generatedAt: summary.generatedAt,
        isComplete: summary.isComplete
      };

    } catch (error) {
      logger.error('Error fetching consultation summary:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  private async markMessagesAsRead(consultationId: string, userId: string): Promise<void> {
    try {
      await this.db.consultationMessage.updateMany({
        where: {
          consultationId,
          senderId: { not: userId },
          isRead: false
        },
        data: { isRead: true }
      });
    } catch (error) {
      logger.error('Error marking messages as read:', error);
    }
  }

  /**
   * Get active consultations for user
   */
  async getActiveConsultations(userId: string): Promise<any[]> {
    try {
      return await this.db.consultation.findMany({
        where: {
          OR: [
            { patientId: userId },
            { doctorId: userId }
          ],
          status: 'ACTIVE'
        },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } },
          appointment: true,
          _count: {
            select: {
              messages: {
                where: {
                  senderId: { not: userId },
                  isRead: false
                }
              }
            }
          }
        },
        orderBy: { startedAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching active consultations:', error);
      throw error;
    }
  }
}
