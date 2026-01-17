import React from 'react';
import type { SosRequest } from '../types/sos';
import { SosStatusPill } from './SosStatusPill';
import { SosMapLink } from './SosMapLink';

function formatCoords(lat?: number, lon?: number) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return 'Unknown';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export const SosCard: React.FC<{
  sos: SosRequest;
  action?: React.ReactNode;
}> = ({ sos, action }) => {
  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-gray-900">SOS #{sos.id.slice(-6)}</div>
          <SosStatusPill status={sos.status} />
        </div>
        <div className="text-xs text-gray-600 mt-1">Coords: {formatCoords(sos.lastLocation?.latitude, sos.lastLocation?.longitude)}</div>
        {typeof sos.distanceKm === 'number' && <div className="text-xs text-gray-600">Distance: {sos.distanceKm.toFixed(1)} km</div>}
        {sos.notes && <div className="text-xs text-gray-700 mt-1">Notes: {sos.notes}</div>}
        <div className="mt-2">
          <SosMapLink latitude={sos.lastLocation?.latitude} longitude={sos.lastLocation?.longitude} />
        </div>
      </div>
      {action}
    </div>
  );
};
