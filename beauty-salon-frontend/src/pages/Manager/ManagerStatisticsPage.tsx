import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { statisticsAPI } from '../../api';
import { Modal } from '@/shared/ui/Modal';
import type { StatisticsResponse } from '@/shared/types';
import '@/styles/pages/StatisticsPage.css';

type DaysOption = 7 | 14 | 30 | 90;

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
    return Object.entries(data.summary as unknown as Record<string, unknown>);
  }, [data]);

  const periodEntries = useMemo(() => {
    if (!data?.period) return [];
    return Object.entries(data.period as unknown as Record<string, unknown>);
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
                <p className="stat-value">{formatValue(value)}</p>
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
    </div>
  );
};

export default ManagerStatisticsPage;
