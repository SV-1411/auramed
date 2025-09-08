import axios from 'axios';
import { logger } from '../utils/logger';

export class OpenAIService {
  private apiKey: string;
  private baseUrl: string;
  private models: {
    fast: string;
    smart: string;
    creative: string;
  };

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = 'https://openrouter.ai/api/v1';
    
    // Configure different models for different use cases
    this.models = {
      fast: 'openai/gpt-3.5-turbo',            // Fast responses
      smart: 'openai/gpt-4o-mini',             // Complex reasoning
      creative: 'anthropic/claude-3-haiku'     // Creative tasks
    };
    
    if (!this.apiKey) {
      logger.warn('OpenRouter API key not configured');
    }
  }

  async generateResponse(
    systemPrompt: string, 
    userMessage: string, 
    userId: string,
    modelType: 'fast' | 'smart' | 'creative' = 'fast'
  ): Promise<string> {
    try {
      const model = this.models[modelType];
      
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 1000,
          temperature: modelType === 'creative' ? 0.8 : 0.7,
          user: userId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://auramed.app',
            'X-Title': 'AuraMed Healthcare Platform'
          }
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from AI');
      }

      logger.info(`AI response generated using ${model} for user: ${userId}`);
      return content;
    } catch (error: any) {
      logger.error('AI API error:', error.response?.data || error.message);
      
      // Fallback response
      return 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment or contact support if the issue persists.';
    }
  }

  async analyzeSymptoms(symptoms: string[], patientHistory?: any): Promise<any> {
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
      const response = await this.generateResponse(
        'You are a medical AI assistant specializing in symptom analysis and triage. Provide accurate, evidence-based assessments.',
        prompt,
        'system-symptom-analysis',
        'smart' // Use smart model for medical analysis
      );

      return JSON.parse(response);
    } catch (error) {
      logger.error('Symptom analysis error:', error);
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

  async generatePrescription(
    diagnosis: string,
    symptoms: string[],
    patientInfo: any,
    doctorId: string
  ): Promise<any> {
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
      const response = await this.generateResponse(
        'You are a medical AI assistant helping doctors generate safe, evidence-based prescriptions. Always consider drug interactions and contraindications.',
        prompt,
        doctorId,
        'smart' // Use smart model for prescriptions
      );

      return JSON.parse(response);
    } catch (error) {
      logger.error('Prescription generation error:', error);
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

  async generateConsultationSummary(
    patientSymptoms: string[],
    doctorNotes: string,
    diagnosis: string,
    treatmentPlan: string
  ): Promise<string> {
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
      return await this.generateResponse(
        'You are a medical documentation AI assistant. Create clear, professional consultation summaries.',
        prompt,
        'system-consultation-summary',
        'creative' // Use creative model for summaries
      );
    } catch (error) {
      logger.error('Consultation summary generation error:', error);
      return `Consultation Summary:
      
Chief Complaint: ${patientSymptoms.join(', ')}
Assessment: ${diagnosis}
Plan: ${treatmentPlan}
Notes: ${doctorNotes}

Follow-up: As recommended by healthcare provider.`;
    }
  }
}