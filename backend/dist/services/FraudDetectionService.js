"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudDetectionService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
class FraudDetectionService {
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    async detectSuspiciousPayments() {
        try {
            const suspiciousPayments = [];
            // Get recent payments for analysis
            const recentPayments = await this.prisma.payment.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                },
                include: {
                    user: true
                }
            });
            // Group payments by user
            const paymentsByUser = recentPayments.reduce((acc, payment) => {
                if (!acc[payment.userId]) {
                    acc[payment.userId] = [];
                }
                acc[payment.userId].push(payment);
                return acc;
            }, {});
            // Analyze each user's payment patterns
            for (const [userId, payments] of Object.entries(paymentsByUser)) {
                const analysis = this.analyzePaymentPattern(payments);
                if (analysis.riskScore > 70) {
                    suspiciousPayments.push({
                        id: `fraud_${Date.now()}_${userId}`,
                        userId,
                        amount: analysis.totalAmount,
                        frequency: payments.length,
                        riskScore: analysis.riskScore,
                        reason: analysis.reason
                    });
                }
            }
            logger_1.logger.info(`Detected ${suspiciousPayments.length} suspicious payment patterns`);
            return suspiciousPayments;
        }
        catch (error) {
            logger_1.logger.error('Error detecting suspicious payments:', error);
            return [];
        }
    }
    async detectFakeAppointments() {
        try {
            const fakeAppointments = [];
            // Get recent appointments
            const recentAppointments = await this.prisma.appointment.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                },
                include: {
                    patient: true,
                    doctor: true
                }
            });
            // Analyze appointment patterns
            for (const appointment of recentAppointments) {
                const suspiciousPatterns = this.analyzeFakeAppointmentPatterns(appointment);
                if (suspiciousPatterns.length > 0) {
                    const riskScore = this.calculateAppointmentRiskScore(suspiciousPatterns);
                    if (riskScore > 60) {
                        fakeAppointments.push({
                            id: appointment.id,
                            patientId: appointment.patientId,
                            doctorId: appointment.doctorId,
                            riskScore,
                            suspiciousPatterns
                        });
                    }
                }
            }
            logger_1.logger.info(`Detected ${fakeAppointments.length} potentially fake appointments`);
            return fakeAppointments;
        }
        catch (error) {
            logger_1.logger.error('Error detecting fake appointments:', error);
            return [];
        }
    }
    async detectCredentialFraud() {
        try {
            const credentialIssues = [];
            // Get all doctors for credential verification
            const doctors = await this.prisma.user.findMany({
                where: { role: 'DOCTOR' },
                include: { profile: true }
            });
            for (const doctor of doctors) {
                const profile = doctor.profile;
                if (!profile)
                    continue;
                const issues = this.validateDoctorCredentials(doctor.id, profile);
                credentialIssues.push(...issues);
            }
            logger_1.logger.info(`Detected ${credentialIssues.length} credential fraud issues`);
            return credentialIssues;
        }
        catch (error) {
            logger_1.logger.error('Error detecting credential fraud:', error);
            return [];
        }
    }
    analyzePaymentPattern(payments) {
        let riskScore = 0;
        let reason = '';
        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const avgAmount = totalAmount / payments.length;
        // Check for unusual frequency
        if (payments.length > 20) {
            riskScore += 30;
            reason += 'High payment frequency; ';
        }
        // Check for round number amounts (potential fake)
        const roundAmounts = payments.filter(p => p.amount % 100 === 0).length;
        if (roundAmounts / payments.length > 0.8) {
            riskScore += 25;
            reason += 'Suspicious round amounts; ';
        }
        // Check for identical amounts
        const uniqueAmounts = new Set(payments.map(p => p.amount)).size;
        if (uniqueAmounts === 1 && payments.length > 5) {
            riskScore += 40;
            reason += 'Identical payment amounts; ';
        }
        // Check for unusually high amounts
        if (avgAmount > 5000) {
            riskScore += 20;
            reason += 'High average payment amount; ';
        }
        // Check payment timing patterns
        const timeDiffs = payments.slice(1).map((p, i) => new Date(p.createdAt).getTime() - new Date(payments[i].createdAt).getTime());
        const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
        // Payments made at very regular intervals (potential automation)
        if (timeDiffs.every(diff => Math.abs(diff - avgTimeDiff) < 3600000)) { // Within 1 hour
            riskScore += 35;
            reason += 'Regular payment intervals; ';
        }
        return {
            riskScore: Math.min(riskScore, 100),
            totalAmount,
            reason: reason.trim()
        };
    }
    analyzeFakeAppointmentPatterns(appointment) {
        const patterns = [];
        // Check if appointment was created and scheduled for same day
        const createdDate = new Date(appointment.createdAt);
        const scheduledDate = new Date(appointment.scheduledAt);
        const timeDiff = scheduledDate.getTime() - createdDate.getTime();
        if (timeDiff < 3600000) { // Less than 1 hour
            patterns.push('Same-day booking');
        }
        // Check for suspicious symptoms patterns
        if (appointment.symptoms && appointment.symptoms.length === 1) {
            patterns.push('Single vague symptom');
        }
        // Check for new patient with immediate booking
        const patientAge = Date.now() - new Date(appointment.patient.createdAt).getTime();
        if (patientAge < 24 * 60 * 60 * 1000) { // Account less than 24 hours old
            patterns.push('New patient account');
        }
        // Check for appointment outside normal hours
        const hour = scheduledDate.getHours();
        if (hour < 8 || hour > 20) {
            patterns.push('Outside normal hours');
        }
        return patterns;
    }
    calculateAppointmentRiskScore(patterns) {
        const riskWeights = {
            'Same-day booking': 25,
            'Single vague symptom': 20,
            'New patient account': 30,
            'Outside normal hours': 15
        };
        return patterns.reduce((score, pattern) => {
            return score + (riskWeights[pattern] || 10);
        }, 0);
    }
    validateDoctorCredentials(doctorId, profile) {
        const issues = [];
        // Check license number format
        if (!profile.licenseNumber || !/^[A-Z]{2}\d{6,8}$/.test(profile.licenseNumber)) {
            issues.push({
                doctorId,
                licenseNumber: profile.licenseNumber || 'MISSING',
                issueType: 'Invalid license number format',
                severity: 'high'
            });
        }
        // Check for blacklisted license numbers
        const blacklistedLicenses = ['XX000000', 'INVALID1', 'TEST1234'];
        if (blacklistedLicenses.includes(profile.licenseNumber)) {
            issues.push({
                doctorId,
                licenseNumber: profile.licenseNumber,
                issueType: 'Blacklisted license number',
                severity: 'critical'
            });
        }
        // Check for missing qualifications
        if (!profile.qualifications || profile.qualifications.length === 0) {
            issues.push({
                doctorId,
                licenseNumber: profile.licenseNumber || 'MISSING',
                issueType: 'Missing qualifications',
                severity: 'medium'
            });
        }
        // Check for suspicious qualification patterns
        if (profile.qualifications && profile.qualifications.some((q) => q.toLowerCase().includes('fake') || q.toLowerCase().includes('test'))) {
            issues.push({
                doctorId,
                licenseNumber: profile.licenseNumber || 'MISSING',
                issueType: 'Suspicious qualification entries',
                severity: 'high'
            });
        }
        return issues;
    }
    async reportFraudIncident(incidentData) {
        try {
            await this.prisma.fraudIncident.create({
                data: {
                    type: incidentData.type,
                    entityId: incidentData.entityId,
                    description: incidentData.description,
                    severity: incidentData.severity,
                    evidence: JSON.stringify(incidentData.evidence),
                    status: 'PENDING',
                    reportedAt: new Date()
                }
            });
            logger_1.logger.info(`Fraud incident reported: ${incidentData.type} - ${incidentData.entityId}`);
        }
        catch (error) {
            logger_1.logger.error('Error reporting fraud incident:', error);
            throw error;
        }
    }
}
exports.FraudDetectionService = FraudDetectionService;
//# sourceMappingURL=FraudDetectionService.js.map