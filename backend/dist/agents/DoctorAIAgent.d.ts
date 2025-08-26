import { AIAgentMessage, MedicalRecord } from '../../../shared/types';
export declare class DoctorAIAgent {
    private openAI;
    private appointmentService;
    private medicalRecordService;
    private notificationService;
    constructor();
    processMessage(message: AIAgentMessage): Promise<AIAgentMessage>;
    generateConsultationSummary(appointmentId: string, consultationNotes: string): Promise<MedicalRecord>;
    private handleDoctorQuery;
    private generatePrescription;
    private handleMedicalAlert;
    private checkDrugInteractions;
    private updateDoctorQualityMetrics;
    private scheduleFollowUpReminder;
    private formatPrescriptionResponse;
    private createErrorResponse;
    private generateId;
}
//# sourceMappingURL=DoctorAIAgent.d.ts.map