"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class OpenAIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        this.baseURL = 'https://api.openai.com/v1';
        if (!this.apiKey) {
            logger_1.logger.warn('OpenAI API key not configured');
        }
    }
    async generateResponse(systemPrompt, userMessage, userId, model = 'gpt-4') {
        try {
            const response = await axios_1.default.post(`${this.baseURL}/chat/completions`, {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 1000,
                temperature: 0.7,
                user: userId
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const content = response.data.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response content from OpenAI');
            }
            logger_1.logger.info(`OpenAI response generated for user: ${userId}`);
            return content;
        }
        catch (error) {
            logger_1.logger.error('OpenAI API error:', error.response?.data || error.message);
            // Fallback response
            return 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment or contact support if the issue persists.';
        }
    }
    async analyzeSymptoms(symptoms, patientHistory) {
        const prompt = `Analyze these medical symptoms and provide a structured assessment:
    
    Symptoms: ${symptoms.join(', ')}
    ${patientHistory ? `Patient History: ${JSON.stringify(patientHistory)}` : ''}
    
    Provide a JSON response with:
    {
      "riskLevel": "low|medium|high|critical",
      "riskScore": 0-100,
      "urgency": "routine|urgent|emergency",
      "recommendedSpecialization": ["specialization1", "specialization2"],
      "possibleConditions": ["condition1", "condition2"],
      "recommendedActions": ["action1", "action2"],
      "redFlags": ["flag1", "flag2"],
      "confidence": 0.0-1.0,
      "explanation": "detailed explanation"
    }`;
        try {
            const response = await this.generateResponse('You are a medical AI assistant specializing in symptom analysis and triage. Provide accurate, evidence-based assessments.', prompt, 'system-symptom-analysis');
            return JSON.parse(response);
        }
        catch (error) {
            logger_1.logger.error('Symptom analysis error:', error);
            return {
                riskLevel: 'medium',
                riskScore: 50,
                urgency: 'routine',
                recommendedSpecialization: ['general_medicine'],
                possibleConditions: ['Requires professional evaluation'],
                recommendedActions: ['Schedule consultation with healthcare provider'],
                redFlags: [],
                confidence: 0.5,
                explanation: 'Unable to complete automated analysis. Please consult with a healthcare professional.'
            };
        }
    }
    async generatePrescription(diagnosis, symptoms, patientInfo, doctorId) {
        const prompt = `Generate a prescription for:
    
    Diagnosis: ${diagnosis}
    Symptoms: ${symptoms.join(', ')}
    Patient Age: ${patientInfo.age}
    Patient Weight: ${patientInfo.weight}kg
    Allergies: ${patientInfo.allergies?.join(', ') || 'None reported'}
    Current Medications: ${patientInfo.currentMedications?.join(', ') || 'None'}
    
    Provide a JSON array of medications:
    [
      {
        "medicationName": "string",
        "genericName": "string",
        "dosage": "string",
        "frequency": "string",
        "duration": "string",
        "instructions": "string",
        "warnings": ["warning1", "warning2"],
        "interactions": ["interaction1", "interaction2"]
      }
    ]`;
        try {
            const response = await this.generateResponse('You are a medical AI assistant helping doctors generate safe, evidence-based prescriptions. Always consider drug interactions and contraindications.', prompt, doctorId);
            return JSON.parse(response);
        }
        catch (error) {
            logger_1.logger.error('Prescription generation error:', error);
            return [{
                    medicationName: 'Manual prescription required',
                    genericName: '',
                    dosage: 'As directed',
                    frequency: 'As needed',
                    duration: 'As directed',
                    instructions: 'AI prescription generation failed. Please prescribe manually.',
                    warnings: ['Manual review required'],
                    interactions: []
                }];
        }
    }
    async generateConsultationSummary(patientSymptoms, doctorNotes, diagnosis, treatmentPlan) {
        const prompt = `Generate a professional medical consultation summary:
    
    Patient Symptoms: ${patientSymptoms.join(', ')}
    Doctor's Notes: ${doctorNotes}
    Diagnosis: ${diagnosis}
    Treatment Plan: ${treatmentPlan}
    
    Create a structured summary including:
    - Chief complaint
    - Assessment
    - Plan
    - Follow-up instructions
    - Patient education points`;
        try {
            return await this.generateResponse('You are a medical documentation AI assistant. Create clear, professional consultation summaries.', prompt, 'system-consultation-summary');
        }
        catch (error) {
            logger_1.logger.error('Consultation summary generation error:', error);
            return `Consultation Summary:
      
Chief Complaint: ${patientSymptoms.join(', ')}
Assessment: ${diagnosis}
Plan: ${treatmentPlan}
Notes: ${doctorNotes}

Follow-up: As recommended by healthcare provider.`;
        }
    }
}
exports.OpenAIService = OpenAIService;
//# sourceMappingURL=OpenAIService.js.map