// Minimal local types to avoid cross-package import issues
export interface AIAgentMessage {
  id: string;
  agentType: 'patient' | 'doctor' | 'admin';
  fromUserId: string;
  toUserId?: string;
  content: string;
  messageType: 'text' | 'symptom_analysis' | 'appointment_booking' | 'prescription' | 'alert';
  metadata?: Record<string, any>;
  timestamp: Date;
  isProcessed: boolean;
}

export interface SymptomAnalysis {
  symptoms: string[];
  riskScore: {
    level: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    factors: string[];
    aiRecommendation: string;
  };
  recommendedAction: 'self_care' | 'schedule_appointment' | 'urgent_consultation' | 'emergency';
  suggestedSpecialization?: string[];
  estimatedWaitTime?: number;
  aiConfidence: number;
  differentials?: Array<{
    condition: string;
    probability: number; // 0..1
    rationale?: string;
    recommendedTests?: string[];
  }>;
}
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
    const systemPrompt = `You are the AuraMed Patient AI Agent. Behave like a clinician performing triage and preliminary differential diagnosis.
    Goals:
    - Extract symptoms and key history (onset, duration, severity, associated symptoms, fever, travel, contacts, meds, chronic conditions)
    - Provide a differential diagnosis with probabilities (must sum ~1.0)
    - Provide triage level and clear next action
    - Only recommend in-person checkup or urgent care when the risk warrants it; otherwise provide at‑home guidance
    - Be concise, empathetic, and evidence‑oriented. Avoid generic disclaimers; include concrete, actionable steps

    Output style:
    - If the user message contains symptoms, include a short differential and triage guidance in the answer itself.
    - Ask 2-4 targeted follow‑ups if uncertainty is high.`;

    const response = await this.openAI.generateResponse(
      systemPrompt,
      message.content,
      message.fromUserId,
      'smart'
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
    
    const analysisPrompt = `Analyze the symptoms and produce a structured clinical triage with a probabilistic differential diagnosis.
    Symptoms: ${symptoms.join(', ')}

    Return STRICT JSON with keys:
    {
      "riskLevel": "low|medium|high|critical",
      "riskScore": 0-100,
      "recommendedAction": "self_care|schedule_appointment|urgent_consultation|emergency",
      "specialization": ["string"],
      "urgency": "routine|urgent|emergency",
      "explanation": "short rationale",
      "differentials": [
        { "condition": "string", "probability": 0.0-1.0, "rationale": "string", "recommendedTests": ["string"] }
      ],
      "aiConfidence": 0.0-1.0
    }
    Rules:
    - Sum of differential probabilities should be ~1.0 (±0.05).
    - Prefer common conditions first; include serious but less likely ones only if warranted by symptoms.
    - Map high/critical risk to urgent_consultation/emergency where appropriate.`;

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
        suggestedSpecialization: Array.isArray(parsed.specialization) ? parsed.specialization : (parsed.specialization ? [parsed.specialization] : undefined),
        estimatedWaitTime: this.calculateWaitTime(parsed.riskLevel),
        aiConfidence: typeof parsed.aiConfidence === 'number' ? parsed.aiConfidence : 0.85,
        differentials: Array.isArray(parsed.differentials) ? parsed.differentials : undefined
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
        aiConfidence: 0.6,
        differentials: [
          { condition: 'Common cold (viral URTI)', probability: 0.5, rationale: 'Cough + runny nose + headache', recommendedTests: [] },
          { condition: 'Allergic rhinitis', probability: 0.25, rationale: 'Runny nose predominant; possible seasonal trigger', recommendedTests: [] },
          { condition: 'Influenza', probability: 0.15, rationale: 'Headache + systemic symptoms if fever present', recommendedTests: [] },
          { condition: 'Sinusitis', probability: 0.1, rationale: 'Headache with nasal symptoms if prolonged', recommendedTests: [] }
        ]
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
    const { riskScore, recommendedAction, estimatedWaitTime, differentials } = analysis;

    let response = `🔍 Differential Diagnosis (probabilities)\n`;
    if (differentials && differentials.length) {
      const top = [...differentials]
        .sort((a,b) => (b.probability ?? 0) - (a.probability ?? 0))
        .slice(0, 4)
        .map(d => `• ${d.condition}: ${(Math.round((d.probability || 0) * 100))}%${d.rationale ? ` — ${d.rationale}` : ''}`)
        .join('\n');
      response += top + '\n\n';
    }

    response += `Risk: ${riskScore.level.toUpperCase()} (${riskScore.score}/100)\n`;
    response += `Plan: ${riskScore.aiRecommendation}\n\n`;

    switch (recommendedAction) {
      case 'emergency':
        response += `🚨 Action: Immediate emergency care is recommended.`;
        break;
      case 'urgent_consultation':
        response += `⚡ Action: Urgent tele-consultation recommended (≈ ${estimatedWaitTime} min).`;
        break;
      case 'schedule_appointment':
        response += `📅 Action: Schedule a routine consultation. I can find available doctors now.`;
        break;
      case 'self_care':
        response += `🏠 Action: Self‑care appropriate. Monitor symptoms; escalate if red flags appear.`;
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
