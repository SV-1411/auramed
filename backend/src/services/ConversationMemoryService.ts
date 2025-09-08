import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { OpenAIService } from './OpenAIService';
import { getDatabase } from '../config/database';

export interface PatientContext {
  profile?: {
    firstName?: string;
    lastName?: string;
    age?: number;
    gender?: string;
    allergies?: string[];
    medications?: string[];
    chronicConditions?: string[];
    medicalHistory?: string[];
  };
  recentSymptoms?: string[];
  riskFactors?: string[];
}

export interface ConversationContext {
  recentMessages: Array<{
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
    metadata?: any;
  }>;
  longTermSummary?: string;
  keyFacts: string[];
  patientContext: PatientContext;
}

export class ConversationMemoryService {
  private db = new PrismaClient();
  private openAI: OpenAIService;

  constructor() {
    this.openAI = new OpenAIService();
  }

  async saveUserMessage(
    userId: string,
    content: string,
    messageType: string = 'text',
    metadata?: any
  ): Promise<void> {
    try {
      if ((this.db as any).aIMessage?.create) {
        await (this.db as any).aIMessage.create({
          data: { userId, role: 'USER', content, messageType, metadata: metadata || {} }
        });
      } else {
        // Fallback to existing aIAgentMessage model so chats are persisted
        const db = getDatabase();
        await (db as any).aIAgentMessage.create({
          data: {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            agentType: 'PATIENT',
            fromUserId: userId,
            toUserId: null,
            content,
            messageType: messageType.toUpperCase(),
            metadata: metadata || {},
            isProcessed: false
          }
        });
      }
    } catch (error) {
      logger.error('Failed to save user message:', error);
    }
  }

  async saveAgentMessage(
    userId: string,
    content: string,
    messageType: string = 'text',
    metadata?: any
  ): Promise<void> {
    try {
      if ((this.db as any).aIMessage?.create) {
        await (this.db as any).aIMessage.create({
          data: { userId, role: 'AI', content, messageType, metadata: metadata || {} }
        });
      } else {
        // Fallback to aIAgentMessage
        const db = getDatabase();
        await (db as any).aIAgentMessage.create({
          data: {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            agentType: 'PATIENT',
            fromUserId: 'patient-ai-agent',
            toUserId: userId,
            content,
            messageType: messageType.toUpperCase(),
            metadata: metadata || {},
            isProcessed: true
          }
        });
      }
    } catch (error) {
      logger.error('Failed to save agent message:', error);
    }
  }

  async getRecentMessages(userId: string, limit: number = 10): Promise<Array<{
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
    metadata?: any;
  }>> {
    try {
      if ((this.db as any).aIMessage?.findMany) {
        const messages = await (this.db as any).aIMessage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit
        }) as Array<{ role: string; content: string; createdAt: Date; metadata?: any }>;

        return messages.reverse().map((msg: { role: string; content: string; createdAt: Date; metadata?: any }) => ({
          role: msg.role === 'USER' ? 'user' : 'ai',
          content: msg.content,
          timestamp: msg.createdAt,
          metadata: msg.metadata
        }));
      }

      // Fallback: read from aIAgentMessage so chat context works even without AIMessage model
      const db = getDatabase();
      const agentMessages = await (db as any).aIAgentMessage.findMany({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      }) as Array<{ fromUserId: string; toUserId?: string | null; content: string; createdAt: Date; metadata?: any }>;

      return agentMessages.reverse().map((msg) => ({
        role: msg.fromUserId === userId ? 'user' : 'ai',
        content: msg.content,
        timestamp: msg.createdAt,
        metadata: msg.metadata
      }));
    } catch (error) {
      logger.error('Failed to get recent messages:', error);
      return [];
    }
  }

  async getOrCreateLongTermSummary(userId: string): Promise<{
    summary: string;
    keyFacts: string[];
  }> {
    try {
      let summaryRecord: any = null;
      if ((this.db as any).aIConversationSummary?.findUnique) {
        summaryRecord = await (this.db as any).aIConversationSummary.findUnique({ where: { userId } });
        if (!summaryRecord) {
          summaryRecord = await (this.db as any).aIConversationSummary.create({
            data: { userId, summary: '', keyFacts: [] }
          });
        }
      }

      return {
        summary: summaryRecord?.summary || '',
        keyFacts: summaryRecord?.keyFacts || []
      };
    } catch (error) {
      logger.error('Failed to get long term summary:', error);
      return { summary: '', keyFacts: [] };
    }
  }

  async updateLongTermSummary(
    userId: string,
    newMessages: Array<{ role: 'user' | 'ai'; content: string; timestamp: Date }>
  ): Promise<void> {
    try {
      const currentSummary = await this.getOrCreateLongTermSummary(userId);
      
      // Generate updated summary using AI
      const conversationText = newMessages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');

      const summaryPrompt = `Update the patient conversation summary with new information.

Current Summary: ${currentSummary.summary}
Current Key Facts: ${currentSummary.keyFacts.join(', ')}

New Conversation:
${conversationText}

Provide updated JSON:
{
  "summary": "concise clinical summary focusing on symptoms, conditions, treatments discussed",
  "keyFacts": ["fact1", "fact2", "fact3"]
}

Focus on medical relevance: symptoms, diagnoses, medications, allergies, chronic conditions, family history.`;

      const response = await this.openAI.generateResponse(
        'You are a medical AI assistant creating patient conversation summaries.',
        summaryPrompt,
        userId,
        'smart'
      );

      try {
        const parsed = JSON.parse(response);
        if ((this.db as any).aIConversationSummary?.update) {
          await (this.db as any).aIConversationSummary.update({
            where: { userId },
            data: {
              summary: parsed.summary || currentSummary.summary,
              keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : currentSummary.keyFacts
            }
          });
        }
      } catch (parseError) {
        logger.warn('Failed to parse summary update, keeping current:', parseError);
      }
    } catch (error) {
      logger.error('Failed to update long term summary:', error);
    }
  }

  async getPatientContext(userId: string): Promise<PatientContext> {
    try {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        include: {
          patientProfile: true
        }
      });

      if (!user) return { patientContext: {} } as PatientContext;

      const profile = user.patientProfile;

      return {
        profile: profile ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          age: profile.dateOfBirth ? 
            Math.floor((Date.now() - profile.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
            undefined,
          gender: profile.gender,
          allergies: [],
          medications: [],
          chronicConditions: [],
          medicalHistory: []
        } : undefined,
        recentSymptoms: [],
        riskFactors: []
      };
    } catch (error) {
      logger.error('Failed to get patient context:', error);
      return { patientContext: {} } as PatientContext;
    }
  }

  async getFullConversationContext(userId: string): Promise<ConversationContext> {
    const [recentMessages, longTermSummary, patientContext] = await Promise.all([
      this.getRecentMessages(userId, 10),
      this.getOrCreateLongTermSummary(userId),
      this.getPatientContext(userId)
    ]);

    return {
      recentMessages,
      longTermSummary: longTermSummary.summary,
      keyFacts: longTermSummary.keyFacts,
      patientContext
    };
  }
}
