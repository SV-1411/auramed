"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const TranslationService_1 = require("../services/TranslationService");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Get supported languages
router.get('/languages', (req, res) => {
    try {
        const languages = TranslationService_1.translationService.getSupportedLanguages();
        res.json({
            success: true,
            data: { languages }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get supported languages:', error);
        res.status(500).json({ error: 'Failed to get supported languages' });
    }
});
// Translate text
router.post('/translate', auth_1.authenticateToken, async (req, res) => {
    try {
        const { text, targetLanguage, sourceLanguage } = req.body;
        if (!text || !targetLanguage) {
            return res.status(400).json({ error: 'Text and target language are required' });
        }
        const translatedText = await TranslationService_1.translationService.translateText(text, {
            targetLanguage,
            sourceLanguage
        });
        res.json({
            success: true,
            data: {
                originalText: text,
                translatedText,
                sourceLanguage: sourceLanguage || 'auto',
                targetLanguage
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Translation failed:', error);
        res.status(500).json({ error: 'Translation failed' });
    }
});
// Translate medical text with context
router.post('/translate-medical', auth_1.authenticateToken, async (req, res) => {
    try {
        const { text, targetLanguage, sourceLanguage } = req.body;
        if (!text || !targetLanguage) {
            return res.status(400).json({ error: 'Text and target language are required' });
        }
        const translatedText = await TranslationService_1.translationService.translateMedicalText(text, {
            targetLanguage,
            sourceLanguage
        });
        res.json({
            success: true,
            data: {
                originalText: text,
                translatedText,
                sourceLanguage: sourceLanguage || 'auto',
                targetLanguage
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Medical translation failed:', error);
        res.status(500).json({ error: 'Medical translation failed' });
    }
});
// Detect language of text
router.post('/detect', auth_1.authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        const detectedLanguage = await TranslationService_1.translationService.detectLanguage(text);
        const languageName = TranslationService_1.translationService.getLanguageName(detectedLanguage);
        res.json({
            success: true,
            data: {
                text,
                detectedLanguage,
                languageName
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Language detection failed:', error);
        res.status(500).json({ error: 'Language detection failed' });
    }
});
// Translate appointment message
router.post('/appointment-message', auth_1.authenticateToken, async (req, res) => {
    try {
        const { templateType, data, targetLanguage } = req.body;
        if (!templateType || !data || !targetLanguage) {
            return res.status(400).json({
                error: 'Template type, data, and target language are required'
            });
        }
        const translatedMessage = await TranslationService_1.translationService.translateAppointmentMessage(templateType, data, targetLanguage);
        res.json({
            success: true,
            data: {
                templateType,
                translatedMessage,
                targetLanguage
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Appointment message translation failed:', error);
        res.status(500).json({ error: 'Appointment message translation failed' });
    }
});
// Batch translate multiple texts
router.post('/batch', auth_1.authenticateToken, async (req, res) => {
    try {
        const { texts, targetLanguage, sourceLanguage } = req.body;
        if (!texts || !Array.isArray(texts) || !targetLanguage) {
            return res.status(400).json({
                error: 'Texts array and target language are required'
            });
        }
        if (texts.length > 50) {
            return res.status(400).json({
                error: 'Maximum 50 texts allowed per batch request'
            });
        }
        const translatedTexts = await TranslationService_1.translationService.translateBatch(texts, {
            targetLanguage,
            sourceLanguage
        });
        res.json({
            success: true,
            data: {
                originalTexts: texts,
                translatedTexts,
                sourceLanguage: sourceLanguage || 'auto',
                targetLanguage
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Batch translation failed:', error);
        res.status(500).json({ error: 'Batch translation failed' });
    }
});
exports.default = router;
//# sourceMappingURL=translation.js.map