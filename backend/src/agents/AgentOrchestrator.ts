import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import { PatientAIAgent } from './PatientAIAgent';
import { DoctorAIAgent } from './DoctorAIAgent';
import { AdminAIAgent } from './AdminAIAgent';
import { logger } from '../utils/logger';
import { RedisService } from '../services/RedisService';
import { ConversationMemoryService } from '../services/ConversationMemoryService';
import { RAGService } from '../services/RAGService';

// Local message type to standardize across agents
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

export class AgentOrchestrator {
  private patientAgent: PatientAIAgent;
  private doctorAgent: DoctorAIAgent;
  private adminAgent: AdminAIAgent;
  private io: Server;
  private redis: RedisService;
  private memoryService: ConversationMemoryService;
  private ragService: RAGService;

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
    this.memoryService = new ConversationMemoryService();
    this.ragService = new RAGService();

    // Only create RedisService if Redis is available
    const redisUrl = process.env.REDIS_URL;
    const redisDisabled = process.env.DISABLE_REDIS === 'true';

    if (redisUrl && !redisDisabled && redisUrl.startsWith('redis://')) {
      try {
        this.redis = new RedisService();
        logger.info('Redis service created for agent orchestrator');
      } catch (error) {
        logger.warn('Failed to create Redis service:', (error as Error).message);
        this.redis = null as any;
      }
    } else {
      logger.info('Redis disabled - agent orchestrator will run without Redis');
      this.redis = null as any;
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Setting up inter-agent communication channels...');
      // Set up inter-agent communication channels
      await this.setupAgentCommunication();

      logger.info('Initializing RAG knowledge base...');
      // Initialize medical knowledge base
      await this.ragService.ensureBaseMedicalKBIndexed();

      logger.info('Starting background monitoring tasks...');
      // Start background monitoring tasks
      this.startBackgroundTasks();

      logger.info('Agent Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Agent Orchestrator:', error);
      logger.error('Agent Orchestrator error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
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

      // Save user message to conversation memory
      await this.memoryService.saveUserMessage(
        message.fromUserId,
        message.content,
        message.messageType,
        message.metadata
      );

      // Store message in Redis for processing queue (skip if Redis not available)
      try {
        await this.redis.addToProcessingQueue(message);
      } catch (error) {
        logger.warn('Failed to store message in Redis queue:', (error as Error).message);
        // Continue without Redis queue
      }

      // Route message to appropriate agent
      const response = await this.routeMessage(message);

      // Save agent response to conversation memory
      await this.memoryService.saveAgentMessage(
        message.fromUserId,
        response.content,
        response.messageType,
        response.metadata
      );

      // Update long-term summary with recent conversation
      const recentMessages = await this.memoryService.getRecentMessages(message.fromUserId, 4);
      if (recentMessages.length >= 2) {
        await this.memoryService.updateLongTermSummary(message.fromUserId, recentMessages);
      }

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
    
    // Store in Redis for persistence (skip if Redis not available)
    try {
      await this.redis.storeSystemAlert(alertMessage);
    } catch (error) {
      logger.warn('Failed to store system alert in Redis:', (error as Error).message);
      // Continue without Redis persistence
    }
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
    try {
      // Set up Redis pub/sub for agent communication (skip if Redis not available)
      await this.redis.subscribe('agent-communication', (message) => {
        this.handleAgentMessage(JSON.parse(message));
      });
    } catch (error) {
      logger.warn('Redis pub/sub setup failed - running without Redis:', (error as Error).message);
      // Continue without Redis pub/sub
    }

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
        if (userType === 'ambulance') {
          socket.join('ambulance-room');
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
