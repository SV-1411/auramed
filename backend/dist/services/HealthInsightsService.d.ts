export interface HealthMetric {
    type: 'blood_pressure' | 'heart_rate' | 'weight' | 'blood_sugar' | 'temperature' | 'bmi';
    value: number;
    unit: string;
    recordedAt: Date;
    isNormal: boolean;
    trend?: 'improving' | 'stable' | 'declining';
}
export interface HealthInsight {
    id: string;
    patientId: string;
    type: 'risk_alert' | 'improvement' | 'recommendation' | 'trend_analysis' | 'preventive_care';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    actionRequired: boolean;
    recommendations: string[];
    relatedMetrics: string[];
    createdAt: Date;
    expiresAt?: Date;
}
export interface PredictiveAnalysis {
    riskFactors: {
        diabetes: number;
        hypertension: number;
        cardiovascular: number;
        obesity: number;
    };
    recommendations: string[];
    nextCheckupSuggestion: Date;
    preventiveMeasures: string[];
}
export declare class HealthInsightsService {
    /**
     * Generate health insights for a patient based on their medical history
     */
    generateHealthInsights(patientId: string): Promise<HealthInsight[]>;
    /**
     * Analyze appointment patterns and frequency
     */
    private analyzeAppointmentPatterns;
    /**
     * Analyze medical records for risk factors
     */
    private analyzeRiskFactors;
    /**
     * Generate preventive care insights
     */
    private generatePreventiveCareInsights;
    /**
     * Generate predictive health analysis
     */
    generatePredictiveAnalysis(patientId: string): Promise<PredictiveAnalysis>;
    /**
     * Extract chronic conditions from medical records
     */
    private extractChronicConditions;
    /**
     * Calculate age from date of birth
     */
    private calculateAge;
    /**
     * Calculate diabetes risk (0-1 scale)
     */
    private calculateDiabetesRisk;
    /**
     * Calculate hypertension risk (0-1 scale)
     */
    private calculateHypertensionRisk;
    /**
     * Calculate cardiovascular risk (0-1 scale)
     */
    private calculateCardiovascularRisk;
    /**
     * Calculate obesity risk (0-1 scale)
     */
    private calculateObesityRisk;
    /**
     * Generate recommendations based on risk factors
     */
    private generateRiskBasedRecommendations;
    /**
     * Calculate next checkup date based on risk factors
     */
    private calculateNextCheckupDate;
    /**
     * Generate preventive measures based on age and risk
     */
    private generatePreventiveMeasures;
}
export declare const healthInsightsService: HealthInsightsService;
//# sourceMappingURL=HealthInsightsService.d.ts.map