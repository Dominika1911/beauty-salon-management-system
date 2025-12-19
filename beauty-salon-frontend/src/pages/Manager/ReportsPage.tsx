import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { reportsAPI, type ReportPDF } from '@/shared/api/reports';
import {
  beautyButtonDangerStyle,
  beautyButtonSecondaryStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
  beautySelectStyle,
} from '@/shared/utils/ui';

type ModalVariant = 'info' | 'success' | 'error';

function Modal(props: {
  open: boolean;
  title: string;
  message: string;
  variant: ModalVariant;
  confirmText?: string;
  onClose: () => void;
}): ReactElement | null {
  const { open, title, message, variant, confirmText = 'OK', onClose } = props;
  if (!open) return null;

  const borderColor = variant === 'error' ? 'rgba(244, 67, 54, 0.35)' : 'rgba(233, 30, 99, 0.25)';
  const bg = variant === 'error' ? '#fff1f3' : variant === 'success' ? '#e9fff1' : '#fff5fa';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          width: 'min(760px, 100%)',
          background: bg,
          borderRadius: 16,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{title}</div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</div>
          </div>
          <button type="button" style={{ ...beautyButtonSecondaryStyle, padding: '6px 10px' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" style={beautyButtonSecondaryStyle} onClick={onClose}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  const out = u === 0 ? String(Math.round(v)) : v.toFixed(1);
  return `${out} ${units[u]}`;
}

function extractErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;

    if (typeof data === 'string') return status ? `HTTP ${status}: ${data}` : data;
    if (data && typeof data === 'object') {
      try {
        return status ? `HTTP ${status}: ${JSON.stringify(data)}` : JSON.stringify(data);
      } catch {
        return status ? `HTTP ${status}: [Błąd odpowiedzi]` : '[Błąd odpowiedzi]';
      }
    }
    return status ? `HTTP ${status}: ${err.message}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Nieznany błąd.';
}

function buildPdfUrl(filePathRaw: string): string {
  const fp = filePathRaw.trim();

  // 1) backend typowo serwuje MEDIA: /media/...
  if (fp.startsWith('/media/')) return fp;

  // 2) jeśli serializer zwraca "reports/....pdf" (bez /media), to dopinamy /media/
  if (fp.startsWith('reports/')) return `/media/${fp}`;

  // 3) jeśli ktoś zwrócił np. "media/reports/..." bez slasha
  if (fp.startsWith('media/')) return `/${fp}`;

  // 4) fallback do istniejącego helpera
  return reportsAPI.mediaUrl(fp);
}

export default function ReportsPage(): ReactElement {
  const [items, setItems] = useState<ReportPDF[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [openingId, setOpeningId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>('info');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (variant: ModalVariant, title: string, message: string): void => {
    setModalVariant(variant);
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await reportsAPI.list();
      setItems([...list].sort((a, b) => a.id - b.id));
    } catch (e) {
      setItems([]);
      showModal('error', 'Nie udało się pobrać raportów', extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const typeOptions = useMemo(() => {
    const uniq = new Set<string>();
    items.forEach((r) => uniq.add(r.type));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'pl-PL'));
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return items.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (!q) return true;

      const hay = [
        String(r.id),
        r.type,
        r.title,
        r.file_path,
        r.generated_by_email ?? '',
        formatDate(r.data_od),
        formatDate(r.data_do),
        formatBytes(r.file_size),
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, search, typeFilter]);

  const openPdf = async (report: ReportPDF): Promise<void> => {
    const rawPath = (report.file_path ?? '').trim();
    if (!rawPath) {
      showModal('error', 'Brak pliku', 'Pole file_path jest puste — nie da się otworzyć PDF.');
      return;
    }

    setOpeningId(report.id);

    try {
      // ✅ otwieramy bezpośrednio /media/... (Vite proxy już masz)
      const url = buildPdfUrl(rawPath);
      window.open(url, '_blank', 'noopener,noreferrer');
      showModal('success', 'Gotowe', 'Otworzyłem raport PDF w nowej karcie.');
    } catch (e) {
      showModal('error', 'Błąd', extractErrorMessage(e));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div style={{ padding: 30 }}>
      <Modal open={modalOpen} title={modalTitle} message={modalMessage} variant={modalVariant} onClose={() => setModalOpen(false)} />

      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Raporty (PDF)</h1>
          <p style={beautyMutedTextStyle}>
            Backend udostępnia listę wygenerowanych raportów pod <code>/api/reports/</code>. Rekordów: {items.length} • Po filtrach: {filtered.length}
          </p>
        </div>

        <div style={beautyCardBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px auto', gap: 12, alignItems: 'end', marginBottom: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Szukaj</span>
              <input
                style={beautyInputStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID / typ / tytuł / email / zakres…"
                disabled={loading}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Typ</span>
              <select style={beautySelectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} disabled={loading}>
                <option value="all">Wszystkie</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <button style={beautyButtonSecondaryStyle} onClick={() => void load()} disabled={loading}>
              Odśwież
            </button>
          </div>

          {loading && items.length === 0 ? (
            <div style={beautyMutedTextStyle}>Ładowanie…</div>
          ) : filtered.length === 0 ? (
            <div style={beautyMutedTextStyle}>Brak raportów do wyświetlenia.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(233, 30, 99, 0.25)' }}>
                  <th style={{ padding: '10px 8px' }}>ID</th>
                  <th style={{ padding: '10px 8px' }}>Utworzono</th>
                  <th style={{ padding: '10px 8px' }}>Typ</th>
                  <th style={{ padding: '10px 8px' }}>Tytuł</th>
                  <th style={{ padding: '10px 8px' }}>Zakres</th>
                  <th style={{ padding: '10px 8px' }}>Rozmiar</th>
                  <th style={{ padding: '10px 8px' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .sort((a, b) => a.id - b.id)
                  .map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(233, 30, 99, 0.12)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 900 }}>#{r.id}</td>
                      <td style={{ padding: '10px 8px' }}>{formatDateTime(r.created_at)}</td>
                      <td style={{ padding: '10px 8px' }}>{r.type}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 900 }}>{r.title}</div>
                        <div style={beautyMutedTextStyle}>{r.generated_by_email ?? '—'}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {formatDate(r.data_od)} – {formatDate(r.data_do)}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{formatBytes(r.file_size)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <button
                          type="button"
                          style={{
                            ...beautyButtonSecondaryStyle,
                            padding: '8px 12px',
                            cursor: openingId === r.id ? 'wait' : 'pointer',
                            opacity: openingId === r.id ? 0.8 : 1,
                          }}
                          onClick={() => void openPdf(r)}
                          disabled={openingId !== null}
                        >
                          {openingId === r.id ? 'Otwieranie…' : 'Otwórz PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {!loading && items.length === 0 ? (
            <div style={{ marginTop: 12 }}>
              <button style={beautyButtonDangerStyle} onClick={() => void load()}>
                Spróbuj ponownie
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
