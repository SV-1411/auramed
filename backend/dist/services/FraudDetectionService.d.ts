export interface SuspiciousPayment {
    id: string;
    userId: string;
    amount: number;
    frequency: number;
    riskScore: number;
    reason: string;
}
export interface FakeAppointment {
    id: string;
    patientId: string;
    doctorId: string;
    riskScore: number;
    suspiciousPatterns: string[];
}
export interface CredentialFraud {
    doctorId: string;
    licenseNumber: string;
    issueType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export declare class FraudDetectionService {
    private prisma;
    constructor();
    detectSuspiciousPayments(): Promise<SuspiciousPayment[]>;
    detectFakeAppointments(): Promise<FakeAppointment[]>;
    detectCredentialFraud(): Promise<CredentialFraud[]>;
    private analyzePaymentPattern;
    private analyzeFakeAppointmentPatterns;
    private calculateAppointmentRiskScore;
    private validateDoctorCredentials;
    reportFraudIncident(incidentData: {
        type: 'payment' | 'appointment' | 'credential';
        entityId: string;
        description: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        evidence: any;
    }): Promise<void>;
}
//# sourceMappingURL=FraudDetectionService.d.ts.map