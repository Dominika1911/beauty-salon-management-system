import React, { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { getStatistics, type StatisticsResponse } from '@/shared/api/statistics';
import { notify } from '@/shared/utils/notificationService';
import {
  beautyButtonSecondaryStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
} from '@/shared/utils/ui';

type Days = 7 | 30 | 90;

interface DaysButtonProps {
  label: string;
  value: Days;
  active: boolean;
  onClick: (v: Days) => void;
}

function DaysButton({ label, value, active, onClick }: DaysButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        ...(beautyButtonSecondaryStyle as CSSProperties),
        padding: '6px 10px',
        borderRadius: 10,
        fontWeight: 800,
        border: active ? '2px solid #d36aa0' : '1px solid rgba(211,106,160,0.35)',
        background: active ? 'rgba(211,106,160,0.08)' : '#fff',
      }}
    >
      {label}
    </button>
  );
}

type DeltaBlockNumberLike = { current: unknown; previous: unknown; delta: unknown; delta_pct: number | null };
type DeltaBlockMoneyLike = { current: unknown; previous: unknown; delta: unknown; delta_pct: number | null };

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatPLN(value: unknown): string {
  const n = toNumber(value);
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n ?? 0);
}

function formatSignedInt(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return '0';
  const i = Math.trunc(n);
  return `${i > 0 ? '+' : ''}${i}`;
}

function formatSignedMoney(value: unknown): string {
  const n = toNumber(value) ?? 0;
  const signed = n > 0 ? '+' : '';
  return `${signed}${formatPLN(n)}`;
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatPercent(value: unknown, digits = 2): string {
  const n = toNumber(value);
  if (n === null) return '—';
  return `${n.toFixed(digits)}%`;
}

function DeltaLine({
  money,
  block,
}: {
  money: boolean;
  block: (DeltaBlockNumberLike | DeltaBlockMoneyLike) | undefined;
}): ReactElement | null {
  if (!block) return null;

  const deltaPct = block.delta_pct;
  const pctText = formatPct(deltaPct);

  const deltaNum = toNumber(block.delta) ?? 0;

  const deltaText = money ? formatSignedMoney(block.delta) : formatSignedInt(block.delta);

  const color = deltaNum > 0 ? '#0f8a3a' : deltaNum < 0 ? '#b00020' : 'rgba(0,0,0,0.55)';

  return (
    <div style={{ marginTop: 8, fontSize: 12, color, fontWeight: 700 }}>
      {deltaText} <span style={{ fontWeight: 600, color: 'rgba(0,0,0,0.55)' }}>•</span> {pctText}
    </div>
  );
}

const pageWrapStyle: CSSProperties = {
  padding: 18,
};

const kpiCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid rgba(211,106,160,0.20)',
  padding: 14,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: 12,
  padding: '10px 8px',
  borderBottom: '1px solid rgba(211,106,160,0.25)',
  color: 'rgba(0,0,0,0.7)',
};

const tdStyle: CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid rgba(211,106,160,0.12)',
  verticalAlign: 'top',
};

function formatDateRange(fromISO: string, toISO: string): string {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return `${fmt(from)} – ${fmt(to)}`;
}

export default function StatisticsPage(): ReactElement {
  const [days, setDays] = useState<Days>(7);
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const rangeLabel = useMemo(() => {
    if (!data) return '';
    return `Okres: ostatnie ${data.period.days} dni (${formatDateRange(data.period.from, data.period.to)})`;
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      try {
        setLoading(true);
        const res = await getStatistics(days);
        if (!cancelled) setData(res);
      } catch {
        notify('Nie udało się pobrać statystyk.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const summary = data?.summary;

  return (
    <div style={pageWrapStyle}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <div style={beautyPageTitleStyle}>Statystyki</div>
          <div style={beautyMutedTextStyle}>{rangeLabel}</div>
        </div>

        <div style={beautyCardBodyStyle}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <DaysButton label="7 dni" value={7} active={days === 7} onClick={setDays} />
            <DaysButton label="30 dni" value={30} active={days === 30} onClick={setDays} />
            <DaysButton label="90 dni" value={90} active={days === 90} onClick={setDays} />
          </div>

          {loading || !summary ? (
            <div style={beautyMutedTextStyle}>Ładowanie…</div>
          ) : (
            <>
              {/* KPI */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={kpiCardStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Wizyty</div>
                  <div>
                    Łącznie: <strong>{summary.total_appointments}</strong>
                  </div>
                  <div>
                    Ukończone: <strong>{summary.completed_appointments}</strong>
                  </div>
                  <div>
                    Anulowane: <strong>{summary.cancelled_appointments}</strong>
                  </div>
                  <div>
                    No-show: <strong>{summary.no_show_appointments}</strong>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>
                    Porównanie vs poprzedni okres:
                  </div>
                  <DeltaLine money={false} block={data?.comparison?.appointments?.total} />

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>Ukończone:</span>
                    <DeltaLine money={false} block={data?.comparison?.appointments?.completed} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>Anulowane:</span>
                    <DeltaLine money={false} block={data?.comparison?.appointments?.cancelled} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>No-show:</span>
                    <DeltaLine money={false} block={data?.comparison?.appointments?.no_show} />
                  </div>
                </div>

                <div style={kpiCardStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Klienci</div>
                  <div>
                    Łącznie: <strong>{summary.total_clients}</strong>
                  </div>
                  <div>
                    Nowi: <strong>{summary.new_clients}</strong>
                  </div>
                  <DeltaLine money={false} block={data?.comparison?.new_clients} />
                </div>

                <div style={kpiCardStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Przychód</div>
                  <div>
                    Łącznie: <strong>{formatPLN(summary.total_revenue)}</strong>
                  </div>
                  <DeltaLine money={true} block={data?.comparison?.total_revenue} />
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
                      {data.services.map((row) => (
                        <tr key={row.service.id}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 800 }}>{row.service.name}</div>
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>ID: {row.service.id}</div>
                          </td>
                          <td style={tdStyle}>{row.total_appointments}</td>
                          <td style={tdStyle}>{formatPLN(row.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Trend dzienny (zakończone) */}
              <div style={{ ...kpiCardStyle, background: '#fff', marginBottom: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Trend dzienny (zakończone)</div>

                {!data.daily || data.daily.length === 0 ? (
                  <div style={beautyMutedTextStyle}>Brak danych trendu dziennego dla tego okresu.</div>
                ) : (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Data</th>
                        <th style={thStyle}>Zakończone</th>
                        <th style={thStyle}>Przychód</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily.map((d) => (
                        <tr key={d.date}>
                          <td style={tdStyle}>{d.date}</td>
                          <td style={tdStyle}>{d.appointments_count}</td>
                          <td style={tdStyle}>{formatPLN(d.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Employees */}
              {data.employees && data.employees.length > 0 && (
                <div style={{ ...kpiCardStyle, background: '#fff' }}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Pracownicy</div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Pracownik</th>
                        <th style={thStyle}>Wizyty</th>
                        <th style={thStyle}>Przychód</th>
                        <th style={thStyle}>Obłożenie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.map((row) => (
                        <tr key={row.employee.id}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 800 }}>
                              {row.employee.first_name} {row.employee.last_name}
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>ID: {row.employee.id}</div>
                          </td>
                          <td style={tdStyle}>{row.total_appointments}</td>
                          <td style={tdStyle}>{formatPLN(row.total_revenue)}</td>
                          <td style={tdStyle}>{formatPercent(row.occupancy_percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
