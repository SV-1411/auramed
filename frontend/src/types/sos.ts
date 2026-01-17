export type SosStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CANCELLED';

export interface SosLocation {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp?: string;
}

export interface SosRequest {
  id: string;
  patientId: string;
  assignedAmbulanceId?: string | null;
  status: SosStatus;
  lastLocation: SosLocation;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  distanceKm?: number;
}
