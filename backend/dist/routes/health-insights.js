"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const HealthInsightsService_1 = require("../services/HealthInsightsService");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Get health insights for a patient
router.get('/:patientId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        const userId = req.user?.id;
        // Ensure user can only access their own insights or is a doctor/admin
        if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const insights = await HealthInsightsService_1.healthInsightsService.generateHealthInsights(patientId);
        res.json({
            success: true,
            data: { insights }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get health insights:', error);
        res.status(500).json({ error: 'Failed to get health insights' });
    }
});
// Get predictive analysis for a patient
router.get('/:patientId/predictive-analysis', auth_1.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        const userId = req.user?.id;
        // Ensure user can only access their own analysis or is a doctor/admin
        if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const analysis = await HealthInsightsService_1.healthInsightsService.generatePredictiveAnalysis(patientId);
        res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get predictive analysis:', error);
        res.status(500).json({ error: 'Failed to get predictive analysis' });
    }
});
// Refresh health insights for a patient
router.post('/:patientId/refresh', auth_1.authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        const userId = req.user?.id;
        // Ensure user can only refresh their own insights or is a doctor/admin
        if (userId !== patientId && req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const insights = await HealthInsightsService_1.healthInsightsService.generateHealthInsights(patientId);
        res.json({
            success: true,
            message: 'Health insights refreshed successfully',
            data: { insights }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to refresh health insights:', error);
        res.status(500).json({ error: 'Failed to refresh health insights' });
    }
});
exports.default = router;
//# sourceMappingURL=health-insights.js.map