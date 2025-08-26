export interface ConsultationStats {
    totalConsultations: number;
    successfulDiagnoses: number;
    followUpsRequired: number;
    followUpsCompleted: number;
}
export interface PatientFeedback {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
        [key: number]: number;
    };
}
export interface ResponseTimeData {
    averageMinutes: number;
    medianMinutes: number;
    totalResponses: number;
}
export declare class AuditService {
    private prisma;
    constructor();
    logCredentialVerification(doctorId: string, verified: boolean): Promise<void>;
    logQualityRankingUpdate(doctorsUpdated: number): Promise<void>;
    getDoctorConsultationStats(doctorId: string): Promise<ConsultationStats>;
    getDoctorPatientFeedback(doctorId: string): Promise<PatientFeedback>;
    getDoctorResponseTimes(doctorId: string): Promise<ResponseTimeData>;
    logUserAction(userId: string, action: string, entityType: string, entityId: string, details?: any): Promise<void>;
    getAuditLogs(filters?: {
        entityType?: string;
        entityId?: string;
        performedBy?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<any[]>;
}
//# sourceMappingURL=AuditService.d.ts.map