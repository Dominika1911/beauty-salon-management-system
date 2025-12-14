import React, { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { getStatistics, type StatisticsResponse } from '../api/statistics';
import type { EmployeeStatisticsItem, ServiceStatisticsItem } from '../types';
import { notify } from '../utils/notificationService';
import {
  beautyButtonSecondaryStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
} from '../utils/ui';

type Days = 7 | 30 | 90;

interface DaysButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}

const daysButtonStyle = (active: boolean): CSSProperties => ({
  ...beautyButtonSecondaryStyle,
  padding: '8px 12px',
  fontWeight: 800,
  backgroundColor: active ? '#ffffff' : '#fff5fa',
  borderColor: active ? 'rgba(233, 30, 99, 0.35)' : 'rgba(233, 30, 99, 0.20)',
  cursor: 'pointer',
});

const DaysButton: React.FC<DaysButtonProps> = ({ label, active, onClick, disabled }): ReactElement => {
  return (
    <button onClick={onClick} type="button" style={daysButtonStyle(active)} disabled={disabled}>
      {label}
    </button>
  );
};

function formatDatePL(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatCurrencyPLN(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
}

function formatPercent(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return `${trimmed}%`;
  return `${n}%`;
}

const kpiCardStyle: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: '1px solid rgba(233, 30, 99, 0.20)',
  background: '#fff5fa',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  padding: '10px 8px',
  textAlign: 'left',
  borderBottom: '1px solid rgba(233, 30, 99, 0.25)',
};

const tdStyle: CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid rgba(233, 30, 99, 0.12)',
  verticalAlign: 'top',
};

export default function StatisticsPage(): ReactElement {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const changeDays = (v: Days): void => {
    setDays(v);
    setLoading(true);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async (): Promise<void> => {
      try {
        const result = await getStatistics(days);
        if (cancelled) return;
        setData(result);
      } catch {
        notify('Nie udało się pobrać statystyk.', 'error');
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchStats();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const headerInfo = useMemo((): string => {
    if (!data) return '';
    return `Okres: ostatnie ${data.period.days} dni (${formatDatePL(data.period.from)} – ${formatDatePL(data.period.to)})`;
  }, [data]);

  const summary = data?.summary ?? null;

  return (
    <div style={{ padding: 30 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Statystyki</h1>
          <p style={beautyMutedTextStyle}>{data ? headerInfo : '—'}</p>
        </div>

        <div style={beautyCardBodyStyle}>
          {/* kontrolki */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <DaysButton label="7 dni" active={days === 7} onClick={() => changeDays(7)} disabled={loading} />
              <DaysButton label="30 dni" active={days === 30} onClick={() => changeDays(30)} disabled={loading} />
              <DaysButton label="90 dni" active={days === 90} onClick={() => changeDays(90)} disabled={loading} />
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              style={{ ...beautyButtonSecondaryStyle, padding: '8px 12px', fontWeight: 800 }}
              disabled={loading}
            >
              Eksportuj do PDF
            </button>
          </div>

          {loading ? (
            <div style={beautyMutedTextStyle}>Ładowanie statystyk…</div>
          ) : !data || !summary ? (
            <div style={beautyMutedTextStyle}>Brak danych do wyświetlenia.</div>
          ) : (
            <>
              {/* KPI */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={kpiCardStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Wizyty</div>
                  <div>Łącznie: <strong>{summary.total_appointments}</strong></div>
                  <div>Ukończone: <strong>{summary.completed_appointments}</strong></div>
                  <div>Anulowane: <strong>{summary.cancelled_appointments}</strong></div>
                  <div>No-show: <strong>{summary.no_show_appointments}</strong></div>
                </div>

                <div style={kpiCardStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Klienci</div>
                  <div>Łącznie: <strong>{summary.total_clients}</strong></div>
                  <div>Nowi: <strong>{summary.new_clients}</strong></div>
                </div>

                <div style={kpiCardStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Przychód</div>
                  <div>
                    Łącznie: <strong>{formatCurrencyPLN(summary.total_revenue)}</strong>
                  </div>
                  <div style={{ ...beautyMutedTextStyle, marginTop: 8 }}>
                    (wartość z backendu jako string)
                  </div>
                </div>
              </div>

              {/* Top services */}
              <div style={{ ...kpiCardStyle, background: '#fff', marginBottom: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Top usługi</div>

                {data.services.length === 0 ? (
                  <div style={beautyMutedTextStyle}>Brak danych usług dla tego okresu.</div>
                ) : (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Usługa</th>
                        <th style={thStyle}>Wizyty</th>
                        <th style={thStyle}>Przychód</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.services.map((row: ServiceStatisticsItem) => (
                        <tr key={row.service.id}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 800 }}>{row.service.name}</div>
                            <div style={beautyMutedTextStyle}>ID: {row.service.id}</div>
                          </td>
                          <td style={tdStyle}>{row.total_appointments}</td>
                          <td style={tdStyle}>{formatCurrencyPLN(row.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Employees */}
              <div style={{ ...kpiCardStyle, background: '#fff' }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Pracownicy</div>

                {data.employees.length === 0 ? (
                  <div style={beautyMutedTextStyle}>Brak danych pracowników dla tego okresu.</div>
                ) : (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Pracownik</th>
                        <th style={thStyle}>Wizyty</th>
                        <th style={thStyle}>Obłożenie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.map((row: EmployeeStatisticsItem) => (
                        <tr key={row.employee.id}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 800 }}>{row.employee.full_name}</div>
                            <div style={beautyMutedTextStyle}>ID: {row.employee.id}</div>
                          </td>
                          <td style={tdStyle}>{row.total_appointments}</td>
                          <td style={tdStyle}>{formatPercent(row.occupancy_percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
