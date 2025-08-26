import { AIAgentMessage, SystemAlert, DoctorQualityMetrics } from '../../../shared/types';
export declare class AdminAIAgent {
    private openAI;
    private userService;
    private auditService;
    private fraudDetection;
    private complianceService;
    constructor();
    processMessage(message: AIAgentMessage): Promise<AIAgentMessage>;
    verifyDoctorCredentials(doctorId: string): Promise<{
        verified: boolean;
        issues: string[];
    }>;
    detectFraudulentActivity(): Promise<SystemAlert[]>;
    updateDoctorQualityRankings(): Promise<DoctorQualityMetrics[]>;
    monitorCompliance(): Promise<SystemAlert[]>;
    private handleAdminQuery;
    private handleSystemAlert;
    private handleFraudAlert;
    private handleComplianceAlert;
    private handleSystemErrorAlert;
    private verifyLicenseWithAuthority;
    private calculateDoctorQualityScore;
    private createErrorResponse;
    private generateId;
}
//# sourceMappingURL=AdminAIAgent.d.ts.map