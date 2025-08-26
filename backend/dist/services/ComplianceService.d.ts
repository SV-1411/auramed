export interface ComplianceViolation {
    entityType: string;
    entityId: string;
    description: string;
    regulation: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface DataRetentionViolation {
    recordId: string;
    recordType: string;
    description: string;
    retentionPeriod: number;
    actualAge: number;
}
export declare class ComplianceService {
    private prisma;
    constructor();
    checkHIPAACompliance(): Promise<ComplianceViolation[]>;
    checkDataRetention(): Promise<DataRetentionViolation[]>;
    checkGDPRCompliance(): Promise<ComplianceViolation[]>;
    private findUnencryptedMedicalRecords;
    private detectUnauthorizedAccess;
    private findMissingPatientConsent;
    private detectDataSharingViolations;
    private detectUnauthorizedDataProcessing;
    private findPendingDataSubjectRequests;
    generateComplianceReport(): Promise<{
        hipaaViolations: ComplianceViolation[];
        gdprViolations: ComplianceViolation[];
        dataRetentionViolations: DataRetentionViolation[];
        overallScore: number;
    }>;
}
//# sourceMappingURL=ComplianceService.d.ts.map