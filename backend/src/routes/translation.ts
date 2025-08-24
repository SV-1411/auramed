import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { translationService } from '../services/TranslationService';
import { logger } from '../utils/logger';

const router = express.Router();

// Get supported languages
router.get('/languages', (req: Request, res: Response) => {
  try {
    const languages = translationService.getSupportedLanguages();
    res.json({
      success: true,
      data: { languages }
    });
  } catch (error) {
    logger.error('Failed to get supported languages:', error);
    res.status(500).json({ error: 'Failed to get supported languages' });
  }
});

// Translate text
router.post('/translate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Text and target language are required' });
    }

    const translatedText = await translationService.translateText(text, {
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
    logger.error('Translation failed:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Translate medical text with context
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

// Detect language of text
router.post('/detect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const detectedLanguage = await translationService.detectLanguage(text);
    const languageName = translationService.getLanguageName(detectedLanguage);

    res.json({
      success: true,
      data: {
        text,
        detectedLanguage,
        languageName
      }
    });

  } catch (error) {
    logger.error('Language detection failed:', error);
    res.status(500).json({ error: 'Language detection failed' });
  }
});

// Translate appointment message
router.post('/appointment-message', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { templateType, data, targetLanguage } = req.body;

    if (!templateType || !data || !targetLanguage) {
      return res.status(400).json({ 
        error: 'Template type, data, and target language are required' 
      });
    }

    const translatedMessage = await translationService.translateAppointmentMessage(
      templateType,
      data,
      targetLanguage
    );

    res.json({
      success: true,
      data: {
        templateType,
        translatedMessage,
        targetLanguage
      }
    });

  } catch (error) {
    logger.error('Appointment message translation failed:', error);
    res.status(500).json({ error: 'Appointment message translation failed' });
  }
});

// Batch translate multiple texts
router.post('/batch', authenticateToken, async (req: Request, res: Response) => {
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

    const translatedTexts = await translationService.translateBatch(texts, {
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

  } catch (error) {
    logger.error('Batch translation failed:', error);
    res.status(500).json({ error: 'Batch translation failed' });
  }
});

export default router;
