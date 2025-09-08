import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

// Minimal local type to avoid cross-package import issues
export interface AIAgentMessage {
  id: string;
  agentType?: string;
  [key: string]: any;
}

export class RedisService {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private publisher: RedisClientType;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({ url: redisUrl });
    this.subscriber = createClient({ url: redisUrl });
    this.publisher = createClient({ url: redisUrl });

    this.setupErrorHandlers();
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.warn('Redis connection failed - running without Redis cache:', error);
      // Don't throw error to allow app to continue without Redis
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.client.disconnect(),
      this.subscriber.disconnect(),
      this.publisher.disconnect()
    ]);
  }

  // Message Queue Operations
  async addToProcessingQueue(message: AIAgentMessage): Promise<void> {
    const queueKey = `queue:${message.agentType}`;
    await this.client.lPush(queueKey, JSON.stringify(message));
  }

  async getFromProcessingQueue(agentType: string): Promise<AIAgentMessage | null> {
    const queueKey = `queue:${agentType}`;
    const messageStr = await this.client.rPop(queueKey);
    return messageStr ? JSON.parse(messageStr) : null;
  }

  // Session Management
  async setUserSession(userId: string, sessionData: any, ttlSeconds: number = 3600): Promise<void> {
    const key = `session:${userId}`;
    await this.client.setEx(key, ttlSeconds, JSON.stringify(sessionData));
  }

  async getUserSession(userId: string): Promise<any | null> {
    const key = `session:${userId}`;
    const sessionStr = await this.client.get(key);
    return sessionStr ? JSON.parse(sessionStr) : null;
  }

  async deleteUserSession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await this.client.del(key);
  }

  // Agent Communication
  async publishAgentMessage(channel: string, message: AIAgentMessage): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel, callback);
  }

  // Caching
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const valueStr = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, valueStr);
    } else {
      await this.client.set(key, valueStr);
    }
  }

  async get(key: string): Promise<any | null> {
    const valueStr = await this.client.get(key);
    return valueStr ? JSON.parse(valueStr) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Doctor Availability Cache
  async setDoctorAvailability(doctorId: string, availability: any): Promise<void> {
    const key = `availability:${doctorId}`;
    await this.set(key, availability, 3600); // 1 hour TTL
  }

  async getDoctorAvailability(doctorId: string): Promise<any | null> {
    const key = `availability:${doctorId}`;
    return await this.get(key);
  }

  // System Alerts
  async storeSystemAlert(alert: AIAgentMessage): Promise<void> {
    const key = `alert:${alert.id}`;
    await this.set(key, alert, 86400); // 24 hours TTL
    
    // Add to alerts list
    await this.client.lPush('alerts:active', alert.id);
    await this.client.lTrim('alerts:active', 0, 99); // Keep last 100 alerts
  }

  async getActiveAlerts(): Promise<AIAgentMessage[]> {
    const alertIds = await this.client.lRange('alerts:active', 0, -1);
    const alerts: AIAgentMessage[] = [];
    
    for (const alertId of alertIds) {
      const alert = await this.get(`alert:${alertId}`);
      if (alert) alerts.push(alert);
    }
    
    return alerts;
  }

  // Rate Limiting
  async checkRateLimit(userId: string, action: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = `ratelimit:${userId}:${action}`;
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    
    return current <= limit;
  }

  // Patient Symptom History Cache
  async cachePatientSymptoms(patientId: string, symptoms: string[], analysis: any): Promise<void> {
    const key = `symptoms:${patientId}`;
    const data = {
      symptoms,
      analysis,
      timestamp: new Date().toISOString()
    };
    await this.set(key, data, 1800); // 30 minutes TTL
  }

  async getPatientSymptomsCache(patientId: string): Promise<any | null> {
    const key = `symptoms:${patientId}`;
    return await this.get(key);
  }

  // Doctor Performance Metrics Cache
  async cacheDoctorMetrics(doctorId: string, metrics: any): Promise<void> {
    const key = `metrics:${doctorId}`;
    await this.set(key, metrics, 3600); // 1 hour TTL
  }

  async getDoctorMetricsCache(doctorId: string): Promise<any | null> {
    const key = `metrics:${doctorId}`;
    return await this.get(key);
  }

  // Emergency Queue
  async addToEmergencyQueue(patientId: string, urgencyLevel: string): Promise<void> {
    const score = this.getUrgencyScore(urgencyLevel);
    await this.client.zAdd('emergency:queue', { score, value: patientId });
  }

  async getNextEmergencyPatient(): Promise<string | null> {
    const result = await this.client.zPopMax('emergency:queue');
    return result?.value || null;
  }

  async getEmergencyQueueSize(): Promise<number> {
    return await this.client.zCard('emergency:queue');
  }

  // Appointment Reminders
  async scheduleReminder(appointmentId: string, patientId: string, reminderTime: Date): Promise<void> {
    const key = `reminder:${appointmentId}`;
    const data = {
      appointmentId,
      patientId,
      reminderTime: reminderTime.toISOString()
    };
    
    const ttl = Math.max(0, Math.floor((reminderTime.getTime() - Date.now()) / 1000));
    await this.set(key, data, ttl);
  }

  // Fraud Detection Cache
  async flagSuspiciousActivity(userId: string, activityType: string, details: any): Promise<void> {
    const key = `fraud:${userId}:${activityType}`;
    const data = {
      userId,
      activityType,
      details,
      timestamp: new Date().toISOString(),
      flagged: true
    };
    await this.set(key, data, 86400); // 24 hours TTL
  }

  async getSuspiciousActivities(userId: string): Promise<any[]> {
    const pattern = `fraud:${userId}:*`;
    const keys = await this.client.keys(pattern);
    const activities = [];
    
    for (const key of keys) {
      const activity = await this.get(key);
      if (activity) activities.push(activity);
    }
    
    return activities;
  }

  private setupErrorHandlers(): void {
    this.client.on('error', (error) => {
      logger.warn('Redis client error (continuing without Redis):', { code: error.code, service: 'auramed-backend', stack: error.stack, timestamp: new Date().toISOString() });
    });

    this.subscriber.on('error', (error) => {
      logger.warn('Redis subscriber error (continuing without Redis):', { code: error.code, service: 'auramed-backend', stack: error.stack, timestamp: new Date().toISOString() });
    });

    this.publisher.on('error', (error) => {
      logger.warn('Redis publisher error (continuing without Redis):', { code: error.code, service: 'auramed-backend', stack: error.stack, timestamp: new Date().toISOString() });
    });
  }

  private getUrgencyScore(urgencyLevel: string): number {
    switch (urgencyLevel) {
      case 'critical': return 100;
      case 'high': return 75;
      case 'medium': return 50;
      case 'low': return 25;
      default: return 10;
    }
  }
}
