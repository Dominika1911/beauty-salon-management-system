import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { auditLogsAPI, type AuditLog } from '@/shared/api/auditLogs';
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
    <div style={{ padding: 30 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Logi operacji</h1>
          <p style={beautyMutedTextStyle}>
            Rekordów: {items.length} • Po filtrach: {filtered.length}
          </p>

          {banner ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                border: '1px solid',
                borderColor: banner.type === 'success' ? '#9ad5b3' : '#f2a6b3',
                backgroundColor: banner.type === 'success' ? '#e9fff1' : '#fff1f3',
                fontWeight: 800,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span style={{ wordBreak: 'break-word' }}>{banner.text}</span>
              <button
                style={{ ...beautyButtonSecondaryStyle, padding: '6px 10px' }}
                onClick={() => setBanner(null)}
                disabled={loading}
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>

        <div style={beautyCardBodyStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 220px 260px auto',
              gap: 12,
              alignItems: 'end',
              marginBottom: 14,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Szukaj</span>
              <input
                style={beautyInputStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID / użytkownik / typ / opis / encja / IP…"
                disabled={loading}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Poziom</span>
              <select
                style={beautySelectStyle}
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

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Typ</span>
              <select
                style={beautySelectStyle}
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

            <button style={beautyButtonSecondaryStyle} onClick={() => void load()} disabled={loading}>
              Odśwież
            </button>
          </div>

          {loading && items.length === 0 ? (
            <div style={beautyMutedTextStyle}>Ładowanie…</div>
          ) : filtered.length === 0 ? (
            <div style={beautyMutedTextStyle}>Brak logów do wyświetlenia.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(233, 30, 99, 0.25)' }}>
                  <th style={{ padding: '10px 8px' }}>ID</th>
                  <th style={{ padding: '10px 8px' }}>Data</th>
                  <th style={{ padding: '10px 8px' }}>Poziom</th>
                  <th style={{ padding: '10px 8px' }}>Typ</th>
                  <th style={{ padding: '10px 8px' }}>Użytkownik</th>
                  <th style={{ padding: '10px 8px' }}>Opis</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .sort((a, b) => a.id - b.id)
                  .map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid rgba(233, 30, 99, 0.12)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 900 }}>#{l.id}</td>
                      <td style={{ padding: '10px 8px' }}>{formatDateTime(l.created_at)}</td>
                      <td style={{ padding: '10px 8px' }}>{l.level_display ?? l.level}</td>
                      <td style={{ padding: '10px 8px' }}>{shortType(l.type)}</td>
                      <td style={{ padding: '10px 8px' }}>{l.user_email ?? '—'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 800 }}>{l.message}</div>
                        <div style={beautyMutedTextStyle}>
                          Encja: {l.entity_type} • ID: {l.entity_id} • IP: {l.adres_ip ?? '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {banner && banner.type === 'error' ? (
            <div style={{ marginTop: 12 }}>
              <button style={beautyButtonDangerStyle} onClick={() => void load()} disabled={loading}>
                Spróbuj ponownie
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
