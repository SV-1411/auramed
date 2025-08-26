export interface TranslationOptions {
    targetLanguage: string;
    sourceLanguage?: string;
}
export interface SupportedLanguage {
    code: string;
    name: string;
    nativeName: string;
}
export declare class TranslationService {
    private translate;
    private supportedLanguages;
    constructor();
    /**
     * Translate text to target language
     */
    translateText(text: string, options: TranslationOptions): Promise<string>;
    /**
     * Translate multiple texts in batch
     */
    translateBatch(texts: string[], options: TranslationOptions): Promise<string[]>;
    /**
     * Detect language of text
     */
    detectLanguage(text: string): Promise<string>;
    /**
     * Translate medical terms with context
     */
    translateMedicalText(text: string, options: TranslationOptions): Promise<string>;
    /**
     * Translate appointment confirmation message
     */
    translateAppointmentMessage(templateType: 'confirmation' | 'reminder' | 'cancellation', data: any, targetLanguage: string): Promise<string>;
    /**
     * Get supported languages
     */
    getSupportedLanguages(): SupportedLanguage[];
    /**
     * Check if language is supported
     */
    isLanguageSupported(languageCode: string): boolean;
    /**
     * Get language name by code
     */
    getLanguageName(languageCode: string): string;
    /**
     * Translate symptom descriptions for AI analysis
     */
    translateSymptomsForAI(symptoms: string[], targetLanguage?: string): Promise<string[]>;
    /**
     * Translate AI response back to user's language
     */
    translateAIResponse(response: string, targetLanguage: string): Promise<string>;
}
export declare const translationService: TranslationService;
//# sourceMappingURL=TranslationService.d.ts.map