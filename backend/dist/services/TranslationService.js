"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationService = exports.TranslationService = void 0;
const v2_1 = require("@google-cloud/translate/build/src/v2");
const logger_1 = require("../utils/logger");
class TranslationService {
    constructor() {
        this.supportedLanguages = [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
            { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
            { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
            { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
            { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
            { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
            { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
            { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
            { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
            { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
            { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
            { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' }
        ];
        // Initialize Google Translate with credentials
        this.translate = new v2_1.Translate({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
        });
    }
    /**
     * Translate text to target language
     */
    async translateText(text, options) {
        try {
            if (!text || text.trim() === '') {
                return text;
            }
            // Check if target language is supported
            if (!this.isLanguageSupported(options.targetLanguage)) {
                throw new Error(`Language ${options.targetLanguage} is not supported`);
            }
            const [translation] = await this.translate.translate(text, {
                to: options.targetLanguage,
                from: options.sourceLanguage
            });
            logger_1.logger.info(`Translated text from ${options.sourceLanguage || 'auto'} to ${options.targetLanguage}`);
            return translation;
        }
        catch (error) {
            logger_1.logger.error('Translation failed:', error);
            throw new Error('Translation service unavailable');
        }
    }
    /**
     * Translate multiple texts in batch
     */
    async translateBatch(texts, options) {
        try {
            const translations = await Promise.all(texts.map(text => this.translateText(text, options)));
            return translations;
        }
        catch (error) {
            logger_1.logger.error('Batch translation failed:', error);
            throw error;
        }
    }
    /**
     * Detect language of text
     */
    async detectLanguage(text) {
        try {
            const [detection] = await this.translate.detect(text);
            const language = Array.isArray(detection) ? detection[0] : detection;
            return language.language;
        }
        catch (error) {
            logger_1.logger.error('Language detection failed:', error);
            return 'en'; // Default to English
        }
    }
    /**
     * Translate medical terms with context
     */
    async translateMedicalText(text, options) {
        try {
            // Add medical context to improve translation accuracy
            const contextualText = `Medical context: ${text}`;
            const translation = await this.translateText(contextualText, options);
            // Remove the context prefix from translation
            return translation.replace(/^[^:]*:\s*/, '');
        }
        catch (error) {
            logger_1.logger.error('Medical text translation failed:', error);
            return await this.translateText(text, options);
        }
    }
    /**
     * Translate appointment confirmation message
     */
    async translateAppointmentMessage(templateType, data, targetLanguage) {
        try {
            let template = '';
            switch (templateType) {
                case 'confirmation':
                    template = `Your appointment with Dr. ${data.doctorName} is confirmed for ${data.date} at ${data.time}. Please arrive 15 minutes early.`;
                    break;
                case 'reminder':
                    template = `Reminder: You have an appointment with Dr. ${data.doctorName} tomorrow at ${data.time}. Location: ${data.location}`;
                    break;
                case 'cancellation':
                    template = `Your appointment with Dr. ${data.doctorName} scheduled for ${data.date} has been cancelled. Please reschedule if needed.`;
                    break;
            }
            return await this.translateText(template, { targetLanguage });
        }
        catch (error) {
            logger_1.logger.error('Appointment message translation failed:', error);
            throw error;
        }
    }
    /**
     * Get supported languages
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }
    /**
     * Check if language is supported
     */
    isLanguageSupported(languageCode) {
        return this.supportedLanguages.some(lang => lang.code === languageCode);
    }
    /**
     * Get language name by code
     */
    getLanguageName(languageCode) {
        const language = this.supportedLanguages.find(lang => lang.code === languageCode);
        return language ? language.name : languageCode;
    }
    /**
     * Translate symptom descriptions for AI analysis
     */
    async translateSymptomsForAI(symptoms, targetLanguage = 'en') {
        try {
            if (targetLanguage === 'en') {
                return symptoms; // No translation needed
            }
            const translatedSymptoms = await this.translateBatch(symptoms, {
                targetLanguage: 'en', // Always translate to English for AI processing
                sourceLanguage: targetLanguage
            });
            return translatedSymptoms;
        }
        catch (error) {
            logger_1.logger.error('Symptom translation for AI failed:', error);
            return symptoms; // Return original if translation fails
        }
    }
    /**
     * Translate AI response back to user's language
     */
    async translateAIResponse(response, targetLanguage) {
        try {
            if (targetLanguage === 'en') {
                return response; // No translation needed
            }
            return await this.translateMedicalText(response, { targetLanguage });
        }
        catch (error) {
            logger_1.logger.error('AI response translation failed:', error);
            return response; // Return original if translation fails
        }
    }
}
exports.TranslationService = TranslationService;
exports.translationService = new TranslationService();
//# sourceMappingURL=TranslationService.js.map