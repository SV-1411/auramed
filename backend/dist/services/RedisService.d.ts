import { AIAgentMessage } from '../../../shared/types';
export declare class RedisService {
    private client;
    private subscriber;
    private publisher;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    addToProcessingQueue(message: AIAgentMessage): Promise<void>;
    getFromProcessingQueue(agentType: string): Promise<AIAgentMessage | null>;
    setUserSession(userId: string, sessionData: any, ttlSeconds?: number): Promise<void>;
    getUserSession(userId: string): Promise<any | null>;
    deleteUserSession(userId: string): Promise<void>;
    publishAgentMessage(channel: string, message: AIAgentMessage): Promise<void>;
    subscribe(channel: string, callback: (message: string) => void): Promise<void>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    get(key: string): Promise<any | null>;
    del(key: string): Promise<void>;
    setDoctorAvailability(doctorId: string, availability: any): Promise<void>;
    getDoctorAvailability(doctorId: string): Promise<any | null>;
    storeSystemAlert(alert: AIAgentMessage): Promise<void>;
    getActiveAlerts(): Promise<AIAgentMessage[]>;
    checkRateLimit(userId: string, action: string, limit: number, windowSeconds: number): Promise<boolean>;
    cachePatientSymptoms(patientId: string, symptoms: string[], analysis: any): Promise<void>;
    getPatientSymptomsCache(patientId: string): Promise<any | null>;
    cacheDoctorMetrics(doctorId: string, metrics: any): Promise<void>;
    getDoctorMetricsCache(doctorId: string): Promise<any | null>;
    addToEmergencyQueue(patientId: string, urgencyLevel: string): Promise<void>;
    getNextEmergencyPatient(): Promise<string | null>;
    getEmergencyQueueSize(): Promise<number>;
    scheduleReminder(appointmentId: string, patientId: string, reminderTime: Date): Promise<void>;
    flagSuspiciousActivity(userId: string, activityType: string, details: any): Promise<void>;
    getSuspiciousActivities(userId: string): Promise<any[]>;
    private setupErrorHandlers;
    private getUrgencyScore;
}
//# sourceMappingURL=RedisService.d.ts.map