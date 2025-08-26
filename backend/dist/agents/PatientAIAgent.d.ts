import { AIAgentMessage } from '../../../shared/types';
export declare class PatientAIAgent {
    private openAI;
    private appointmentService;
    private paymentService;
    private notificationService;
    constructor();
    processMessage(message: AIAgentMessage): Promise<AIAgentMessage>;
    private handleGeneralQuery;
    private analyzeSymptoms;
    private bookAppointment;
    private autoBookUrgentAppointment;
    private calculateWaitTime;
    private formatSymptomAnalysisResponse;
    private createErrorResponse;
    private generateId;
}
//# sourceMappingURL=PatientAIAgent.d.ts.map