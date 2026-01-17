import React from 'react';
import type { SosStatus } from '../types/sos';

export const SosStatusPill: React.FC<{ status?: SosStatus | null }> = ({ status }) => {
  const s = status || 'CANCELLED';
  const styles: Record<string, string> = {
    OPEN: 'bg-red-50 text-red-700 border-red-200',
    ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
    RESOLVED: 'bg-green-50 text-green-700 border-green-200',
    CANCELLED: 'bg-gray-50 text-gray-700 border-gray-200'
  };

  return (
    <span className={`text-xs px-2 py-1 rounded border ${styles[s] || styles.CANCELLED}`}>
      {status || '—'}
    </span>
  );
};
