import axios from 'axios';
import type { SosRequest } from '../types/sos';

export async function getMyActiveSos(): Promise<SosRequest | null> {
  const res = await axios.get('/api/sos/my/active');
  return res.data.data.sos || null;
}

export async function cancelSos(sosId: string): Promise<SosRequest> {
  const res = await axios.post(`/api/sos/${sosId}/cancel`);
  return res.data.data.sos;
}

export async function listOpenSos(params: { latitude: number; longitude: number; radiusKm?: number }): Promise<SosRequest[]> {
  const res = await axios.get('/api/sos/open', { params });
  return res.data.data.sos || [];
}
