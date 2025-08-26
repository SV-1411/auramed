"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorAIAgent = void 0;
const logger_1 = require("../utils/logger");
const OpenAIService_1 = require("../services/OpenAIService");
const AppointmentService_1 = require("../services/AppointmentService");
const MedicalRecordService_1 = require("../services/MedicalRecordService");
const NotificationService_1 = require("../services/NotificationService");
class DoctorAIAgent {
    constructor() {
        this.openAI = new OpenAIService_1.OpenAIService();
        this.appointmentService = new AppointmentService_1.AppointmentService();
        this.medicalRecordService = new MedicalRecordService_1.MedicalRecordService();
        this.notificationService = new NotificationService_1.NotificationService();
    }
    async processMessage(message) {
        try {
            logger_1.logger.info(`Doctor AI Agent processing message: ${message.id}`);
            switch (message.messageType) {
                case 'text':
                    return await this.handleDoctorQuery(message);
                case 'prescription':
                    return await this.generatePrescription(message);
                case 'alert':
                    return await this.handleMedicalAlert(message);
                default:
                    return await this.handleDoctorQuery(message);
            }
        }
        catch (error) {
            logger_1.logger.error('Doctor AI Agent error:', error);
            return this.createErrorResponse(message, 'Unable to process request. Please try again.');
        }
    }
    async generateConsultationSummary(appointmentId, consultationNotes) {
        try {
            const appointment = await this.appointmentService.getAppointmentById(appointmentId);
            if (!appointment) {
                throw new Error('Appointment not found');
            }
            const summaryPrompt = `Generate a structured medical consultation summary:
      
      Patient Symptoms: ${appointment.symptoms.join(', ')}
      Consultation Notes: ${consultationNotes}
      Risk Score: ${appointment.riskScore.score}
      
      Provide a JSON response with:
      - diagnosis: string
      - symptoms: string[]
      - treatmentPlan: string
      - prescriptions: array of {medicationName, dosage, frequency, duration, instructions}
      - followUpRequired: boolean
      - followUpDate: ISO date string (if required)
      - riskAssessment: string
      - doctorNotes: string`;
            const summaryResponse = await this.openAI.generateResponse('You are a medical AI assistant helping doctors create structured consultation summaries.', summaryPrompt, appointment.doctorId);
            let parsedSummary;
            try {
                parsedSummary = JSON.parse(summaryResponse);
            }
            catch (error) {
                // Fallback structured summary
                parsedSummary = {
                    diagnosis: 'Consultation completed - see notes',
                    symptoms: appointment.symptoms,
                    treatmentPlan: consultationNotes,
                    prescriptions: [],
                    followUpRequired: false,
                    riskAssessment: 'Standard follow-up recommended',
                    doctorNotes: consultationNotes
                };
            }
            const medicalRecord = {
                id: this.generateId(),
                patientId: appointment.patientId,
                doctorId: appointment.doctorId,
                date: new Date(),
                symptoms: parsedSummary.symptoms,
                diagnosis: parsedSummary.diagnosis,
                prescription: parsedSummary.prescriptions,
                visitSummary: parsedSummary.treatmentPlan,
                riskScore: appointment.riskScore,
                followUpRequired: parsedSummary.followUpRequired,
                followUpDate: parsedSummary.followUpDate ? new Date(parsedSummary.followUpDate) : undefined
            };
            // Save medical record
            await this.medicalRecordService.createMedicalRecord(medicalRecord);
            // Update doctor quality metrics
            await this.updateDoctorQualityMetrics(appointment.doctorId, appointment);
            // Send follow-up reminders if needed
            if (medicalRecord.followUpRequired && medicalRecord.followUpDate) {
                await this.scheduleFollowUpReminder(medicalRecord);
            }
            return medicalRecord;
        }
        catch (error) {
            logger_1.logger.error('Error generating consultation summary:', error);
            throw error;
        }
    }
    async handleDoctorQuery(message) {
        const systemPrompt = `You are a Doctor AI Agent for AuraMed healthcare platform. Your role is to:
    1. Assist doctors during consultations with patient information summaries
    2. Generate structured consultation summaries and prescriptions
    3. Identify potential risk factors and drug interactions
    4. Maintain doctor schedules and availability
    5. Track diagnostic accuracy and performance metrics
    6. Provide evidence-based medical recommendations
    
    Always maintain medical accuracy and professional standards. Suggest evidence-based treatments.
    Help doctors make informed decisions with patient history and risk factors.`;
        const response = await this.openAI.generateResponse(systemPrompt, message.content, message.fromUserId);
        return {
            id: this.generateId(),
            agentType: 'doctor',
            fromUserId: 'doctor-ai-agent',
            toUserId: message.fromUserId,
            content: response,
            messageType: 'text',
            timestamp: new Date(),
            isProcessed: false
        };
    }
    async generatePrescription(message) {
        const { symptoms, diagnosis, patientId, allergies } = message.metadata || {};
        const prescriptionPrompt = `Generate a prescription for:
    Patient ID: ${patientId}
    Diagnosis: ${diagnosis}
    Symptoms: ${symptoms?.join(', ')}
    Known Allergies: ${allergies?.join(', ') || 'None reported'}
    
    Provide a JSON array of prescriptions with:
    - medicationName: string
    - dosage: string (e.g., "500mg")
    - frequency: string (e.g., "twice daily")
    - duration: string (e.g., "7 days")
    - instructions: string (detailed instructions)
    - warnings: string[] (any warnings or contraindications)
    
    Consider drug interactions and allergies. Include generic alternatives where appropriate.`;
        const prescriptionResponse = await this.openAI.generateResponse('You are a medical AI assistant helping doctors generate safe, evidence-based prescriptions.', prescriptionPrompt, message.fromUserId);
        let prescriptions;
        try {
            prescriptions = JSON.parse(prescriptionResponse);
        }
        catch (error) {
            prescriptions = [{
                    medicationName: 'Please review and prescribe manually',
                    dosage: 'As directed',
                    frequency: 'As needed',
                    duration: 'As directed',
                    instructions: 'AI prescription generation failed. Please prescribe manually based on clinical judgment.'
                }];
        }
        // Check for drug interactions
        const interactionWarnings = await this.checkDrugInteractions(prescriptions, patientId);
        const responseContent = this.formatPrescriptionResponse(prescriptions, interactionWarnings);
        return {
            id: this.generateId(),
            agentType: 'doctor',
            fromUserId: 'doctor-ai-agent',
            toUserId: message.fromUserId,
            content: responseContent,
            messageType: 'prescription',
            metadata: { prescriptions, interactionWarnings },
            timestamp: new Date(),
            isProcessed: false
        };
    }
    async handleMedicalAlert(message) {
        const { alertType, patientId, severity, details } = message.metadata || {};
        let alertResponse = '';
        switch (alertType) {
            case 'critical_symptoms':
                alertResponse = `🚨 **CRITICAL ALERT**\n\nPatient ID: ${patientId}\nSeverity: ${severity}\n\n${details}\n\n**Immediate Action Required:**\n- Review patient immediately\n- Consider emergency protocols\n- Document all interventions`;
                break;
            case 'drug_interaction':
                alertResponse = `⚠️ **DRUG INTERACTION ALERT**\n\nPatient ID: ${patientId}\n\n${details}\n\n**Action Required:**\n- Review current medications\n- Consider alternative treatments\n- Monitor patient closely`;
                break;
            case 'follow_up_overdue':
                alertResponse = `📅 **FOLLOW-UP OVERDUE**\n\nPatient ID: ${patientId}\n\n${details}\n\n**Action Required:**\n- Contact patient for follow-up\n- Review treatment progress\n- Adjust care plan if needed`;
                break;
            default:
                alertResponse = `ℹ️ **MEDICAL ALERT**\n\nPatient ID: ${patientId}\n\n${details}`;
        }
        return {
            id: this.generateId(),
            agentType: 'doctor',
            fromUserId: 'doctor-ai-agent',
            toUserId: message.fromUserId,
            content: alertResponse,
            messageType: 'alert',
            metadata: message.metadata,
            timestamp: new Date(),
            isProcessed: false
        };
    }
    async checkDrugInteractions(prescriptions, patientId) {
        try {
            // Get patient's current medications
            const patientHistory = await this.medicalRecordService.getPatientMedicalHistory(patientId);
            const currentMedications = patientHistory.flatMap(record => record.prescription);
            const allMedications = [
                ...currentMedications.map(p => p.medicationName),
                ...prescriptions.map(p => p.medicationName)
            ];
            // Simple interaction check (in production, use a proper drug interaction database)
            const knownInteractions = [
                { drugs: ['warfarin', 'aspirin'], warning: 'Increased bleeding risk' },
                { drugs: ['metformin', 'alcohol'], warning: 'Risk of lactic acidosis' },
                { drugs: ['digoxin', 'furosemide'], warning: 'Electrolyte imbalance risk' }
            ];
            const warnings = [];
            for (const interaction of knownInteractions) {
                const hasAllDrugs = interaction.drugs.every(drug => allMedications.some(med => med.toLowerCase().includes(drug.toLowerCase())));
                if (hasAllDrugs) {
                    warnings.push(`${interaction.drugs.join(' + ')}: ${interaction.warning}`);
                }
            }
            return warnings;
        }
        catch (error) {
            logger_1.logger.error('Error checking drug interactions:', error);
            return ['Unable to check drug interactions - please verify manually'];
        }
    }
    async updateDoctorQualityMetrics(doctorId, appointment) {
        try {
            // This would typically update a doctor's performance metrics
            // Based on consultation completion, patient feedback, etc.
            const metrics = {
                doctorId,
                totalConsultations: 1, // Increment
                responseTime: 15, // Average response time in minutes
                lastUpdated: new Date()
            };
            // Update metrics in database
            await this.medicalRecordService.updateDoctorMetrics(doctorId, metrics);
        }
        catch (error) {
            logger_1.logger.error('Error updating doctor quality metrics:', error);
        }
    }
    async scheduleFollowUpReminder(medicalRecord) {
        if (!medicalRecord.followUpDate)
            return;
        try {
            await this.notificationService.scheduleFollowUpReminder(medicalRecord.patientId, medicalRecord.doctorId, medicalRecord.followUpDate);
        }
        catch (error) {
            logger_1.logger.error('Error scheduling follow-up reminder:', error);
        }
    }
    formatPrescriptionResponse(prescriptions, warnings) {
        let response = '💊 **Prescription Generated**\n\n';
        prescriptions.forEach((prescription, index) => {
            response += `**${index + 1}. ${prescription.medicationName}**\n`;
            response += `   Dosage: ${prescription.dosage}\n`;
            response += `   Frequency: ${prescription.frequency}\n`;
            response += `   Duration: ${prescription.duration}\n`;
            response += `   Instructions: ${prescription.instructions}\n\n`;
        });
        if (warnings.length > 0) {
            response += '⚠️ **Drug Interaction Warnings:**\n';
            warnings.forEach(warning => {
                response += `• ${warning}\n`;
            });
            response += '\n';
        }
        response += '**Please review and approve before sending to patient.**';
        return response;
    }
    createErrorResponse(originalMessage, errorText) {
        return {
            id: this.generateId(),
            agentType: 'doctor',
            fromUserId: 'doctor-ai-agent',
            toUserId: originalMessage.fromUserId,
            content: errorText,
            messageType: 'text',
            timestamp: new Date(),
            isProcessed: false
        };
    }
    generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.DoctorAIAgent = DoctorAIAgent;
//# sourceMappingURL=DoctorAIAgent.js.map