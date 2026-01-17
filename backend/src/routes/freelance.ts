import express, { NextFunction, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getDatabase } from '../config/database';

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

function asLoc(loc: any): { latitude: number; longitude: number } | null {
  if (!loc || typeof loc !== 'object') return null;
  if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
  return { latitude: loc.latitude, longitude: loc.longitude };
}

router.get('/doctors/nearby', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude, radiusKm = '10' } = req.query;
    const lat = Number(latitude);
    const lon = Number(longitude);
    const radius = Number(radiusKm);

    const db = getDatabase();
    const sessionDelegate = (db as any).freelanceDoctorSession;
    const userDelegate = (db as any).user;

    const sessions = await sessionDelegate.findMany({ where: { isOnline: true } });

    const withDistance = sessions
      .map((s: any) => {
        const loc = asLoc(s.lastLocation);
        if (!loc) return null;
        const d = haversineKm({ latitude: lat, longitude: lon }, loc);
        return { ...s, distanceKm: d };
      })
      .filter((x: any) => x && x.distanceKm <= radius)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, 20);

    const doctorIds = withDistance.map((x: any) => x.doctorId);
    const doctors = await userDelegate.findMany({
      where: { id: { in: doctorIds } },
      include: { doctorProfile: true }
    });
    const doctorById = new Map(doctors.map((d: any) => [d.id, d]));

    res.json({
      status: 'success',
      data: {
        doctors: withDistance.map((s: any) => {
          const d = doctorById.get(s.doctorId);
          return {
            doctorId: s.doctorId,
            distanceKm: s.distanceKm,
            lastLocation: s.lastLocation,
            doctor: d
              ? {
                  id: d.id,
                  name: `${d.doctorProfile?.firstName || ''} ${d.doctorProfile?.lastName || ''}`.trim(),
                  profile: d.doctorProfile
                }
              : null
          };
        })
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/requests/my/active', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.userId as string;
    const db = getDatabase();
    const reqDelegate = (db as any).freelanceRequest;

    const request = await reqDelegate.findFirst({
      where: { patientId, status: { in: ['REQUESTED', 'OFFERED', 'ACCEPTED'] } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ status: 'success', data: { request } });
  } catch (err) {
    next(err);
  }
});

export default router;
