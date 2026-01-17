import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

function requireLocation(loc: any) {
  if (!loc || typeof loc !== 'object') return false;
  return typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
}

router.post(
  '/',
  authenticateToken,
  requireRole('PATIENT'),
  [
    body('location').custom((v) => requireLocation(v)).withMessage('location {latitude, longitude} is required'),
    body('notes').optional().isString()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const patientId = (req as any).user.userId as string;
      const { location, notes } = req.body;
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;

      // Prevent multiple active SOS requests
      const existing = await sosDelegate.findFirst({
        where: {
          patientId,
          status: { in: ['OPEN', 'ASSIGNED'] }
        }
      });
      if (existing) {
        return res.status(200).json({
          status: 'success',
          data: { sos: existing }
        });
      }

      const sos = await sosDelegate.create({
        data: {
          patientId,
          status: 'OPEN',
          lastLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address,
            timestamp: new Date().toISOString()
          },
          notes
        }
      });

      res.status(201).json({
        status: 'success',
        data: { sos }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:sosId/location',
  authenticateToken,
  requireRole('PATIENT'),
  [body('location').custom((v) => requireLocation(v)).withMessage('location {latitude, longitude} is required')],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const patientId = (req as any).user.userId as string;
      const { sosId } = req.params;
      const { location } = req.body;
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;

      const sos = await sosDelegate.findFirst({
        where: {
          id: sosId,
          patientId,
          status: { in: ['OPEN', 'ASSIGNED'] }
        }
      });
      if (!sos) throw createError('SOS request not found', 404);

      const updated = await sosDelegate.update({
        where: { id: sosId },
        data: {
          lastLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address,
            timestamp: new Date().toISOString()
          }
        }
      });

      res.json({
        status: 'success',
        data: { sos: updated }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:sosId/cancel',
  authenticateToken,
  requireRole('PATIENT'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = (req as any).user.userId as string;
      const { sosId } = req.params;
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;

      const sos = await sosDelegate.findFirst({
        where: { id: sosId, patientId, status: { in: ['OPEN', 'ASSIGNED'] } }
      });
      if (!sos) throw createError('SOS request not found', 404);

      const updated = await sosDelegate.update({
        where: { id: sosId },
        data: { status: 'CANCELLED' }
      });

      res.json({
        status: 'success',
        data: { sos: updated }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/my/active',
  authenticateToken,
  requireRole('PATIENT'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = (req as any).user.userId as string;
      const db = getDatabase();

      const sos = await (db as any).sOSRequest.findFirst({
        where: { patientId, status: { in: ['OPEN', 'ASSIGNED'] } }
      });

      res.json({
        status: 'success',
        data: { sos }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/open',
  authenticateToken,
  requireRole('AMBULANCE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { latitude, longitude, radiusKm = '15' } = req.query;
      const lat = Number(latitude);
      const lon = Number(longitude);
      const radius = Number(radiusKm);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ error: 'latitude and longitude query params are required' });
      }

      const db = getDatabase();
      const open = await (db as any).sOSRequest.findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' }
      });

      const withDistance = open
        .map((s: any) => {
          const loc = s.lastLocation as any;
          if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
          const distanceKm = haversineKm({ latitude: lat, longitude: lon }, { latitude: loc.latitude, longitude: loc.longitude });
          return { ...s, distanceKm };
        })
        .filter((x: any) => x && x.distanceKm <= radius)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

      res.json({
        status: 'success',
        data: { sos: withDistance }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:sosId/accept',
  authenticateToken,
  requireRole('AMBULANCE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ambulanceId = (req as any).user.userId as string;
      const { sosId } = req.params;
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;

      const sos = await sosDelegate.findFirst({
        where: { id: sosId, status: 'OPEN' }
      });
      if (!sos) throw createError('SOS request not found or already assigned', 404);

      const updated = await sosDelegate.update({
        where: { id: sosId },
        data: { status: 'ASSIGNED', assignedAmbulanceId: ambulanceId }
      });

      res.json({
        status: 'success',
        data: { sos: updated }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:sosId/resolve',
  authenticateToken,
  requireRole('AMBULANCE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ambulanceId = (req as any).user.userId as string;
      const { sosId } = req.params;
      const db = getDatabase();
      const sosDelegate = (db as any).sOSRequest;

      const sos = await sosDelegate.findFirst({
        where: { id: sosId, assignedAmbulanceId: ambulanceId, status: 'ASSIGNED' }
      });
      if (!sos) throw createError('SOS request not found', 404);

      const updated = await sosDelegate.update({
        where: { id: sosId },
        data: { status: 'RESOLVED' }
      });

      res.json({
        status: 'success',
        data: { sos: updated }
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
