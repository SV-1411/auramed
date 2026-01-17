import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';

type SosStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CANCELLED';

interface SosRequest {
  id: string;
  patientId: string;
  assignedAmbulanceId?: string | null;
  status: SosStatus;
  lastLocation: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  distanceKm?: number;
}

function formatCoords(lat?: number, lon?: number) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return 'Unknown';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

const AmbulanceDashboard: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(15);
  const [openSos, setOpenSos] = useState<SosRequest[]>([]);
  const [active, setActive] = useState<SosRequest | null>(null);

  const sortedOpen = useMemo(() => {
    return [...openSos].sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [openSos]);

  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        toast.error('Unable to read your location');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const refreshOpen = async () => {
    if (!myLocation) return;
    try {
      const res = await axios.get('/api/sos/open', {
        params: {
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          radiusKm
        }
      });
      setOpenSos(res.data.data.sos || []);
    } catch {
      setOpenSos([]);
    }
  };

  useEffect(() => {
    refreshOpen();
  }, [myLocation, radiusKm]);

  useEffect(() => {
    if (!socket) return;

    const onNew = (sos: SosRequest) => {
      setOpenSos((prev) => {
        if (prev.some((p) => p.id === sos.id)) return prev;
        return [sos, ...prev];
      });
      toast.error('New SOS received');
    };

    const onUpdated = (sos: SosRequest) => {
      setOpenSos((prev) => prev.map((p) => (p.id === sos.id ? { ...p, ...sos } : p)));
      setActive((prev) => (prev?.id === sos.id ? { ...prev, ...sos } : prev));
    };

    const onAssigned = (sos: SosRequest) => {
      setOpenSos((prev) => prev.filter((p) => p.id !== sos.id));
      setActive(sos);
      toast.success('SOS assigned');
    };

    const onResolved = (sos: SosRequest) => {
      setActive((prev) => (prev?.id === sos.id ? sos : prev));
    };

    socket.on('sos:new', onNew);
    socket.on('sos:updated', onUpdated);
    socket.on('sos:assigned', onAssigned);
    socket.on('sos:resolved', onResolved);

    return () => {
      socket.off('sos:new', onNew);
      socket.off('sos:updated', onUpdated);
      socket.off('sos:assigned', onAssigned);
      socket.off('sos:resolved', onResolved);
    };
  }, [socket]);

  const accept = async (sosId: string) => {
    if (!socket || !isConnected) {
      toast.error('Not connected');
      return;
    }

    const ack = await new Promise<{ ok: boolean; sos?: SosRequest; error?: string }>((resolve) => {
      socket.emit('ambulance:accept', { sosId }, (a: any) => resolve(a));
    });

    if (!ack.ok || !ack.sos) {
      toast.error(ack.error || 'Failed to accept');
      return;
    }

    setActive(ack.sos);
    setOpenSos((prev) => prev.filter((p) => p.id !== sosId));
  };

  const resolve = async () => {
    if (!active || !socket || !isConnected) return;

    const ack = await new Promise<{ ok: boolean; sos?: SosRequest; error?: string }>((resolve) => {
      socket.emit('ambulance:resolve', { sosId: active.id }, (a: any) => resolve(a));
    });

    if (!ack.ok || !ack.sos) {
      toast.error(ack.error || 'Failed to resolve');
      return;
    }

    setActive(ack.sos);
    toast.success('Resolved');
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ambulance Dashboard</h1>
            <p className="text-sm text-gray-600">Nearby SOS feed + live updates.</p>
          </div>
          <div className={`text-xs px-2 py-1 rounded border ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {isConnected ? 'Connected' : 'Offline'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-6 border border-gray-100">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="font-semibold text-gray-900">Open SOS nearby</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value) || 15)}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                />
                <div className="text-sm text-gray-600">km</div>
                <button
                  onClick={refreshOpen}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            {!myLocation && (
              <div className="text-sm text-gray-600">Waiting for your location…</div>
            )}

            {myLocation && sortedOpen.length === 0 && (
              <div className="text-sm text-gray-600">No open SOS in your radius.</div>
            )}

            <div className="space-y-3">
              {sortedOpen.map((s) => (
                <div key={s.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">SOS #{s.id.slice(-6)}</div>
                    <div className="text-xs text-gray-600">Coords: {formatCoords(s.lastLocation?.latitude, s.lastLocation?.longitude)}</div>
                    <div className="text-xs text-gray-600">Distance: {typeof s.distanceKm === 'number' ? `${s.distanceKm.toFixed(1)} km` : '—'}</div>
                    {s.notes && <div className="text-xs text-gray-700 mt-1">Notes: {s.notes}</div>}
                  </div>
                  <button
                    onClick={() => accept(s.id)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
            <div className="font-semibold text-gray-900 mb-3">Active Assignment</div>
            {!active && <div className="text-sm text-gray-600">No active SOS assigned.</div>}

            {active && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-lg font-semibold">{active.status}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs text-gray-500">Patient location</div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">{formatCoords(active.lastLocation?.latitude, active.lastLocation?.longitude)}</div>
                </div>
                <button
                  onClick={resolve}
                  disabled={active.status !== 'ASSIGNED'}
                  className={`w-full px-4 py-2 rounded-xl font-semibold ${active.status === 'ASSIGNED' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                >
                  Mark Resolved
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbulanceDashboard;
