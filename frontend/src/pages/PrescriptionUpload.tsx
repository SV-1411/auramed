import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useI18n } from '../contexts/I18nContext';
import LoadingSpinner from '../components/LoadingSpinner';

type PrescriptionDocStatus = 'UPLOADED' | 'EXTRACTING' | 'EXTRACTED' | 'FAILED';

type PrescriptionDocument = {
  id: string;
  fileUrl: string;
  mimeType: string;
  originalName: string;
  status: PrescriptionDocStatus;
  extracted?: any;
  createdAt: string;
};

const PrescriptionUpload: React.FC = () => {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<PrescriptionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const apiBase = useMemo(() => {
    return (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3000';
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/prescriptions');
      setDocuments(res.data.data.documents || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('prescriptions.load_failed'));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await axios.delete(`/api/prescriptions/${id}`);
      toast.success(t('prescriptions.delete_success'));
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('prescriptions.delete_failed'));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post('/api/prescriptions/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(t('prescriptions.upload_success'));
      setDocuments((prev) => [res.data.data.document, ...prev]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('prescriptions.upload_failed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const extract = async (id: string) => {
    setExtractingId(id);
    try {
      const res = await axios.post(`/api/prescriptions/extract/${id}`);
      toast.success(t('prescriptions.extract_success'));
      const updated = res.data.data.document;
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('prescriptions.extract_failed'));
      await load();
    } finally {
      setExtractingId(null);
    }
  };

  const statusBadge = (s: PrescriptionDocStatus) => {
    const base = 'text-[11px] px-2 py-1 rounded-full border whitespace-nowrap';
    if (s === 'EXTRACTED') return <span className={`${base} bg-emerald-100 text-emerald-800 border-emerald-200`}>{t('prescriptions.status.extracted')}</span>;
    if (s === 'EXTRACTING') return <span className={`${base} bg-amber-100 text-amber-800 border-amber-200`}>{t('prescriptions.status.extracting')}</span>;
    if (s === 'FAILED') return <span className={`${base} bg-rose-100 text-rose-800 border-rose-200`}>{t('prescriptions.status.failed')}</span>;
    return <span className={`${base} bg-slate-100 text-slate-700 border-slate-200`}>{t('prescriptions.status.uploaded')}</span>;
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{t('prescriptions.title')}</h1>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('prescriptions.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              onClick={pickFile}
              disabled={uploading}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                uploading ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-sapphire-600 hover:bg-sapphire-700 text-white'
              }`}
            >
              {uploading ? t('prescriptions.uploading') : t('prescriptions.upload')}
            </button>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <LoadingSpinner />
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-6">
              <div className="text-light-text dark:text-dark-text font-semibold">{t('prescriptions.empty_title')}</div>
              <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('prescriptions.empty_subtitle')}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const canExtract = doc.status === 'UPLOADED' || doc.status === 'FAILED';
                const extracting = extractingId === doc.id || doc.status === 'EXTRACTING';
                const url = `${apiBase}${doc.fileUrl}`;

                return (
                  <div key={doc.id} className="rounded-2xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold text-light-text dark:text-dark-text truncate">{doc.originalName}</div>
                          {statusBadge(doc.status)}
                        </div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                          {new Date(doc.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm font-medium"
                        >
                          {t('prescriptions.view_file')}
                        </a>
                        <button
                          onClick={() => remove(doc.id)}
                          className="rounded-xl border border-light-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/70 px-3 py-2 text-sm font-medium text-rose-700"
                        >
                          {t('prescriptions.delete')}
                        </button>
                        <button
                          onClick={() => extract(doc.id)}
                          disabled={!canExtract || extracting}
                          className={`rounded-xl px-3 py-2 text-sm font-medium ${
                            canExtract && !extracting
                              ? 'bg-sapphire-600 hover:bg-sapphire-700 text-white'
                              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {extracting ? t('prescriptions.extracting') : t('prescriptions.extract')}
                        </button>
                      </div>
                    </div>

                    {doc.status === 'EXTRACTED' && doc.extracted ? (
                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
                        <div className="lg:col-span-7 rounded-xl border border-light-border dark:border-dark-border p-3">
                          <div className="text-sm font-semibold text-light-text dark:text-dark-text">{t('prescriptions.extracted_medicines')}</div>
                          <div className="mt-2 space-y-2">
                            {(doc.extracted?.medicines || []).length === 0 ? (
                              <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('prescriptions.no_medicines_found')}</div>
                            ) : (
                              (doc.extracted?.medicines || []).map((m: any, idx: number) => (
                                <div key={idx} className="rounded-xl border border-light-border dark:border-dark-border p-3">
                                  <div className="font-semibold text-light-text dark:text-dark-text">{m.medicationName || t('prescriptions.unknown_medicine')}</div>
                                  <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                    {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' • ') || t('prescriptions.no_details')}
                                  </div>
                                  {m.instructions ? (
                                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">{m.instructions}</div>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="lg:col-span-5 rounded-xl border border-light-border dark:border-dark-border p-3">
                          <div className="text-sm font-semibold text-light-text dark:text-dark-text">{t('prescriptions.raw_extraction')}</div>
                          <pre className="mt-2 text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-wrap break-words">
                            {JSON.stringify(doc.extracted, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriptionUpload;
