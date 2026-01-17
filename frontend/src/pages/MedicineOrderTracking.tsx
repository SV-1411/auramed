import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import {
  ClockIcon,
  CheckCircleIcon,
  TruckIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';
import { useSocket } from '../contexts/SocketContext';
import { useI18n } from '../contexts/I18nContext';

type MedicineOrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

type MedicineOrder = {
  id: string;
  status: MedicineOrderStatus;
  totalAmount: number;
  etaMinutes: number;
  createdAt: string;
  deliveryAddress: any;
  deliveryLocation: any;
  pharmacy?: { id: string; name: string };
  items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>;
};

const statusSteps: MedicineOrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const MedicineOrderTracking: React.FC = () => {
  const { t } = useI18n();
  const { socket } = useSocket();
  const { orderId } = useParams();
  const [order, setOrder] = useState<MedicineOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/medicine/orders/${orderId}`);
      setOrder(res.data.data.order);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('medicine.order_load_failed'));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket || !orderId) return;

    const onUpdated = (evt: any) => {
      if (evt?.orderId === orderId) {
        load();
      }
    };

    socket.on('medicine-order:updated', onUpdated);
    return () => {
      socket.off('medicine-order:updated', onUpdated);
    };
  }, [load, orderId, socket]);

  const derived = useMemo(() => {
    if (!order) return null;

    const created = new Date(order.createdAt);
    const etaMs = Math.max(1, order.etaMinutes) * 60 * 1000;
    const etaAt = new Date(created.getTime() + etaMs);

    const stepIndex = statusSteps.indexOf(order.status);
    const progress = order.status === 'CANCELLED' ? 0 : Math.max(0, stepIndex) / (statusSteps.length - 1);

    return { created, etaAt, progress };
  }, [order]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const cancel = async () => {
    if (!orderId) return;
    setCancelling(true);
    try {
      await axios.post(`/api/medicine/orders/${orderId}/cancel`);
      toast.success(t('medicine.order_cancelled'));
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('medicine.cancel_failed'));
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = order && ['PENDING', 'CONFIRMED'].includes(order.status);

  if (loading) return <LoadingSpinner />;

  if (!order) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-6">
          <div className="text-light-text dark:text-dark-text font-semibold">{t('medicine.order_not_found')}</div>
          <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('medicine.order_not_found_subtitle')}</div>
          <Link
            to="/medicine"
            className="inline-flex mt-4 items-center justify-center rounded-xl bg-sapphire-600 hover:bg-sapphire-700 text-white px-4 py-2 text-sm font-medium"
          >
            {t('medicine.back_to_catalog')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{t('medicine.tracking_title')}</h1>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
              {t('medicine.order_id', { id: order.id })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-4 py-2 text-sm font-medium"
            >
              <ArrowPathIcon className="w-5 h-5" />
              {refreshing ? t('medicine.refreshing') : t('medicine.refresh')}
            </button>
            <Link
              to="/medicine"
              className="inline-flex items-center justify-center rounded-xl bg-sapphire-600 hover:bg-sapphire-700 text-white px-4 py-2 text-sm font-medium"
            >
              {t('medicine.shop_more')}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-light-text dark:text-dark-text">{t('medicine.status')}</div>
                <div className="mt-1 inline-flex items-center gap-2 text-sm">
                  {order.status === 'DELIVERED' ? (
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                  ) : order.status === 'CANCELLED' ? (
                    <XCircleIcon className="w-5 h-5 text-rose-600" />
                  ) : order.status === 'OUT_FOR_DELIVERY' ? (
                    <TruckIcon className="w-5 h-5 text-sapphire-600" />
                  ) : (
                    <ClockIcon className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="font-semibold text-light-text dark:text-dark-text">{t(`medicine.status.${order.status.toLowerCase()}`)}</span>
                </div>
              </div>

              {canCancel ? (
                <button
                  onClick={cancel}
                  disabled={cancelling}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-medium"
                >
                  {cancelling ? t('medicine.cancelling') : t('medicine.cancel_order')}
                </button>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sapphire-600"
                  style={{ width: `${Math.round((derived?.progress || 0) * 100)}%` }}
                />
              </div>

              {derived ? (
                <div className="mt-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  {t('medicine.eta_line', { minutes: order.etaMinutes })} • {t('medicine.eta_by', { time: derived.etaAt.toLocaleTimeString() })}
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-light-border dark:border-dark-border p-3">
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('medicine.pharmacy')}</div>
                <div className="text-sm font-semibold text-light-text dark:text-dark-text mt-1">{order.pharmacy?.name || t('medicine.pharmacy_unknown')}</div>
              </div>
              <div className="rounded-xl border border-light-border dark:border-dark-border p-3">
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('medicine.total')}</div>
                <div className="text-sm font-semibold text-light-text dark:text-dark-text mt-1">₹{order.totalAmount.toFixed(0)}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="font-semibold text-light-text dark:text-dark-text">{t('medicine.items')}</div>
              <div className="mt-3 space-y-2">
                {order.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between text-sm rounded-xl border border-light-border dark:border-dark-border p-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-light-text dark:text-dark-text truncate">{it.name}</div>
                      <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('medicine.qty_price', { qty: it.quantity, price: it.unitPrice.toFixed(0) })}</div>
                    </div>
                    <div className="font-semibold text-light-text dark:text-dark-text">₹{(it.unitPrice * it.quantity).toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="font-semibold text-light-text dark:text-dark-text">{t('medicine.delivery_address')}</div>
              <pre className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-wrap break-words">
                {JSON.stringify(order.deliveryAddress, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineOrderTracking;
