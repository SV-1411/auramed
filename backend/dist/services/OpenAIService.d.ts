export declare class OpenAIService {
    private apiKey;
    private baseURL;
    constructor();
    generateResponse(systemPrompt: string, userMessage: string, userId: string, model?: string): Promise<string>;
    analyzeSymptoms(symptoms: string[], patientHistory?: any): Promise<any>;
    generatePrescription(diagnosis: string, symptoms: string[], patientInfo: any, doctorId: string): Promise<any>;
    generateConsultationSummary(patientSymptoms: string[], doctorNotes: string, diagnosis: string, treatmentPlan: string): Promise<string>;
}
//# sourceMappingURL=OpenAIService.d.ts.map