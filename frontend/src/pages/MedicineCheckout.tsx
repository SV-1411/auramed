import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { MapPinIcon, ShoppingCartIcon, TrashIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';
import { useMedicineCart } from '../contexts/MedicineCartContext';
import { useI18n } from '../contexts/I18nContext';

type DeliveryLocation = { latitude: number; longitude: number };

type DeliveryAddress = {
  line1: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  note?: string;
};

const MedicineCheckout: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { items, subtotal, setQuantity, removeItem, clear } = useMedicineCart();
  const [placing, setPlacing] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [address, setAddress] = useState<DeliveryAddress>({
    line1: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    note: ''
  });

  const canPlace = useMemo(() => {
    if (!items.length) return false;
    if (!location) return false;
    if (!address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.pincode.trim()) return false;
    return true;
  }, [address, items.length, location]);

  const getLocation = async () => {
    if (!navigator.geolocation) {
      toast.error(t('medicine.geo_not_supported'));
      return;
    }

    setGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      toast.success(t('medicine.geo_ok'));
    } catch {
      toast.error(t('medicine.geo_denied'));
    } finally {
      setGettingLocation(false);
    }
  };

  useEffect(() => {
    getLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeOrder = async () => {
    if (!canPlace) {
      toast.error(t('medicine.fill_required'));
      return;
    }

    setPlacing(true);
    try {
      const res = await axios.post('/api/medicine/orders', {
        items: items.map((it) => ({ productId: it.product.id, quantity: it.quantity })),
        deliveryLocation: location,
        deliveryAddress: address
      });

      const order = res.data.data.order;
      toast.success(t('medicine.order_created'));
      clear();
      navigate(`/medicine/orders/${order.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('medicine.order_failed'));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{t('medicine.checkout')}</h1>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('medicine.checkout_subtitle')}</p>
          </div>

          <Link
            to="/medicine"
            className="inline-flex items-center justify-center rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-4 py-2 text-sm font-medium"
          >
            {t('medicine.back_to_catalog')}
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-6">
            <div className="text-light-text dark:text-dark-text font-semibold">{t('medicine.cart_empty_title')}</div>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('medicine.cart_empty_subtitle')}</div>
            <Link
              to="/medicine"
              className="inline-flex mt-4 items-center justify-center rounded-xl bg-sapphire-600 hover:bg-sapphire-700 text-white px-4 py-2 text-sm font-medium"
            >
              {t('medicine.shop_now')}
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="flex items-center gap-2">
                <ShoppingCartIcon className="w-5 h-5 text-sapphire-600" />
                <div className="font-semibold text-light-text dark:text-dark-text">{t('medicine.cart')}</div>
              </div>

              <div className="mt-4 space-y-3">
                {items.map((it) => (
                  <div key={it.product.id} className="flex items-center justify-between gap-3 rounded-xl border border-light-border dark:border-dark-border p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-light-text dark:text-dark-text truncate">{it.product.name}</div>
                      <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">₹{it.product.price.toFixed(0)} × {it.quantity}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(it.product.id, it.quantity - 1)}
                        className="rounded-lg border border-light-border dark:border-dark-border px-2 py-1 text-sm"
                      >
                        -
                      </button>
                      <div className="w-8 text-center text-sm font-semibold">{it.quantity}</div>
                      <button
                        onClick={() => setQuantity(it.product.id, it.quantity + 1)}
                        className="rounded-lg border border-light-border dark:border-dark-border px-2 py-1 text-sm"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(it.product.id)}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="remove"
                      >
                        <TrashIcon className="w-5 h-5 text-rose-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-5 h-5 text-sapphire-600" />
                    <div className="font-semibold text-light-text dark:text-dark-text">{t('medicine.delivery_location')}</div>
                  </div>
                  <button
                    onClick={getLocation}
                    disabled={gettingLocation}
                    className="rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-1.5 text-sm"
                  >
                    {gettingLocation ? t('medicine.locating') : t('medicine.refresh_location')}
                  </button>
                </div>

                <div className="mt-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : t('medicine.location_missing')}
                </div>
              </div>

              <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
                <div className="font-semibold text-light-text dark:text-dark-text">{t('medicine.delivery_address')}</div>

                <div className="mt-3 space-y-3">
                  <input
                    value={address.line1}
                    onChange={(e) => setAddress((p) => ({ ...p, line1: e.target.value }))}
                    placeholder={t('medicine.address_line1')}
                    className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm"
                  />
                  <input
                    value={address.landmark || ''}
                    onChange={(e) => setAddress((p) => ({ ...p, landmark: e.target.value }))}
                    placeholder={t('medicine.address_landmark')}
                    className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={address.city}
                      onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                      placeholder={t('medicine.address_city')}
                      className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm"
                    />
                    <input
                      value={address.state}
                      onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))}
                      placeholder={t('medicine.address_state')}
                      className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    value={address.pincode}
                    onChange={(e) => setAddress((p) => ({ ...p, pincode: e.target.value }))}
                    placeholder={t('medicine.address_pincode')}
                    className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={address.note || ''}
                    onChange={(e) => setAddress((p) => ({ ...p, note: e.target.value }))}
                    placeholder={t('medicine.address_note')}
                    className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm min-h-[80px]"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-light-text-secondary dark:text-dark-text-secondary">{t('medicine.subtotal')}</div>
                  <div className="font-semibold text-light-text dark:text-dark-text">₹{subtotal.toFixed(0)}</div>
                </div>

                <button
                  onClick={placeOrder}
                  disabled={!canPlace || placing}
                  className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    canPlace && !placing
                      ? 'bg-sapphire-600 hover:bg-sapphire-700 text-white'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {placing ? t('medicine.placing_order') : t('medicine.place_order')}
                </button>

                <div className="mt-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  {t('medicine.checkout_note')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicineCheckout;
