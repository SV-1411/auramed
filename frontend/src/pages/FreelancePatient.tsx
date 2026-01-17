import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useI18n } from '../contexts/I18nContext';

type FreelanceRequestStatus = 'REQUESTED' | 'OFFERED' | 'ACCEPTED' | 'CANCELLED' | 'COMPLETED';

type FreelanceRequest = {
  id: string;
  patientId: string;
  assignedDoctorId?: string | null;
  status: FreelanceRequestStatus;
  symptoms: string[];
  pickupLocation: any;
  createdAt: string;
  updatedAt: string;
};

const FreelancePatient: React.FC = () => {
  const { t } = useI18n();
  const { socket, isConnected } = useSocket();
  const { position, error, start, stop } = useGeolocation({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });

  const [symptomsText, setSymptomsText] = useState('');
  const [activeRequest, setActiveRequest] = useState<FreelanceRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [nearbyCount, setNearbyCount] = useState<number>(0);

  const location = useMemo(() => {
    const lat = position?.coords.latitude;
    const lon = position?.coords.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    return { latitude: lat, longitude: lon, address: 'Current Location' };
  }, [position]);

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadActive = async () => {
      try {
        const res = await axios.get('/api/freelance/requests/my/active');
        const req = res.data?.data?.request || null;
        if (req) setActiveRequest(req);
      } catch {
        // ignore
      }
    };
    loadActive();
  }, []);

  useEffect(() => {
    const loadNearby = async () => {
      if (!location) return;
      try {
        const res = await axios.get('/api/freelance/doctors/nearby', {
          params: { latitude: location.latitude, longitude: location.longitude, radiusKm: 10 }
        });
        setNearbyCount((res.data?.data?.doctors || []).length);
      } catch {
        setNearbyCount(0);
      }
    };
    loadNearby();
    const t = setInterval(loadNearby, 10000);
    return () => clearInterval(t);
  }, [location]);

  useEffect(() => {
    if (!socket) return;

    const onUpdated = (evt: any) => {
      if (!evt) return;
      if (evt.requestId && activeRequest?.id && evt.requestId === activeRequest.id) {
        setActiveRequest((prev) => (prev ? { ...prev, status: evt.status } : prev));
      }
    };

    const onAssigned = (req: FreelanceRequest) => {
      setActiveRequest(req);
      toast.success(t('freelance.patient.assigned'));
    };

    socket.on('freelance:request:updated', onUpdated);
    socket.on('freelance:request:assigned', onAssigned);

    return () => {
      socket.off('freelance:request:updated', onUpdated);
      socket.off('freelance:request:assigned', onAssigned);
    };
  }, [activeRequest?.id, socket, t]);

  const createRequest = async () => {
    if (!socket || !isConnected) {
      toast.error(t('freelance.common.not_connected'));
      return;
    }
    if (!location) {
      toast.error(t('freelance.common.location_required'));
      return;
    }

    const symptoms = symptomsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setCreating(true);
    try {
      const ack = await new Promise<{ ok: boolean; request?: FreelanceRequest; error?: string }>((resolve) => {
        socket.emit('freelance:request:create', { location, symptoms }, (a: any) => resolve(a));
      });

      if (!ack.ok || !ack.request) {
        toast.error(ack.error || t('freelance.patient.request_failed'));
        return;
      }

      setActiveRequest(ack.request);
      toast.success(t('freelance.patient.request_created'));
    } finally {
      setCreating(false);
    }
  };

  const cancel = async () => {
    if (!socket || !isConnected || !activeRequest) return;

    setCancelling(true);
    try {
      const ack = await new Promise<{ ok: boolean; request?: FreelanceRequest; error?: string }>((resolve) => {
        socket.emit('freelance:request:cancel', { requestId: activeRequest.id }, (a: any) => resolve(a));
      });
      if (!ack.ok || !ack.request) {
        toast.error(ack.error || t('freelance.patient.cancel_failed'));
        return;
      }
      setActiveRequest(ack.request);
      toast.success(t('freelance.patient.cancelled'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{t('freelance.patient.title')}</h1>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('freelance.patient.subtitle')}</p>
          </div>
          <div className={`text-xs px-2 py-1 rounded border ${isConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {isConnected ? t('freelance.common.connected') : t('freelance.common.disconnected')}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
            <div className="font-semibold text-light-text dark:text-dark-text">{t('freelance.patient.map_title')}</div>
            <div className="mt-3 rounded-xl border border-light-border dark:border-dark-border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 h-64 flex items-center justify-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : (error || t('freelance.common.waiting_location'))}
            </div>

            <div className="mt-4">
              <label className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">{t('freelance.patient.symptoms_label')}</label>
              <input
                value={symptomsText}
                onChange={(e) => setSymptomsText(e.target.value)}
                placeholder={t('freelance.patient.symptoms_placeholder')}
                className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm"
              />
              <div className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('freelance.patient.symptoms_hint')}</div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={createRequest}
                disabled={creating || !!activeRequest && ['REQUESTED','OFFERED','ACCEPTED'].includes(activeRequest.status)}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  creating ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-sapphire-600 hover:bg-sapphire-700 text-white'
                }`}
              >
                {creating ? t('freelance.patient.requesting') : t('freelance.patient.request')}
              </button>

              {activeRequest && ['REQUESTED', 'OFFERED', 'ACCEPTED'].includes(activeRequest.status) ? (
                <button
                  onClick={cancel}
                  disabled={cancelling}
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {cancelling ? t('freelance.patient.cancelling') : t('freelance.patient.cancel')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="font-semibold text-light-text dark:text-dark-text">{t('freelance.patient.status_title')}</div>
              {activeRequest ? (
                <div className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  {t('freelance.patient.status_line', { status: activeRequest.status })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('freelance.patient.no_active')}</div>
              )}
              <div className="mt-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {t('freelance.patient.nearby_line', { count: nearbyCount })}
              </div>
            </div>

            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="font-semibold text-light-text dark:text-dark-text">{t('freelance.patient.flow_title')}</div>
              <div className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line">
                {t('freelance.patient.flow_copy')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreelancePatient;
