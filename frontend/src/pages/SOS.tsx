import React, { useEffect, useMemo, useRef, useState } from 'react';
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
}

function formatCoords(lat?: number, lon?: number) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return 'Unknown';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

const SOS: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [activeSos, setActiveSos] = useState<SosRequest | null>(null);
  const [notes, setNotes] = useState('');
  const [tracking, setTracking] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const canTrigger = useMemo(() => {
    return isConnected && !!socket && !tracking && (!activeSos || activeSos.status === 'CANCELLED' || activeSos.status === 'RESOLVED');
  }, [activeSos, isConnected, socket, tracking]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/api/sos/my/active');
        setActiveSos(res.data.data.sos || null);
      } catch {
        setActiveSos(null);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onAssigned = (sos: SosRequest) => setActiveSos(sos);
    const onUpdated = (sos: SosRequest) => setActiveSos(sos);
    const onResolved = (sos: SosRequest) => setActiveSos(sos);

    socket.on('sos:assigned', onAssigned);
    socket.on('sos:updated', onUpdated);
    socket.on('sos:resolved', onResolved);

    return () => {
      socket.off('sos:assigned', onAssigned);
      socket.off('sos:updated', onUpdated);
      socket.off('sos:resolved', onResolved);
    };
  }, [socket]);

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  };

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const createSos = async () => {
    if (!socket || !isConnected) {
      toast.error('Not connected to emergency network');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
    });

    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };

    const response = await new Promise<{ ok: boolean; sos?: SosRequest; error?: string }>((resolve) => {
      socket.emit('sos:create', { location, notes }, (ack: any) => resolve(ack));
    });

    if (!response.ok || !response.sos) {
      toast.error(response.error || 'Failed to trigger SOS');
      return;
    }

    setActiveSos(response.sos);
    toast.success('SOS sent. Stay calm—help is being dispatched.');

    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };

        if (!socket) return;
        if (!response.sos?.id) return;

        socket.emit('sos:update-location', { sosId: response.sos.id, location: loc }, (ack: any) => {
          if (ack?.ok) {
            setLastSentAt(new Date().toLocaleTimeString());
          }
        });
      },
      () => {
        toast.error('Unable to read live location');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000
      }
    );
  };

  const cancelSos = async () => {
    if (!activeSos) return;
    try {
      await axios.post(`/api/sos/${activeSos.id}/cancel`);
      stopTracking();
      setActiveSos((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev));
      toast.success('SOS cancelled');
    } catch {
      toast.error('Failed to cancel SOS');
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency SOS</h1>
            <p className="text-sm text-gray-600">One-tap ambulance request with live location tracking.</p>
          </div>
          <div className={`text-xs px-2 py-1 rounded border ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {isConnected ? 'Connected' : 'Offline'}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">{activeSos?.status || 'NO ACTIVE SOS'}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs text-gray-500">Last known location</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {formatCoords(activeSos?.lastLocation?.latitude, activeSos?.lastLocation?.longitude)}
              </div>
              {lastSentAt && <div className="text-xs text-gray-500 mt-1">Last sent: {lastSentAt}</div>}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="Describe the emergency (e.g., unconscious, chest pain, accident)"
            />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={createSos}
              disabled={!canTrigger}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-semibold text-white ${canTrigger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 cursor-not-allowed'}`}
            >
              Trigger SOS
            </button>

            <button
              onClick={cancelSos}
              disabled={!activeSos || (activeSos.status !== 'OPEN' && activeSos.status !== 'ASSIGNED')}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-semibold border ${activeSos && (activeSos.status === 'OPEN' || activeSos.status === 'ASSIGNED') ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              Cancel
            </button>

            <button
              onClick={stopTracking}
              disabled={!tracking}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-semibold border ${tracking ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              Stop Tracking
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            If you are in immediate danger, call your local emergency number too.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOS;
