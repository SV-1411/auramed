import { AIAgentMessage, SymptomAnalysis, RiskScore, Appointment } from '../../../shared/types';
import { logger } from '../utils/logger';
import { OpenAIService } from '../services/OpenAIService';
import { AppointmentService } from '../services/AppointmentService';
import { PaymentService } from '../services/PaymentService';
import { NotificationService } from '../services/NotificationService';

export class PatientAIAgent {
  private openAI: OpenAIService;
  private appointmentService: AppointmentService;
  private paymentService: PaymentService;
  private notificationService: NotificationService;

  constructor() {
    this.openAI = new OpenAIService();
    this.appointmentService = new AppointmentService();
    this.paymentService = new PaymentService();
    this.notificationService = new NotificationService();
  }

  async processMessage(message: AIAgentMessage): Promise<AIAgentMessage> {
    try {
      logger.info(`Patient AI Agent processing message: ${message.id}`);

      switch (message.messageType) {
        case 'text':
          return await this.handleGeneralQuery(message);
        case 'symptom_analysis':
          return await this.analyzeSymptoms(message);
        case 'appointment_booking':
          return await this.bookAppointment(message);
        default:
          return await this.handleGeneralQuery(message);
      }
    } catch (error) {
      logger.error('Patient AI Agent error:', error);
      return this.createErrorResponse(message, 'I apologize, but I encountered an error. Please try again or contact support.');
    }
  }

  private async handleGeneralQuery(message: AIAgentMessage): Promise<AIAgentMessage> {
    const systemPrompt = `You are a Patient AI Agent for AuraMed healthcare platform. Your role is to:
    1. Collect patient symptoms and health information
    2. Provide initial health guidance and triage
    3. Book appointments with appropriate doctors
    4. Handle payment processing
    5. Send medication and appointment reminders
    6. Maintain empathetic, professional communication
    
    Always prioritize patient safety. For emergency symptoms, immediately recommend urgent consultation.
    Keep responses concise but caring. Ask follow-up questions to gather complete symptom information.`;

    const response = await this.openAI.generateResponse(
      systemPrompt,
      message.content,
      message.fromUserId
    );

    return {
      id: this.generateId(),
      agentType: 'patient',
      fromUserId: 'patient-ai-agent',
      toUserId: message.fromUserId,
      content: response,
      messageType: 'text',
      timestamp: new Date(),
      isProcessed: false
    };
  }

  private async analyzeSymptoms(message: AIAgentMessage): Promise<AIAgentMessage> {
    const symptoms = message.metadata?.symptoms || [];
    
    const analysisPrompt = `Analyze these symptoms and provide a risk assessment:
    Symptoms: ${symptoms.join(', ')}
    
    Provide:
    1. Risk level (low/medium/high/critical)
    2. Risk score (0-100)
    3. Recommended action
    4. Suggested medical specialization if needed
    5. Urgency level
    
    Format as JSON with fields: riskLevel, riskScore, recommendedAction, specialization, urgency, explanation`;

    const analysisResult = await this.openAI.generateResponse(
      'You are a medical triage AI. Analyze symptoms and provide structured risk assessment.',
      analysisPrompt,
      message.fromUserId
    );

    let analysis: SymptomAnalysis;
    try {
      const parsed = JSON.parse(analysisResult);
      analysis = {
        symptoms,
        riskScore: {
          level: parsed.riskLevel,
          score: parsed.riskScore,
          factors: symptoms,
          aiRecommendation: parsed.explanation
        },
        recommendedAction: parsed.recommendedAction,
        suggestedSpecialization: parsed.specialization ? [parsed.specialization] : undefined,
        estimatedWaitTime: this.calculateWaitTime(parsed.riskLevel),
        aiConfidence: 0.85
      };
    } catch (error) {
      // Fallback analysis
      analysis = {
        symptoms,
        riskScore: {
          level: 'medium',
          score: 50,
          factors: symptoms,
          aiRecommendation: 'Please consult with a healthcare provider for proper evaluation.'
        },
        recommendedAction: 'schedule_appointment',
        aiConfidence: 0.6
      };
    }

    // Auto-book urgent appointments
    if (analysis.riskScore.level === 'high' || analysis.riskScore.level === 'critical') {
      await this.autoBookUrgentAppointment(message.fromUserId, analysis);
    }

    return {
      id: this.generateId(),
      agentType: 'patient',
      fromUserId: 'patient-ai-agent',
      toUserId: message.fromUserId,
      content: this.formatSymptomAnalysisResponse(analysis),
      messageType: 'symptom_analysis',
      metadata: { analysis },
      timestamp: new Date(),
      isProcessed: false
    };
  }

  private async bookAppointment(message: AIAgentMessage): Promise<AIAgentMessage> {
    const { doctorId, preferredTime, symptoms, riskScore } = message.metadata || {};

    try {
      const appointment = await this.appointmentService.createAppointment({
        patientId: message.fromUserId,
        doctorId,
        scheduledAt: new Date(preferredTime),
        duration: 30,
        type: riskScore?.level === 'critical' ? 'emergency' : 'video',
        symptoms: symptoms || [],
        riskScore: riskScore || { level: 'low', score: 20, factors: [], aiRecommendation: '' },
        paymentStatus: 'pending',
        paymentAmount: 500 // Default consultation fee
      });

      // Process payment
      const paymentResult = await this.paymentService.processPayment({
        appointmentId: appointment.id,
        patientId: message.fromUserId,
        amount: appointment.paymentAmount,
        currency: 'INR',
        method: 'card'
      });

      // Send confirmation
      await this.notificationService.sendAppointmentConfirmation(
        message.fromUserId,
        appointment
      );

      return {
        id: this.generateId(),
        agentType: 'patient',
        fromUserId: 'patient-ai-agent',
        toUserId: message.fromUserId,
        content: `✅ Appointment booked successfully!\n\nAppointment ID: ${appointment.id}\nScheduled: ${appointment.scheduledAt.toLocaleString()}\nDoctor: Dr. ${doctorId}\nPayment Status: ${paymentResult.status}\n\nYou'll receive a reminder 30 minutes before your appointment.`,
        messageType: 'appointment_booking',
        metadata: { appointment, payment: paymentResult },
        timestamp: new Date(),
        isProcessed: false
      };
    } catch (error) {
      logger.error('Appointment booking error:', error);
      return this.createErrorResponse(message, 'Unable to book appointment. Please try again or contact support.');
    }
  }

  private async autoBookUrgentAppointment(patientId: string, analysis: SymptomAnalysis): Promise<void> {
    try {
      // Find available doctor for urgent consultation
      const availableDoctor = await this.appointmentService.findAvailableUrgentDoctor(
        analysis.suggestedSpecialization
      );

      if (availableDoctor) {
        const urgentAppointment = await this.appointmentService.createAppointment({
          patientId,
          doctorId: availableDoctor.id,
          scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
          duration: 30,
          type: 'emergency',
          symptoms: analysis.symptoms,
          riskScore: analysis.riskScore,
          paymentStatus: 'deferred', // Allow deferred payment for emergencies
          paymentAmount: 1000
        });

        // Notify patient and doctor immediately
        await this.notificationService.sendUrgentAppointmentAlert(patientId, urgentAppointment);
        await this.notificationService.notifyDoctorUrgentConsultation(availableDoctor.id, urgentAppointment);
      }
    } catch (error) {
      logger.error('Auto-booking urgent appointment failed:', error);
    }
  }

  private calculateWaitTime(riskLevel: string): number {
    switch (riskLevel) {
      case 'critical': return 5; // 5 minutes
      case 'high': return 30; // 30 minutes
      case 'medium': return 120; // 2 hours
      case 'low': return 1440; // 24 hours
      default: return 120;
    }
  }

  private formatSymptomAnalysisResponse(analysis: SymptomAnalysis): string {
    const { riskScore, recommendedAction, estimatedWaitTime } = analysis;
    
    let response = `🔍 **Symptom Analysis Complete**\n\n`;
    response += `**Risk Level:** ${riskScore.level.toUpperCase()}\n`;
    response += `**Risk Score:** ${riskScore.score}/100\n\n`;
    response += `**Recommendation:** ${riskScore.aiRecommendation}\n\n`;
    
    switch (recommendedAction) {
      case 'emergency':
        response += `🚨 **URGENT:** Please seek immediate emergency care or call emergency services.`;
        break;
      case 'urgent_consultation':
        response += `⚡ **High Priority:** I'm booking you an urgent consultation. Expected wait time: ${estimatedWaitTime} minutes.`;
        break;
      case 'schedule_appointment':
        response += `📅 **Schedule Appointment:** I recommend booking a consultation. Would you like me to find available doctors?`;
        break;
      case 'self_care':
        response += `🏠 **Self Care:** Your symptoms appear manageable with self-care. Monitor your condition and seek care if symptoms worsen.`;
        break;
    }
    
    return response;
  }

  private createErrorResponse(originalMessage: AIAgentMessage, errorText: string): AIAgentMessage {
    return {
      id: this.generateId(),
      agentType: 'patient',
      fromUserId: 'patient-ai-agent',
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
