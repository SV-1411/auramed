import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { OpenAIService } from '../services/OpenAIService';
import { translationService } from '../services/TranslationService';

const router = express.Router();
const openAIService = new OpenAIService();

// Supported languages with their codes and native names (matching frontend)
const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  hi: { name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' }
};

// Medical terminology dictionary for accurate translations
const MEDICAL_TERMS = {
  en: {
    'headache': 'headache',
    'fever': 'fever',
    'cough': 'cough',
    'nausea': 'nausea',
    'vomiting': 'vomiting',
    'diarrhea': 'diarrhea',
    'chest pain': 'chest pain',
    'shortness of breath': 'shortness of breath',
    'abdominal pain': 'abdominal pain',
    'back pain': 'back pain'
  },
  hi: {
    'headache': 'सिरदर्द',
    'fever': 'बुखार',
    'cough': 'खांसी',
    'nausea': 'जी मिचलाना',
    'vomiting': 'उल्टी',
    'diarrhea': 'दस्त',
    'chest pain': 'छाती में दर्द',
    'shortness of breath': 'सांस लेने में तकलीफ',
    'abdominal pain': 'पेट में दर्द',
    'back pain': 'पीठ में दर्द'
  }
};

// Translate medical text (matching frontend expectations)
router.post('/translate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { text, sourceLanguage, targetLanguage, context } = req.body;

    if (!text || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({
        error: 'Text, source language, and target language are required'
      });
    }

    if (!SUPPORTED_LANGUAGES[sourceLanguage as keyof typeof SUPPORTED_LANGUAGES] || !SUPPORTED_LANGUAGES[targetLanguage as keyof typeof SUPPORTED_LANGUAGES]) {
      return res.status(400).json({
        error: 'Unsupported language code'
      });
    }

    // Detect medical terms in the source text
    const medicalTerms = detectMedicalTerms(text, sourceLanguage);

    // Create translation prompt
    const prompt = createTranslationPrompt(text, sourceLanguage, targetLanguage, context, medicalTerms);

    // Get translation from AI service
    const translatedText = await openAIService.generateResponse(
      'You are a medical translation specialist. Translate medical text accurately while preserving medical terminology meanings.',
      prompt,
      req.user?.id || 'system'
    );

    // Extract medical term translations from AI response
    const termTranslations = extractMedicalTermTranslations(translatedText, medicalTerms, targetLanguage);

    const result = {
      originalText: text,
      translatedText: translatedText,
      sourceLanguage,
      targetLanguage,
      medicalTerms: termTranslations,
      confidence: calculateTranslationConfidence(text, translatedText),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: { translation: result }
    });

  } catch (error) {
    logger.error('Translation error:', error);
    res.status(500).json({
      error: 'Translation service temporarily unavailable'
    });
  }
});

// AI Chat in preferred language (matching frontend expectations)
router.post('/chat', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { message, preferredLanguage, medicalContext } = req.body;

    if (!message || !preferredLanguage) {
      return res.status(400).json({
        error: 'Message and preferred language are required'
      });
    }

    // Create system prompt based on language and context
    const systemPrompt = createChatPrompt(preferredLanguage, medicalContext);

    // Get AI response
    const aiResponse = await openAIService.generateResponse(
      systemPrompt,
      message,
      req.user?.id || 'system',
      'smart'
    );

    // If user is asking in a different language, detect and respond accordingly
    const detectedLanguage = detectLanguage(message);
    let translatedResponse = aiResponse;

    // If detected language differs from preferred, translate response
    if (detectedLanguage !== preferredLanguage) {
      const translationPrompt = `Translate this medical response to ${SUPPORTED_LANGUAGES[preferredLanguage as keyof typeof SUPPORTED_LANGUAGES].nativeName}: ${aiResponse}`;
      translatedResponse = await openAIService.generateResponse(
        'You are a medical translator. Provide accurate translations.',
        translationPrompt,
        req.user?.id || 'system'
      );
    }

    res.json({
      success: true,
      data: {
        response: translatedResponse,
        originalResponse: aiResponse,
        language: preferredLanguage,
        detectedLanguage,
        medicalContext,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI Chat error:', error);
    res.status(500).json({
      error: 'AI chat service temporarily unavailable'
    });
  }
});

// Get supported languages (matching frontend expectations)
router.get('/languages', authenticateToken, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      languages: SUPPORTED_LANGUAGES,
      medicalSupport: true,
      totalLanguages: Object.keys(SUPPORTED_LANGUAGES).length
    }
  });
});

// Get translation history (placeholder for now)
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    // This would typically fetch from database
    res.json({
      success: true,
      data: {
        translations: [],
        total: 0
      }
    });
  } catch (error) {
    logger.error('Translation history error:', error);
    res.status(500).json({
      error: 'Failed to fetch translation history'
    });
  }
});

// Legacy endpoints (keeping for backward compatibility)
router.post('/translate-medical', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Text and target language are required' });
    }

    const translatedText = await translationService.translateMedicalText(text, {
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

  } catch (error) {
    logger.error('Medical translation failed:', error);
    res.status(500).json({ error: 'Medical translation failed' });
  }
});

// Helper functions
function detectMedicalTerms(text: string, language: string): string[] {
  const terms: string[] = [];
  const medicalDict = MEDICAL_TERMS[language as keyof typeof MEDICAL_TERMS];

  if (medicalDict) {
    for (const [term, translation] of Object.entries(medicalDict)) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        terms.push(term);
      }
    }
  }

  return terms;
}

function createTranslationPrompt(
  text: string,
  sourceLang: string,
  targetLang: string,
  context: string,
  medicalTerms: string[]
): string {
  const sourceName = SUPPORTED_LANGUAGES[sourceLang as keyof typeof SUPPORTED_LANGUAGES]?.nativeName || sourceLang;
  const targetName = SUPPORTED_LANGUAGES[targetLang as keyof typeof SUPPORTED_LANGUAGES]?.nativeName || targetLang;

  let prompt = `Translate the following ${context === 'medical' ? 'medical ' : ''}text from ${sourceName} to ${targetName}:\n\n"${text}"\n\n`;

  if (medicalTerms.length > 0) {
    prompt += `Important medical terms to preserve accuracy: ${medicalTerms.join(', ')}\n\n`;
  }

  prompt += `Please provide:\n1. Accurate translation\n2. Any medical term explanations if needed\n3. Cultural considerations for healthcare context\n\nTranslation:`;

  return prompt;
}

function extractMedicalTermTranslations(
  translatedText: string,
  originalTerms: string[],
  targetLang: string
): Array<{ term: string; translation: string; explanation: string }> {
  const translations: Array<{ term: string; translation: string; explanation: string }> = [];

  for (const term of originalTerms) {
    const targetDict = MEDICAL_TERMS[targetLang as keyof typeof MEDICAL_TERMS];
    if (targetDict && targetDict[term as keyof typeof targetDict]) {
      translations.push({
        term: term,
        translation: targetDict[term as keyof typeof targetDict],
        explanation: `Medical term: ${term} in ${SUPPORTED_LANGUAGES[targetLang as keyof typeof SUPPORTED_LANGUAGES]?.nativeName || targetLang}`
      });
    }
  }

  return translations;
}

function calculateTranslationConfidence(originalText: string, translatedText: string): number {
  const ratio = translatedText.length / originalText.length;
  if (ratio > 0.5 && ratio < 2.0) {
    return 0.85;
  } else if (ratio > 0.3 && ratio < 3.0) {
    return 0.65;
  } else {
    return 0.45;
  }
}

function createChatPrompt(language: string, medicalContext: boolean): string {
  const langInfo = SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES];

  let prompt = `You are AuraMed's AI healthcare assistant. `;

  if (langInfo) {
    prompt += `Respond in ${langInfo.nativeName} (${langInfo.name}). `;
  }

  if (medicalContext) {
    prompt += `Provide medically accurate information. Use clear, simple language. Always recommend consulting healthcare professionals for serious concerns. Focus on general health guidance and education.`;
  } else {
    prompt += `Provide general health information and guidance.`;
  }

  return prompt;
}

function detectLanguage(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
}

export default router;
