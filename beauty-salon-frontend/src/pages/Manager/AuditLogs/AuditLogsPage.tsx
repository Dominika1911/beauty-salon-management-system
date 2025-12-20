import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { auditLogsAPI, type AuditLog } from '@/api/auditLogs.ts';
import styles from './AuditLogsPage.module.css';

type Banner = { type: 'success' | 'error'; text: string };

function normalize(s: string): string {
  return s.trim().toLowerCase();
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

function shortType(t: string): string {
  const parts = t.split('.');
  return parts[parts.length - 1] || t;
}

export default function AuditLogsPage(): ReactElement {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const load = async (): Promise<void> => {
    setLoading(true);
    setBanner(null);
    try {
      // 🔒 Nie zgadujemy filtrów backendowych (level/type) – opcje bierzemy z danych.
      const list = await auditLogsAPI.list();
      const sorted = [...list].sort((a, b) => a.id - b.id);
      setItems(sorted);
    } catch (e) {
      setItems([]);
      setBanner({ type: 'error', text: `Nie udało się pobrać logów. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const levelOptions = useMemo(() => {
    const uniq = new Set<string>();
    items.forEach((l) => uniq.add(l.level));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'pl-PL'));
  }, [items]);

  const typeOptions = useMemo(() => {
    const uniq = new Set<string>();
    items.forEach((l) => uniq.add(l.type));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'pl-PL'));
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(search);

    return items.filter((l) => {
      if (levelFilter !== 'all' && l.level !== levelFilter) return false;
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;

      if (!q) return true;

      const hay = [
        String(l.id),
        l.type,
        l.level,
        l.level_display ?? '',
        l.user_email ?? '',
        l.message,
        l.entity_type,
        l.entity_id,
        l.adres_ip ?? '',
        l.user_agent ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, search, levelFilter, typeFilter]);

  return (
    <div className="ui-page">
      <div className="ui-card">
        <div className="ui-card__header">
          <h1 className="ui-page-title">Logi systemowe</h1>
          <p className="ui-muted">
            Rekordów: {items.length} • Po filtrach: {filtered.length}
          </p>

          {banner ? (
            <div
              className={`${styles.banner} ${banner.type === 'success' ? styles.bannerSuccess : styles.bannerError}`}
            >
              <span className={styles.bannerText}>{banner.text}</span>
              <button
                className={`${styles.bannerCloseBtn} ui-btn ui-btn--secondary`}
                onClick={() => setBanner(null)}
                disabled={loading}
                type="button"
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>

        <div className="ui-card__body">
          <div className={styles.filtersGrid}>
            <label className={styles.fieldLabel}>
              <span className={styles.fieldTitle}>Szukaj</span>
              <input
                className="ui-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID / użytkownik / typ / opis / encja / IP…"
                disabled={loading}
              />
            </label>

            <label className={styles.fieldLabel}>
              <span className={styles.fieldTitle}>Poziom</span>
              <select
                className="ui-select"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                disabled={loading}
              >
                <option value="all">Wszystkie</option>
                {levelOptions.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.fieldLabel}>
              <span className={styles.fieldTitle}>Typ</span>
              <select
                className="ui-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                disabled={loading}
              >
                <option value="all">Wszystkie</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {shortType(t)}
                  </option>
                ))}
              </select>
            </label>

            <button className="ui-btn ui-btn--secondary" onClick={() => void load()} disabled={loading} type="button">
              Odśwież
            </button>
          </div>

          {loading && items.length === 0 ? (
            <div className="ui-muted">Ładowanie…</div>
          ) : filtered.length === 0 ? (
            <div className="ui-muted">Brak logów do wyświetlenia.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={styles.th}>ID</th>
                  <th className={styles.th}>Data</th>
                  <th className={styles.th}>Poziom</th>
                  <th className={styles.th}>Typ</th>
                  <th className={styles.th}>Użytkownik</th>
                  <th className={styles.th}>Opis</th>
                </tr>
              </thead>
              <tbody>
              {filtered.map((l) => (
                    <tr key={l.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.idCell}`}>#{l.id}</td>
                      <td className={styles.td}>{formatDateTime(l.created_at)}</td>
                      <td className={styles.td}>{l.level_display ?? l.level}</td>
                      <td className={styles.td}>{shortType(l.type)}</td>
                      <td className={styles.td}>{l.user_email ?? '—'}</td>
                      <td className={styles.td}>
                        <div className={styles.message}>{l.message}</div>
                        <div className="ui-muted">
                          Encja: {l.entity_type} • ID: {l.entity_id} • IP: {l.adres_ip ?? '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {banner && banner.type === 'error' ? (
            <div className={styles.retryRow}>
              <button className="ui-btn ui-btn--danger" onClick={() => void load()} disabled={loading} type="button">
                Spróbuj ponownie
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
