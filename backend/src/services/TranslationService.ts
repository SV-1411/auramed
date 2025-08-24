import { Translate } from '@google-cloud/translate/build/src/v2';
import { logger } from '../utils/logger';

export interface TranslationOptions {
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export class TranslationService {
  private translate: Translate;
  private supportedLanguages: SupportedLanguage[] = [
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

  constructor() {
    // Initialize Google Translate with credentials
    this.translate = new Translate({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
    });
  }

  /**
   * Translate text to target language
   */
  async translateText(text: string, options: TranslationOptions): Promise<string> {
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

      logger.info(`Translated text from ${options.sourceLanguage || 'auto'} to ${options.targetLanguage}`);
      return translation;

    } catch (error) {
      logger.error('Translation failed:', error);
      throw new Error('Translation service unavailable');
    }
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(texts: string[], options: TranslationOptions): Promise<string[]> {
    try {
      const translations = await Promise.all(
        texts.map(text => this.translateText(text, options))
      );
      return translations;
    } catch (error) {
      logger.error('Batch translation failed:', error);
      throw error;
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      const [detection] = await this.translate.detect(text);
      const language = Array.isArray(detection) ? detection[0] : detection;
      return language.language;
    } catch (error) {
      logger.error('Language detection failed:', error);
      return 'en'; // Default to English
    }
  }

  /**
   * Translate medical terms with context
   */
  async translateMedicalText(text: string, options: TranslationOptions): Promise<string> {
    try {
      // Add medical context to improve translation accuracy
      const contextualText = `Medical context: ${text}`;
      const translation = await this.translateText(contextualText, options);
      
      // Remove the context prefix from translation
      return translation.replace(/^[^:]*:\s*/, '');
    } catch (error) {
      logger.error('Medical text translation failed:', error);
      return await this.translateText(text, options);
    }
  }

  /**
   * Translate appointment confirmation message
   */
  async translateAppointmentMessage(
    templateType: 'confirmation' | 'reminder' | 'cancellation',
    data: any,
    targetLanguage: string
  ): Promise<string> {
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
    } catch (error) {
      logger.error('Appointment message translation failed:', error);
      throw error;
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return this.supportedLanguages;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return this.supportedLanguages.some(lang => lang.code === languageCode);
  }

  /**
   * Get language name by code
   */
  getLanguageName(languageCode: string): string {
    const language = this.supportedLanguages.find(lang => lang.code === languageCode);
    return language ? language.name : languageCode;
  }

  /**
   * Translate symptom descriptions for AI analysis
   */
  async translateSymptomsForAI(symptoms: string[], targetLanguage: string = 'en'): Promise<string[]> {
    try {
      if (targetLanguage === 'en') {
        return symptoms; // No translation needed
      }

      const translatedSymptoms = await this.translateBatch(symptoms, {
        targetLanguage: 'en', // Always translate to English for AI processing
        sourceLanguage: targetLanguage
      });

      return translatedSymptoms;
    } catch (error) {
      logger.error('Symptom translation for AI failed:', error);
      return symptoms; // Return original if translation fails
    }
  }

  /**
   * Translate AI response back to user's language
   */
  async translateAIResponse(response: string, targetLanguage: string): Promise<string> {
    try {
      if (targetLanguage === 'en') {
        return response; // No translation needed
      }

      return await this.translateMedicalText(response, { targetLanguage });
    } catch (error) {
      logger.error('AI response translation failed:', error);
      return response; // Return original if translation fails
    }
  }
}

export const translationService = new TranslationService();
