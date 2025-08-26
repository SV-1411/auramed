"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const redis_1 = require("redis");
const logger_1 = require("../utils/logger");
class RedisService {
    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = (0, redis_1.createClient)({ url: redisUrl });
        this.subscriber = (0, redis_1.createClient)({ url: redisUrl });
        this.publisher = (0, redis_1.createClient)({ url: redisUrl });
        this.setupErrorHandlers();
    }
    async connect() {
        try {
            await Promise.all([
                this.client.connect(),
                this.subscriber.connect(),
                this.publisher.connect()
            ]);
            logger_1.logger.info('Redis connected successfully');
        }
        catch (error) {
            logger_1.logger.error('Redis connection failed:', error);
            throw error;
        }
    }
    async disconnect() {
        await Promise.all([
            this.client.disconnect(),
            this.subscriber.disconnect(),
            this.publisher.disconnect()
        ]);
    }
    // Message Queue Operations
    async addToProcessingQueue(message) {
        const queueKey = `queue:${message.agentType}`;
        await this.client.lPush(queueKey, JSON.stringify(message));
    }
    async getFromProcessingQueue(agentType) {
        const queueKey = `queue:${agentType}`;
        const messageStr = await this.client.rPop(queueKey);
        return messageStr ? JSON.parse(messageStr) : null;
    }
    // Session Management
    async setUserSession(userId, sessionData, ttlSeconds = 3600) {
        const key = `session:${userId}`;
        await this.client.setEx(key, ttlSeconds, JSON.stringify(sessionData));
    }
    async getUserSession(userId) {
        const key = `session:${userId}`;
        const sessionStr = await this.client.get(key);
        return sessionStr ? JSON.parse(sessionStr) : null;
    }
    async deleteUserSession(userId) {
        const key = `session:${userId}`;
        await this.client.del(key);
    }
    // Agent Communication
    async publishAgentMessage(channel, message) {
        await this.publisher.publish(channel, JSON.stringify(message));
    }
    async subscribe(channel, callback) {
        await this.subscriber.subscribe(channel, callback);
    }
    // Caching
    async set(key, value, ttlSeconds) {
        const valueStr = JSON.stringify(value);
        if (ttlSeconds) {
            await this.client.setEx(key, ttlSeconds, valueStr);
        }
        else {
            await this.client.set(key, valueStr);
        }
    }
    async get(key) {
        const valueStr = await this.client.get(key);
        return valueStr ? JSON.parse(valueStr) : null;
    }
    async del(key) {
        await this.client.del(key);
    }
    // Doctor Availability Cache
    async setDoctorAvailability(doctorId, availability) {
        const key = `availability:${doctorId}`;
        await this.set(key, availability, 3600); // 1 hour TTL
    }
    async getDoctorAvailability(doctorId) {
        const key = `availability:${doctorId}`;
        return await this.get(key);
    }
    // System Alerts
    async storeSystemAlert(alert) {
        const key = `alert:${alert.id}`;
        await this.set(key, alert, 86400); // 24 hours TTL
        // Add to alerts list
        await this.client.lPush('alerts:active', alert.id);
        await this.client.lTrim('alerts:active', 0, 99); // Keep last 100 alerts
    }
    async getActiveAlerts() {
        const alertIds = await this.client.lRange('alerts:active', 0, -1);
        const alerts = [];
        for (const alertId of alertIds) {
            const alert = await this.get(`alert:${alertId}`);
            if (alert)
                alerts.push(alert);
        }
        return alerts;
    }
    // Rate Limiting
    async checkRateLimit(userId, action, limit, windowSeconds) {
        const key = `ratelimit:${userId}:${action}`;
        const current = await this.client.incr(key);
        if (current === 1) {
            await this.client.expire(key, windowSeconds);
        }
        return current <= limit;
    }
    // Patient Symptom History Cache
    async cachePatientSymptoms(patientId, symptoms, analysis) {
        const key = `symptoms:${patientId}`;
        const data = {
            symptoms,
            analysis,
            timestamp: new Date().toISOString()
        };
        await this.set(key, data, 1800); // 30 minutes TTL
    }
    async getPatientSymptomsCache(patientId) {
        const key = `symptoms:${patientId}`;
        return await this.get(key);
    }
    // Doctor Performance Metrics Cache
    async cacheDoctorMetrics(doctorId, metrics) {
        const key = `metrics:${doctorId}`;
        await this.set(key, metrics, 3600); // 1 hour TTL
    }
    async getDoctorMetricsCache(doctorId) {
        const key = `metrics:${doctorId}`;
        return await this.get(key);
    }
    // Emergency Queue
    async addToEmergencyQueue(patientId, urgencyLevel) {
        const score = this.getUrgencyScore(urgencyLevel);
        await this.client.zAdd('emergency:queue', { score, value: patientId });
    }
    async getNextEmergencyPatient() {
        const result = await this.client.zPopMax('emergency:queue');
        return result?.value || null;
    }
    async getEmergencyQueueSize() {
        return await this.client.zCard('emergency:queue');
    }
    // Appointment Reminders
    async scheduleReminder(appointmentId, patientId, reminderTime) {
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
    async flagSuspiciousActivity(userId, activityType, details) {
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
    async getSuspiciousActivities(userId) {
        const pattern = `fraud:${userId}:*`;
        const keys = await this.client.keys(pattern);
        const activities = [];
        for (const key of keys) {
            const activity = await this.get(key);
            if (activity)
                activities.push(activity);
        }
        return activities;
    }
    setupErrorHandlers() {
        this.client.on('error', (error) => {
            logger_1.logger.error('Redis client error:', error);
        });
        this.subscriber.on('error', (error) => {
            logger_1.logger.error('Redis subscriber error:', error);
        });
        this.publisher.on('error', (error) => {
            logger_1.logger.error('Redis publisher error:', error);
        });
    }
    getUrgencyScore(urgencyLevel) {
        switch (urgencyLevel) {
            case 'critical': return 100;
            case 'high': return 75;
            case 'medium': return 50;
            case 'low': return 25;
            default: return 10;
        }
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=RedisService.js.map