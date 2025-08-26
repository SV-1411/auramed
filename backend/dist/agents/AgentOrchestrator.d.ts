import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import { PatientAIAgent } from './PatientAIAgent';
import { DoctorAIAgent } from './DoctorAIAgent';
import { AdminAIAgent } from './AdminAIAgent';
export declare class AgentOrchestrator {
    private patientAgent;
    private doctorAgent;
    private adminAgent;
    private io;
    private redis;
    constructor(patientAgent: PatientAIAgent, doctorAgent: DoctorAIAgent, adminAgent: AdminAIAgent, io: Server);
    initialize(): Promise<void>;
    handleMessage(socket: Socket, data: any): Promise<void>;
    private routeMessage;
    private handleInterAgentCommunication;
    private notifyDoctorAgent;
    private notifyAdminAgent;
    private broadcastSystemAlert;
    private handleEmergencyEscalation;
    private setupAgentCommunication;
    private handleAgentMessage;
    private startBackgroundTasks;
    private generateMessageId;
}
//# sourceMappingURL=AgentOrchestrator.d.ts.map