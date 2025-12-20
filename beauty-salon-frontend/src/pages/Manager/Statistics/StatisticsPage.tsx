import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { getStatistics, type StatisticsResponse } from '@/api/statistics.ts';
import { reportsAPI } from '@/api/reports.ts';
import type { EmployeeStatisticsItem, ServiceStatisticsItem } from '@/types';
import { notify } from '@/utils/notificationService.ts';
import { formatCurrencyPLN, formatDatePL, formatPercent } from '@/utils/formatters.ts';
import styles from './StatisticsPage.module.css';

type Days = 7 | 30 | 90;

interface DaysButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}

const DaysButton = ({ label, active, onClick, disabled }: DaysButtonProps): ReactElement => {
  return (
    <button
      onClick={onClick}
      type="button"
      disabled={disabled}
      className={`${styles.daysButton} ui-btn ui-btn--secondary ${active ? styles.daysButtonActive : ''}`}
    >
      {label}
    </button>
  );
};

export default function StatisticsPage(): ReactElement {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState(false);

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
    return `Okres: ostatnie ${data.period.days} dni (${formatDatePL(data.period.from)} – ${formatDatePL(
      data.period.to,
    )})`;
  }, [data]);

  const summary = data?.summary ?? null;

  const exportStatisticsPdf = async (): Promise<void> => {
    try {
      setExporting(true);

      const blob = await reportsAPI.generateStatisticsPdf(days);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_statistics_${days}d.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      notify('Nie udało się wygenerować PDF.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="ui-page">
      <div className="ui-card">
        <div className="ui-card__header">
          <h1 className="ui-page-title">Statystyki</h1>
          <p className="ui-muted">{data ? headerInfo : '—'}</p>
        </div>

        <div className="ui-card__body">
          {/* kontrolki */}
          <div className={styles.controlsRow}>
            <div className={styles.daysGroup}>
              <DaysButton label="7 dni" active={days === 7} onClick={() => changeDays(7)} disabled={loading} />
              <DaysButton label="30 dni" active={days === 30} onClick={() => changeDays(30)} disabled={loading} />
              <DaysButton label="90 dni" active={days === 90} onClick={() => changeDays(90)} disabled={loading} />
            </div>

            <button
              type="button"
              onClick={exportStatisticsPdf}
              disabled={loading || exporting}
              className={`${styles.exportButton} ui-btn ui-btn--secondary`}
            >
              {exporting ? 'Generowanie PDF…' : 'Eksportuj do PDF'}
            </button>
          </div>

          {loading ? (
            <div className="ui-muted">Ładowanie statystyk…</div>
          ) : !data || !summary ? (
            <div className="ui-muted">Brak danych do wyświetlenia.</div>
          ) : (
            <>
              {/* KPI */}
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTitle}>Wizyty</div>
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
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.kpiTitle}>Klienci</div>
                  <div>
                    Łącznie: <strong>{summary.total_clients}</strong>
                  </div>
                  <div>
                    Nowi: <strong>{summary.new_clients}</strong>
                  </div>
                </div>

                <div className={styles.kpiCard}>
                  <div className={styles.kpiTitle}>Przychód</div>
                  <div>
                    Łącznie: <strong>{formatCurrencyPLN(summary.total_revenue)}</strong>
                  </div>
                  <div className={`ui-muted ${styles.revenueNote}`}>(wartość z backendu jako string)</div>
                </div>
              </div>

              {/* Top services */}
              <div className={`${styles.kpiCard} ${styles.kpiCardWhite} ${styles.mb16}`}>
                <div className={styles.sectionTitle}>Top usługi</div>

                {data.services.length === 0 ? (
                  <div className="ui-muted">Brak danych usług dla tego okresu.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Usługa</th>
                        <th className={styles.th}>Wizyty</th>
                        <th className={styles.th}>Przychód</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.services.map((row: ServiceStatisticsItem) => (
                        <tr key={row.service.id}>
                          <td className={styles.td}>
                            <div className="ui-strong">{row.service.name}</div>
                            <div className="ui-muted">ID: {row.service.id}</div>
                          </td>
                          <td className={styles.td}>{row.total_appointments}</td>
                          <td className={styles.td}>{formatCurrencyPLN(row.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Employees */}
              <div className={`${styles.kpiCard} ${styles.kpiCardWhite}`}>
                <div className={styles.sectionTitle}>Pracownicy</div>

                {data.employees.length === 0 ? (
                  <div className="ui-muted">Brak danych pracowników dla tego okresu.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Pracownik</th>
                        <th className={styles.th}>Wizyty</th>
                        <th className={styles.th}>Obłożenie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.map((row: EmployeeStatisticsItem) => (
                        <tr key={row.employee.id}>
                          <td className={styles.td}>
                            <div className="ui-strong">{row.employee.full_name}</div>
                            <div className="ui-muted">ID: {row.employee.id}</div>
                          </td>
                          <td className={styles.td}>{row.total_appointments}</td>
                          <td className={styles.td}>{formatPercent(row.occupancy_percent)}</td>
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
