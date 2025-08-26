import { MedicalRecord } from '@prisma/client';
export declare class MedicalRecordService {
    private prisma;
    constructor();
    createMedicalRecord(data: {
        patientId: string;
        doctorId: string;
        appointmentId: string;
        diagnosis: string;
        symptoms: string[];
        treatment: string;
        prescription?: string;
        notes?: string;
    }): Promise<MedicalRecord>;
    getMedicalRecordById(recordId: string): Promise<MedicalRecord | null>;
    getPatientMedicalHistory(patientId: string): Promise<MedicalRecord[]>;
    getDoctorMedicalRecords(doctorId: string): Promise<MedicalRecord[]>;
    updateMedicalRecord(recordId: string, updateData: Partial<MedicalRecord>): Promise<MedicalRecord>;
    searchMedicalRecords(searchParams: {
        patientId?: string;
        doctorId?: string;
        diagnosis?: string;
        symptoms?: string[];
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
    }): Promise<MedicalRecord[]>;
    getRecordsByAppointment(appointmentId: string): Promise<MedicalRecord[]>;
    generateMedicalSummary(patientId: string, dateRange?: {
        from: Date;
        to: Date;
    }): Promise<{
        totalRecords: number;
        commonDiagnoses: {
            diagnosis: string;
            count: number;
        }[];
        commonSymptoms: {
            symptom: string;
            count: number;
        }[];
        recentTreatments: string[];
        chronicConditions: string[];
    }>;
    deleteMedicalRecord(recordId: string): Promise<void>;
    validateRecordAccess(recordId: string, userId: string, userRole: string): Promise<boolean>;
}
//# sourceMappingURL=MedicalRecordService.d.ts.map