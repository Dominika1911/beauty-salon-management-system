import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { statisticsAPI } from '@/shared/api';
import { Modal } from '@/shared/ui/Modal';
import type { DailyStatisticsItem, StatisticsResponse } from '@/shared/types';
import '@/styles/pages/StatisticsPage.css';

type DaysOption = 7 | 14 | 30 | 90;

const formatPLN = (value: string | number): string => {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(num);
};

const formatPct = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatDeltaNumber = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

const formatDeltaMoney = (value: string): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const formatted = formatPLN(Math.abs(n));
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${formatted}`;
};

const getDeltaClass = (n: number): string => {
  if (n > 0) return 'delta-positive';
  if (n < 0) return 'delta-negative';
  return 'delta-neutral';
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  return JSON.stringify(value);
};

const prettifyKey = (key: string): string =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const ManagerStatisticsPage: React.FC = (): ReactElement => {
  const [days, setDays] = useState<DaysOption>(30);
  const [data, setData] = useState<StatisticsResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async (opts?: { showSuccess?: boolean }) => {
    try {
      setLoading(true);
      setError(null);

      const res = await statisticsAPI.get(days);
      setData(res);

      if (opts?.showSuccess) {
        setSuccessMsg('Statystyki zostały odświeżone.');
      }
    } catch (e) {
      console.error('Błąd pobierania statystyk', e);
      setError('Nie udało się pobrać statystyk.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const summaryEntries = useMemo(() => {
    if (!data?.summary) return [];
    const order = [
      'total_appointments',
      'completed_appointments',
      'cancelled_appointments',
      'no_show_appointments',
      'new_clients',
      'total_clients',
      'total_revenue',
    ];

    const obj = data.summary as unknown as Record<string, unknown>;
    const keys = Object.keys(obj);
    const ordered = [...order.filter((k) => keys.includes(k)), ...keys.filter((k) => !order.includes(k))];
    return ordered.map((k) => [k, obj[k]] as const);
  }, [data]);

  const periodEntries = useMemo(() => {
    if (!data?.period) return [];
    return Object.entries(data.period as unknown as Record<string, unknown>);
  }, [data]);

  const previousPeriodText = useMemo(() => {
    if (!data?.previous_period) return null;
    const p = data.previous_period;
    return `Poprzedni okres: ${p.from} → ${p.to} (${p.days} dni)`;
  }, [data]);

  const servicesColumns = useMemo(() => {
    const first = data?.services?.[0] as unknown as Record<string, unknown> | undefined;
    return first ? Object.keys(first) : [];
  }, [data]);

  const employeesColumns = useMemo(() => {
    const first = data?.employees?.[0] as unknown as Record<string, unknown> | undefined;
    return first ? Object.keys(first) : [];
  }, [data]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ładowanie statystyk...</p>
      </div>
    );
  }

  return (
    <div className="statistics-page">
      <Modal isOpen={Boolean(error)} onClose={() => setError(null)} title="❌ Błąd">
        <p style={{ marginTop: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setError(null)}>Zamknij</button>
          <button type="button" onClick={() => void load()}>Spróbuj ponownie</button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(successMsg)} onClose={() => setSuccessMsg(null)} title="✅ Sukces">
        <p style={{ marginTop: 0 }}>{successMsg}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setSuccessMsg(null)}>OK</button>
        </div>
      </Modal>

      <div className="statistics-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Statystyki (Manager)</h1>
          {periodEntries.length > 0 ? (
            <p style={{ marginTop: 6, opacity: 0.9 }}>
              {periodEntries.map(([k, v]) => `${prettifyKey(k)}: ${formatValue(v)}`).join(' • ')}
            </p>
          ) : null}
          {previousPeriodText ? (
            <p style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>{previousPeriodText}</p>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="days" style={{ opacity: 0.9 }}>Zakres:</label>
          <select
            id="days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as DaysOption)}
          >
            <option value={7}>7 dni</option>
            <option value={14}>14 dni</option>
            <option value={30}>30 dni</option>
            <option value={90}>90 dni</option>
          </select>

          <button type="button" onClick={() => void load({ showSuccess: true })}>
            Odśwież
          </button>
        </div>
      </div>

      <div className="stats-row">
        {summaryEntries.length > 0 ? (
          summaryEntries.map(([key, value]) => (
            <div key={key} className="stat-card">
              <div className="stat-content">
                <h3>{prettifyKey(key)}</h3>
                <p className="stat-value">
                  {key === 'total_revenue'
                    ? formatPLN(value as string | number)
                    : formatValue(value)}
                </p>

                {/* Porównanie okresu vs poprzedni okres (jeśli backend zwraca) */}
                {data?.comparison ? (
                  (() => {
                    const cmp = data.comparison;

                    // Mapowanie kluczy summary -> ścieżka w comparison
                    if (key === 'total_revenue' && cmp.total_revenue) {
                      const d = Number(cmp.total_revenue.delta);
                      const cls = getDeltaClass(d);
                      return (
                        <p className={`stat-delta ${cls}`}>
                          {formatDeltaMoney(cmp.total_revenue.delta)} • {formatPct(cmp.total_revenue.delta_pct)}
                        </p>
                      );
                    }

                    if (key === 'new_clients' && cmp.new_clients) {
                      const d = cmp.new_clients.delta;
                      const cls = getDeltaClass(d);
                      return (
                        <p className={`stat-delta ${cls}`}>
                          {formatDeltaNumber(d)} • {formatPct(cmp.new_clients.delta_pct)}
                        </p>
                      );
                    }

                    if (key === 'total_appointments' && cmp.appointments?.total) {
                      const d = cmp.appointments.total.delta;
                      const cls = getDeltaClass(d);
                      return (
                        <p className={`stat-delta ${cls}`}>
                          {formatDeltaNumber(d)} • {formatPct(cmp.appointments.total.delta_pct)}
                        </p>
                      );
                    }

                    if (key === 'completed_appointments' && cmp.appointments?.completed) {
                      const d = cmp.appointments.completed.delta;
                      const cls = getDeltaClass(d);
                      return (
                        <p className={`stat-delta ${cls}`}>
                          {formatDeltaNumber(d)} • {formatPct(cmp.appointments.completed.delta_pct)}
                        </p>
                      );
                    }

                    if (key === 'cancelled_appointments' && cmp.appointments?.cancelled) {
                      const d = cmp.appointments.cancelled.delta;
                      const cls = getDeltaClass(d);
                      return (
                        <p className={`stat-delta ${cls}`}>
                          {formatDeltaNumber(d)} • {formatPct(cmp.appointments.cancelled.delta_pct)}
                        </p>
                      );
                    }

                    if (key === 'no_show_appointments' && cmp.appointments?.no_show) {
                      const d = cmp.appointments.no_show.delta;
                      const cls = getDeltaClass(d);
                      return (
                        <p className={`stat-delta ${cls}`}>
                          {formatDeltaNumber(d)} • {formatPct(cmp.appointments.no_show.delta_pct)}
                        </p>
                      );
                    }

                    return null;
                  })()
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="no-data">
            <p>Brak danych w <strong>summary</strong>.</p>
          </div>
        )}
      </div>

      <div className="appointments-section">
        <h2>Usługi</h2>
        {data?.services && data.services.length > 0 ? (
          <div className="appointments-list" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {servicesColumns.map((c) => (
                    <th key={c} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                      {prettifyKey(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.services.map((row, idx) => {
                  const obj = row as unknown as Record<string, unknown>;
                  return (
                    <tr key={idx}>
                      {servicesColumns.map((c) => (
                        <td key={c} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {formatValue(obj[c])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data">Brak danych usług.</p>
        )}
      </div>

      <div className="appointments-section">
        <h2>Pracownicy</h2>
        {data?.employees && data.employees.length > 0 ? (
          <div className="appointments-list" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {employeesColumns.map((c) => (
                    <th key={c} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                      {prettifyKey(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.employees.map((row, idx) => {
                  const obj = row as unknown as Record<string, unknown>;
                  return (
                    <tr key={idx}>
                      {employeesColumns.map((c) => (
                        <td key={c} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {formatValue(obj[c])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data">Brak danych pracowników.</p>
        )}
      </div>

<div className="appointments-section">
  <h2>Trend dzienny (zakończone)</h2>

  {data?.daily && data.daily.length > 0 ? (
    <div className="appointments-list" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              Data
            </th>
            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              Wizyty
            </th>
            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              Przychód
            </th>
          </tr>
        </thead>
        <tbody>
          {data.daily.map((row: DailyStatisticsItem, idx: number) => (
            <tr key={idx}>
              <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {formatValue(row.date)}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {formatValue(row.appointments_count)}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {formatPLN(row.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="no-data">Brak danych trendu dziennego.</p>
  )}
</div>
    </div>
  );
};

export default ManagerStatisticsPage;
