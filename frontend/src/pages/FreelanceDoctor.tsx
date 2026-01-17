import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useI18n } from '../contexts/I18nContext';

type Offer = {
  requestId: string;
  patientId: string;
  pickupLocation: any;
  symptoms: string[];
  distanceKm?: number;
};

type FreelanceRequest = {
  id: string;
  patientId: string;
  assignedDoctorId?: string | null;
  status: string;
  pickupLocation: any;
  symptoms: string[];
  createdAt: string;
};

const FreelanceDoctor: React.FC = () => {
  const { t } = useI18n();
  const { socket, isConnected } = useSocket();
  const { position, error, start, stop } = useGeolocation({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });

  const [isOnline, setIsOnline] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [active, setActive] = useState<FreelanceRequest | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (!socket) return;

    const onOffer = (offer: Offer) => {
      setOffers((prev) => {
        if (prev.some((o) => o.requestId === offer.requestId)) return prev;
        return [offer, ...prev].slice(0, 20);
      });
      toast(t('freelance.doctor.new_offer'));
    };

    const onAssigned = (req: FreelanceRequest) => {
      setActive(req);
      setOffers([]);
      toast.success(t('freelance.doctor.assigned'));
    };

    const onUpdated = (evt: any) => {
      if (!evt) return;
      if (evt.requestId && active?.id && evt.requestId === active.id) {
        setActive((prev) => (prev ? { ...prev, status: evt.status } : prev));
      }
    };

    socket.on('freelance:request:offer', onOffer);
    socket.on('freelance:request:assigned', onAssigned);
    socket.on('freelance:request:updated', onUpdated);

    return () => {
      socket.off('freelance:request:offer', onOffer);
      socket.off('freelance:request:assigned', onAssigned);
      socket.off('freelance:request:updated', onUpdated);
    };
  }, [active?.id, socket, t]);

  useEffect(() => {
    if (!socket || !isConnected || !isOnline || !location) return;

    const interval = setInterval(() => {
      socket.emit('freelance:doctor:location', { location }, () => null);
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, isOnline, location, socket]);

  const goOnline = async () => {
    if (!socket || !isConnected) {
      toast.error(t('freelance.common.not_connected'));
      return;
    }
    if (!location) {
      toast.error(t('freelance.common.location_required'));
      return;
    }

    setBusy(true);
    try {
      const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        socket.emit('freelance:doctor:go-online', { location }, (a: any) => resolve(a));
      });
      if (!ack.ok) {
        toast.error(ack.error || t('freelance.doctor.online_failed'));
        return;
      }
      setIsOnline(true);
      toast.success(t('freelance.doctor.online'));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!socket || !isConnected || !active) return;
    setBusy(true);
    try {
      const ack = await new Promise<{ ok: boolean; request?: FreelanceRequest; error?: string }>((resolve) => {
        socket.emit('freelance:request:complete', { requestId: active.id }, (a: any) => resolve(a));
      });
      if (!ack.ok || !ack.request) {
        toast.error(ack.error || t('freelance.doctor.complete_failed'));
        return;
      }
      setActive(ack.request);
      toast.success(t('freelance.doctor.completed'));
    } finally {
      setBusy(false);
    }
  };

  const goOffline = async () => {
    if (!socket || !isConnected) return;

    setBusy(true);
    try {
      const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        socket.emit('freelance:doctor:go-offline', {}, (a: any) => resolve(a));
      });
      if (!ack.ok) {
        toast.error(ack.error || t('freelance.doctor.offline_failed'));
        return;
      }
      setIsOnline(false);
      setOffers([]);
      toast.success(t('freelance.doctor.offline'));
    } finally {
      setBusy(false);
    }
  };

  const accept = async (requestId: string) => {
    if (!socket || !isConnected) return;

    setBusy(true);
    try {
      const ack = await new Promise<{ ok: boolean; request?: FreelanceRequest; error?: string }>((resolve) => {
        socket.emit('freelance:request:accept', { requestId }, (a: any) => resolve(a));
      });

      if (!ack.ok || !ack.request) {
        toast.error(ack.error || t('freelance.doctor.accept_failed'));
        return;
      }

      setActive(ack.request);
      setOffers([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{t('freelance.doctor.title')}</h1>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('freelance.doctor.subtitle')}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className={`text-xs px-2 py-1 rounded border ${isConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {isConnected ? t('freelance.common.connected') : t('freelance.common.disconnected')}
            </div>
            <div className={`text-xs px-2 py-1 rounded border ${isOnline ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {isOnline ? t('freelance.doctor.online') : t('freelance.doctor.offline')}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
            <div className="font-semibold text-light-text dark:text-dark-text">{t('freelance.doctor.location_title')}</div>
            <div className="mt-3 rounded-xl border border-light-border dark:border-dark-border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 h-44 flex items-center justify-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : (error || t('freelance.common.waiting_location'))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {!isOnline ? (
                <button
                  onClick={goOnline}
                  disabled={busy}
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {t('freelance.doctor.go_online')}
                </button>
              ) : (
                <button
                  onClick={goOffline}
                  disabled={busy}
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-800 text-white"
                >
                  {t('freelance.doctor.go_offline')}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="font-semibold text-light-text dark:text-dark-text">{t('freelance.doctor.active_title')}</div>
              {active ? (
                <div className="mt-2">
                  <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {t('freelance.doctor.active_line', { id: active.id })}
                  </div>
                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    {t('freelance.doctor.status_line', { status: active.status })}
                  </div>
                  {active.status === 'ACCEPTED' ? (
                    <div className="mt-3">
                      <button
                        onClick={complete}
                        disabled={busy}
                        className="rounded-xl px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {t('freelance.doctor.complete')}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('freelance.doctor.no_active')}</div>
              )}
            </div>

            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-light-text dark:text-dark-text">{t('freelance.doctor.offers_title')}</div>
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('freelance.doctor.offers_count', { count: offers.length })}</div>
              </div>

              {offers.length === 0 ? (
                <div className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('freelance.doctor.no_offers')}</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {offers.map((o) => (
                    <div key={o.requestId} className="rounded-xl border border-light-border dark:border-dark-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-light-text dark:text-dark-text">{t('freelance.doctor.offer_request', { id: o.requestId })}</div>
                          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            {o.distanceKm !== undefined ? t('freelance.doctor.offer_distance', { km: o.distanceKm.toFixed(1) }) : ''}
                          </div>
                          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            {(o.symptoms || []).join(', ') || t('freelance.doctor.no_symptoms')}
                          </div>
                        </div>

                        <button
                          onClick={() => accept(o.requestId)}
                          disabled={busy || !!active}
                          className={`rounded-xl px-3 py-2 text-sm font-medium ${
                            !active && !busy
                              ? 'bg-sapphire-600 hover:bg-sapphire-700 text-white'
                              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {t('freelance.doctor.accept')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreelanceDoctor;
