import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as Tesseract from 'tesseract.js';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { OpenAIService } from '../services/OpenAIService';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

const uploadsRoot = path.resolve(__dirname, '../../uploads/prescriptions');
fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsRoot),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'prescription').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }
});

function fileToDataUrl(filePath: string, mimeType: string) {
  const buf = fs.readFileSync(filePath);
  const b64 = buf.toString('base64');
  return `data:${mimeType};base64,${b64}`;
}

function safeParseJsonObject(raw: string): { ok: boolean; value?: any; warning?: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, warning: 'Extraction failed: empty response' };

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    // continue
  }

  // Strip markdown code fences if present
  const withoutFences = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    return { ok: true, value: JSON.parse(withoutFences) };
  } catch {
    // continue
  }

  // Extract first {...} block (common when model wraps JSON in explanation)
  const firstObjMatch = withoutFences.match(/\{[\s\S]*\}/);
  if (firstObjMatch?.[0]) {
    try {
      return { ok: true, value: JSON.parse(firstObjMatch[0]) };
    } catch {
      // ignore
    }
  }

  return { ok: false, warning: 'Extraction failed: invalid JSON response' };
}

async function ocrImageToText(absoluteFilePath: string) {
  const result = await (Tesseract as any).recognize(absoluteFilePath, 'eng');
  const text = String(result?.data?.text || '').trim();
  return text;
}

function normalizeExtractedShape(extracted: any) {
  const normalized = extracted && typeof extracted === 'object' ? extracted : {};

  if (!('patientName' in normalized)) normalized.patientName = null;
  if (!('doctorName' in normalized)) normalized.doctorName = null;
  if (!('clinic' in normalized)) normalized.clinic = null;
  if (!('date' in normalized)) normalized.date = null;
  if (!Array.isArray(normalized.medicines)) normalized.medicines = [];
  if (!('notes' in normalized)) normalized.notes = null;
  if (!Array.isArray(normalized.warnings)) normalized.warnings = [];

  return normalized;
}

router.get('/', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.userId as string;
    const db = getDatabase();
    const docDelegate = (db as any).prescriptionDocument;

    const docs = await docDelegate.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ status: 'success', data: { documents: docs } });
  } catch (err) {
    next(err);
  }
});

router.get('/:documentId', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.userId as string;
    const { documentId } = req.params;
    const db = getDatabase();
    const docDelegate = (db as any).prescriptionDocument;

    const doc = await docDelegate.findUnique({ where: { id: documentId } });
    if (!doc) throw createError('Document not found', 404);
    if (doc.patientId !== patientId) throw createError('Forbidden', 403);

    res.json({ status: 'success', data: { document: doc } });
  } catch (err) {
    next(err);
  }
});

router.delete('/:documentId', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.userId as string;
    const { documentId } = req.params;
    const db = getDatabase();
    const docDelegate = (db as any).prescriptionDocument;

    const doc = await docDelegate.findUnique({ where: { id: documentId } });
    if (!doc) throw createError('Document not found', 404);
    if (doc.patientId !== patientId) throw createError('Forbidden', 403);

    try {
      const absoluteFilePath = path.resolve(__dirname, '../../', doc.fileUrl.replace(/^\//, ''));
      if (fs.existsSync(absoluteFilePath)) fs.unlinkSync(absoluteFilePath);
    } catch {
      // ignore
    }

    await docDelegate.delete({ where: { id: documentId } });
    res.json({ status: 'success', data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/upload',
  authenticateToken,
  requireRole('PATIENT'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = (req as any).user.userId as string;
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) throw createError('No file uploaded', 400);

      const db = getDatabase();
      const docDelegate = (db as any).prescriptionDocument;

      const fileUrl = `/uploads/prescriptions/${path.basename(file.path)}`;

      const doc = await docDelegate.create({
        data: {
          patientId,
          fileUrl,
          mimeType: file.mimetype,
          originalName: file.originalname,
          status: 'UPLOADED'
        }
      });

      res.status(201).json({ status: 'success', data: { document: doc } });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/extract/:documentId', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.userId as string;
    const { documentId } = req.params;

    const db = getDatabase();
    const docDelegate = (db as any).prescriptionDocument;

    const doc = await docDelegate.findUnique({ where: { id: documentId } });
    if (!doc) throw createError('Document not found', 404);
    if (doc.patientId !== patientId) throw createError('Forbidden', 403);

    await docDelegate.update({ where: { id: documentId }, data: { status: 'EXTRACTING' } });

    const absoluteFilePath = path.resolve(__dirname, '../../', doc.fileUrl.replace(/^\//, ''));
    if (!fs.existsSync(absoluteFilePath)) {
      await docDelegate.update({ where: { id: documentId }, data: { status: 'FAILED' } });
      throw createError('Uploaded file is missing on server', 500);
    }

    const openAI = new OpenAIService();

    const prompt = `You are a medical document extraction assistant.
Extract structured medication information from a prescription image/PDF.
Return STRICT JSON ONLY in this format:
{
  "patientName": string|null,
  "doctorName": string|null,
  "clinic": string|null,
  "date": string|null,
  "medicines": [
    {
      "medicationName": string,
      "genericName": string|null,
      "dosage": string|null,
      "frequency": string|null,
      "duration": string|null,
      "instructions": string|null
    }
  ],
  "notes": string|null,
  "warnings": [string]
}
If you are uncertain about a field, set it to null.
If no medicines are found, return an empty medicines array.`;

    const dataUrl = fileToDataUrl(absoluteFilePath, doc.mimeType);

    // Option A: Vision first (send actual image_url part so the model can see the file)
    const visionResponse = await openAI.generateResponse(
      'You extract structured data from prescription documents and must respond with JSON only.',
      [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ],
      patientId,
      'smart',
      { responseFormat: 'json_object' }
    );

    let extracted: any = null;
    const visionParsed = safeParseJsonObject(visionResponse);
    if (visionParsed.ok) {
      extracted = normalizeExtractedShape(visionParsed.value);
    } else {
      extracted = normalizeExtractedShape({ medicines: [], notes: null, warnings: [visionParsed.warning || 'Extraction failed: invalid JSON response'] });
    }

    // Option B: OCR fallback if vision produced no medicines
    const shouldOcrFallback = Array.isArray(extracted?.medicines) && extracted.medicines.length === 0;
    const isImage = String(doc.mimeType || '').toLowerCase().startsWith('image/');

    if (shouldOcrFallback && isImage) {
      const ocrText = await ocrImageToText(absoluteFilePath);
      if (ocrText) {
        const ocrResponse = await openAI.generateResponse(
          'You extract structured data from prescription documents and must respond with JSON only.',
          `${prompt}\n\nOCR_TEXT:\n${ocrText}`,
          patientId,
          'smart',
          { responseFormat: 'json_object' }
        );

        const ocrParsed = safeParseJsonObject(ocrResponse);
        if (ocrParsed.ok) {
          const ocrExtracted = normalizeExtractedShape(ocrParsed.value);
          if (Array.isArray(ocrExtracted.medicines) && ocrExtracted.medicines.length > 0) {
            extracted = ocrExtracted;
            extracted.warnings = Array.isArray(extracted.warnings) ? extracted.warnings : [];
            extracted.warnings.push('Used OCR fallback for extraction');
          } else {
            extracted.warnings = Array.isArray(extracted.warnings) ? extracted.warnings : [];
            extracted.warnings.push('OCR fallback did not find any medicines');
          }
        } else {
          extracted.warnings = Array.isArray(extracted.warnings) ? extracted.warnings : [];
          extracted.warnings.push(ocrParsed.warning || 'OCR fallback failed: invalid JSON response');
        }
      } else {
        extracted.warnings = Array.isArray(extracted.warnings) ? extracted.warnings : [];
        extracted.warnings.push('OCR fallback produced empty text');
      }
    } else if (shouldOcrFallback && !isImage) {
      extracted.warnings = Array.isArray(extracted.warnings) ? extracted.warnings : [];
      extracted.warnings.push('OCR fallback not supported for non-image files');
    }

    const updated = await docDelegate.update({
      where: { id: documentId },
      data: { status: 'EXTRACTED', extracted }
    });

    res.json({ status: 'success', data: { document: updated } });
  } catch (err) {
    try {
      const db = getDatabase();
      const docDelegate = (db as any).prescriptionDocument;
      const { documentId } = (req as any).params || {};
      if (documentId) {
        await docDelegate.update({ where: { id: documentId }, data: { status: 'FAILED' } }).catch(() => null);
      }
    } catch {
      // ignore
    }
    next(err);
  }
});

export default router;
