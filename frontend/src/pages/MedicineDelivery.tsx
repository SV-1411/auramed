import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';
import { useMedicineCart, MedicineProduct } from '../contexts/MedicineCartContext';
import { useI18n } from '../contexts/I18nContext';

const MedicineDelivery: React.FC = () => {
  const { t } = useI18n();
  const { items, totalItems, subtotal, addItem, setQuantity } = useMedicineCart();
  const [products, setProducts] = useState<MedicineProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [rxOnly, setRxOnly] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/medicine/products', {
          params: {
            search: search.trim() ? search.trim() : undefined,
            category: category || undefined,
            requiresPrescription: rxOnly ? true : undefined
          }
        });
        setProducts(res.data.data.products || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || t('medicine.load_failed'));
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    const handle = setTimeout(load, 250);
    return () => clearTimeout(handle);
  }, [category, rxOnly, search, t]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const p of products) unique.add(p.category);
    return Array.from(unique).sort();
  }, [products]);

  const cartQuantityById = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.product.id, it.quantity);
    return m;
  }, [items]);

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{t('medicine.title')}</h1>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('medicine.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2">
              <ShoppingCartIcon className="w-5 h-5 text-sapphire-600" />
              <div className="text-sm">
                <div className="text-light-text dark:text-dark-text font-medium">{t('medicine.cart_items', { count: totalItems })}</div>
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">₹{subtotal.toFixed(0)}</div>
              </div>
            </div>
            <Link
              to="/medicine/checkout"
              className="inline-flex items-center justify-center rounded-xl bg-sapphire-600 hover:bg-sapphire-700 text-white px-4 py-2 text-sm font-medium"
            >
              {t('medicine.checkout')}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
              <div className="flex items-center gap-2">
                <MagnifyingGlassIcon className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('medicine.search_placeholder')}
                  className="w-full bg-transparent outline-none text-sm text-light-text dark:text-dark-text"
                />
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-light-text dark:text-dark-text">
                <FunnelIcon className="w-5 h-5" />
                {t('medicine.filters')}
              </div>

              <div className="mt-3">
                <label className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">{t('medicine.category')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm"
                >
                  <option value="">{t('medicine.all_categories')}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  id="rxOnly"
                  type="checkbox"
                  checked={rxOnly}
                  onChange={(e) => setRxOnly(e.target.checked)}
                />
                <label htmlFor="rxOnly" className="text-sm text-light-text dark:text-dark-text">
                  {t('medicine.rx_only')}
                </label>
              </div>

              <div className="mt-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {t('medicine.tip')}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {loading ? (
              <LoadingSpinner />
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-6">
                <div className="text-light-text dark:text-dark-text font-semibold">{t('medicine.empty_title')}</div>
                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('medicine.empty_subtitle')}</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((p) => {
                  const inStock = !!p.availability?.inStock;
                  const qty = cartQuantityById.get(p.id) || 0;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-light-text dark:text-dark-text">{p.name}</div>
                            <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                              {p.brand ? p.brand : p.category}
                            </div>
                          </div>
                          {p.requiresPrescription && (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                              {t('medicine.rx')}
                            </span>
                          )}
                        </div>

                        {p.description && (
                          <div className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-2">{p.description}</div>
                        )}

                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <div className="text-lg font-bold text-light-text dark:text-dark-text">₹{p.price.toFixed(0)}</div>
                            {p.mrp ? (
                              <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-through">₹{p.mrp.toFixed(0)}</div>
                            ) : null}
                          </div>

                          <div className="text-right">
                            <div
                              className={`text-xs font-medium ${inStock ? 'text-emerald-700' : 'text-rose-600'}`}
                            >
                              {inStock ? t('medicine.in_stock') : t('medicine.out_of_stock')}
                            </div>
                            {p.availability?.minEtaMinutes ? (
                              <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                {t('medicine.eta_minutes', { count: p.availability.minEtaMinutes })}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4">
                          {qty <= 0 ? (
                            <button
                              disabled={!inStock}
                              onClick={() => addItem(p, 1)}
                              className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                inStock
                                  ? 'bg-sapphire-600 hover:bg-sapphire-700 text-white'
                                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {t('medicine.add_to_cart')}
                            </button>
                          ) : (
                            <div className="flex items-center justify-between rounded-xl border border-light-border dark:border-dark-border px-3 py-2">
                              <button
                                onClick={() => setQuantity(p.id, qty - 1)}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label="decrease"
                              >
                                <MinusIcon className="w-5 h-5" />
                              </button>
                              <div className="text-sm font-semibold text-light-text dark:text-dark-text">{qty}</div>
                              <button
                                onClick={() => setQuantity(p.id, qty + 1)}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label="increase"
                              >
                                <PlusIcon className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineDelivery;
