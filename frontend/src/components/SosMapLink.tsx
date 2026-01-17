import React, { useMemo } from 'react';

export const SosMapLink: React.FC<{ latitude?: number; longitude?: number }> = ({ latitude, longitude }) => {
  const href = useMemo(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }, [latitude, longitude]);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-blue-700 hover:underline"
    >
      Open in Google Maps
    </a>
  );
};
