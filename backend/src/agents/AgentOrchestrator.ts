import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import { AIAgentMessage } from '../../../shared/types';
import { PatientAIAgent } from './PatientAIAgent';
import { DoctorAIAgent } from './DoctorAIAgent';
import { AdminAIAgent } from './AdminAIAgent';
import { logger } from '../utils/logger';
import { RedisService } from '../services/RedisService';

export class AgentOrchestrator {
  private patientAgent: PatientAIAgent;
  private doctorAgent: DoctorAIAgent;
  private adminAgent: AdminAIAgent;
  private io: Server;
  private redis: RedisService;

  constructor(
    patientAgent: PatientAIAgent,
    doctorAgent: DoctorAIAgent,
    adminAgent: AdminAIAgent,
    io: Server
  ) {
    this.patientAgent = patientAgent;
    this.doctorAgent = doctorAgent;
    this.adminAgent = adminAgent;
    this.io = io;
    this.redis = new RedisService();
  }

  async initialize(): Promise<void> {
    try {
      // Set up inter-agent communication channels
      await this.setupAgentCommunication();
      
      // Start background monitoring tasks
      this.startBackgroundTasks();
      
      logger.info('Agent Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Agent Orchestrator:', error);
      throw error;
    }
  }

  async handleMessage(socket: Socket, data: any): Promise<void> {
    try {
      const message: AIAgentMessage = {
        id: this.generateMessageId(),
        agentType: data.agentType || 'patient',
        fromUserId: data.userId,
        toUserId: data.toUserId,
        content: data.content,
        messageType: data.messageType || 'text',
        metadata: data.metadata,
        timestamp: new Date(),
        isProcessed: false
      };

      // Store message in Redis for processing queue
      await this.redis.addToProcessingQueue(message);

      // Route message to appropriate agent
      const response = await this.routeMessage(message);

      // Send response back to client
      socket.emit('ai-response', response);

      // Check for inter-agent communication needs
      await this.handleInterAgentCommunication(message, response);

    } catch (error) {
      logger.error('Error handling message:', error);
      socket.emit('ai-error', { 
        error: 'Failed to process message', 
        messageId: data.messageId 
      });
    }
  }

  private async routeMessage(message: AIAgentMessage): Promise<AIAgentMessage> {
    switch (message.agentType) {
      case 'patient':
        return await this.patientAgent.processMessage(message);
      case 'doctor':
        return await this.doctorAgent.processMessage(message);
      case 'admin':
        return await this.adminAgent.processMessage(message);
      default:
        throw new Error(`Unknown agent type: ${message.agentType}`);
    }
  }

  private async handleInterAgentCommunication(
    originalMessage: AIAgentMessage, 
    response: AIAgentMessage
  ): Promise<void> {
    try {
      // Patient → Doctor communication
      if (originalMessage.agentType === 'patient' && 
          (originalMessage.messageType === 'symptom_analysis' || 
           originalMessage.messageType === 'appointment_booking')) {
        
        await this.notifyDoctorAgent(originalMessage, response);
      }

      // Doctor → Admin communication for quality metrics
      if (originalMessage.agentType === 'doctor' && 
          originalMessage.messageType === 'prescription') {
        
        await this.notifyAdminAgent(originalMessage, response);
      }

      // Admin → All agents for system alerts
      if (originalMessage.agentType === 'admin' && 
          originalMessage.messageType === 'alert') {
        
        await this.broadcastSystemAlert(response);
      }

      // Emergency escalation
      if (response.metadata?.analysis?.riskScore?.level === 'critical') {
        await this.handleEmergencyEscalation(originalMessage, response);
      }

    } catch (error) {
      logger.error('Error in inter-agent communication:', error);
    }
  }

  private async notifyDoctorAgent(
    patientMessage: AIAgentMessage, 
    patientResponse: AIAgentMessage
  ): Promise<void> {
    if (patientResponse.metadata?.appointment) {
      const doctorNotification: AIAgentMessage = {
        id: this.generateMessageId(),
        agentType: 'doctor',
        fromUserId: 'patient-ai-agent',
        toUserId: patientResponse.metadata.appointment.doctorId,
        content: `New appointment scheduled: ${patientResponse.metadata.appointment.id}`,
        messageType: 'alert',
        metadata: {
          appointmentId: patientResponse.metadata.appointment.id,
          patientId: patientMessage.fromUserId,
          symptoms: patientMessage.metadata?.symptoms,
          riskScore: patientResponse.metadata?.analysis?.riskScore
        },
        timestamp: new Date(),
        isProcessed: false
      };

      // Send to doctor via WebSocket
      this.io.to(`doctor-${patientResponse.metadata.appointment.doctorId}`)
           .emit('agent-notification', doctorNotification);
    }
  }

  private async notifyAdminAgent(
    doctorMessage: AIAgentMessage, 
    doctorResponse: AIAgentMessage
  ): Promise<void> {
    const adminNotification: AIAgentMessage = {
      id: this.generateMessageId(),
      agentType: 'admin',
      fromUserId: 'doctor-ai-agent',
      toUserId: 'admin-system',
      content: 'Prescription generated - update quality metrics',
      messageType: 'alert',
      metadata: {
        doctorId: doctorMessage.fromUserId,
        prescriptionCount: doctorResponse.metadata?.prescriptions?.length || 0,
        interactionWarnings: doctorResponse.metadata?.interactionWarnings?.length || 0
      },
      timestamp: new Date(),
      isProcessed: false
    };

    // Process admin notification
    await this.adminAgent.processMessage(adminNotification);
  }

  private async broadcastSystemAlert(alertMessage: AIAgentMessage): Promise<void> {
    // Broadcast to all connected admin users
    this.io.to('admin-room').emit('system-alert', alertMessage);
    
    // Store in Redis for persistence
    await this.redis.storeSystemAlert(alertMessage);
  }

  private async handleEmergencyEscalation(
    originalMessage: AIAgentMessage, 
    response: AIAgentMessage
  ): Promise<void> {
    logger.warn(`Emergency escalation triggered for patient: ${originalMessage.fromUserId}`);

    // Notify all available emergency doctors
    const emergencyAlert: AIAgentMessage = {
      id: this.generateMessageId(),
      agentType: 'doctor',
      fromUserId: 'system-emergency',
      content: '🚨 EMERGENCY CONSULTATION REQUIRED',
      messageType: 'alert',
      metadata: {
        patientId: originalMessage.fromUserId,
        riskScore: response.metadata?.analysis?.riskScore,
        symptoms: response.metadata?.analysis?.symptoms,
        urgency: 'critical'
      },
      timestamp: new Date(),
      isProcessed: false
    };

    // Broadcast to emergency doctors
    this.io.to('emergency-doctors').emit('emergency-alert', emergencyAlert);

    // Notify admin for monitoring
    await this.adminAgent.processMessage({
      ...emergencyAlert,
      agentType: 'admin',
      toUserId: 'admin-system',
      content: 'Emergency escalation triggered - monitor response'
    });
  }

  private async setupAgentCommunication(): Promise<void> {
    // Set up Redis pub/sub for agent communication
    await this.redis.subscribe('agent-communication', (message) => {
      this.handleAgentMessage(JSON.parse(message));
    });

    // Set up WebSocket rooms for different user types
    this.io.on('connection', (socket) => {
      socket.on('join-agent-room', (data) => {
        const { userType, userId } = data;
        socket.join(`${userType}-${userId}`);
        
        if (userType === 'admin') {
          socket.join('admin-room');
        }
        if (userType === 'doctor') {
          socket.join('emergency-doctors');
        }
      });
    });
  }

  private async handleAgentMessage(message: any): Promise<void> {
    try {
      // Process inter-agent messages from Redis pub/sub
      const response = await this.routeMessage(message);
      
      // Send response to appropriate WebSocket room
      if (message.toUserId) {
        this.io.to(`${message.agentType}-${message.toUserId}`)
               .emit('agent-message', response);
      }
    } catch (error) {
      logger.error('Error handling agent message:', error);
    }
  }

  private startBackgroundTasks(): void {
    // Periodic fraud detection (every 5 minutes)
    setInterval(async () => {
      try {
        const alerts = await this.adminAgent.detectFraudulentActivity();
        for (const alert of alerts) {
          await this.broadcastSystemAlert({
            id: alert.id,
            agentType: 'admin',
            fromUserId: 'admin-ai-agent',
            content: `Fraud alert: ${alert.title}`,
            messageType: 'alert',
            metadata: alert,
            timestamp: new Date(),
            isProcessed: false
          });
        }
      } catch (error) {
        logger.error('Background fraud detection error:', error);
      }
    }, 5 * 60 * 1000);

    // Doctor quality ranking update (every hour)
    setInterval(async () => {
      try {
        await this.adminAgent.updateDoctorQualityRankings();
        logger.info('Doctor quality rankings updated');
      } catch (error) {
        logger.error('Background quality ranking update error:', error);
      }
    }, 60 * 60 * 1000);

    // Compliance monitoring (every 30 minutes)
    setInterval(async () => {
      try {
        const alerts = await this.adminAgent.monitorCompliance();
        for (const alert of alerts) {
          await this.broadcastSystemAlert({
            id: alert.id,
            agentType: 'admin',
            fromUserId: 'admin-ai-agent',
            content: `Compliance alert: ${alert.title}`,
            messageType: 'alert',
            metadata: alert,
            timestamp: new Date(),
            isProcessed: false
          });
        }
      } catch (error) {
        logger.error('Background compliance monitoring error:', error);
      }
    }, 30 * 60 * 1000);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
