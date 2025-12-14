// src/pages/StatisticsPage.tsx
import React, { useEffect, useMemo, useState, type ReactElement } from "react";
import { getStatistics, type StatisticsResponse } from "../api/statistics";
import { notify } from "../utils/notificationService";

type Days = 7 | 30 | 90;

interface DaysButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const DaysButton: React.FC<DaysButtonProps> = ({ label, active, onClick }): ReactElement => {
  return (
    <button
      onClick={onClick}
      type="button"
      className="print-hide"
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.12)",
        background: active ? "white" : "transparent",
        fontWeight: 650,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
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
        notify("Nie udało się pobrać statystyk.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchStats();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const periodLabel = useMemo((): string => {
    if (!data) return "";
    return `Okres: ostatnie ${data.period.days} dni`;
  }, [data]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Ładowanie statystyk...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Statystyki</h2>
        <p style={{ color: "#666" }}>Brak danych do wyświetlenia.</p>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="print-root" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Statystyki</h2>
          <p style={{ marginTop: 6, color: "#666" }}>{periodLabel}</p>
        </div>

        {/* Kontrolki NIE drukują się */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <DaysButton label="7 dni" active={days === 7} onClick={() => changeDays(7)} />
          <DaysButton label="30 dni" active={days === 30} onClick={() => changeDays(30)} />
          <DaysButton label="90 dni" active={days === 90} onClick={() => changeDays(90)} />

          <button
            type="button"
            onClick={() => window.print()}
            className="print-hide"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            Eksportuj do PDF
          </button>
        </div>
      </div>

      {/* KPI */}
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div className="stat-card">
          <h3>Wizyty</h3>
          <p>
            Łącznie: <b>{s.total_appointments}</b>
          </p>
          <p>
            Ukończone: <b>{s.completed_appointments}</b>
          </p>
          <p>
            Anulowane: <b>{s.cancelled_appointments}</b>
          </p>
          <p>
            No-show: <b>{s.no_show_appointments}</b>
          </p>
        </div>

        <div className="stat-card">
          <h3>Klienci</h3>
          <p>
            Łącznie: <b>{s.total_clients}</b>
          </p>
          <p>
            Nowi: <b>{s.new_clients}</b>
          </p>
        </div>

        <div className="stat-card">
          <h3>Przychód</h3>
          <p>
            Łącznie: <b>{s.total_revenue}</b>
          </p>
        </div>
      </div>

      {/* Top services */}
      <div className="appointments-section" style={{ marginTop: 16 }}>
        <h2>Top usługi</h2>

        {data.services.length === 0 ? (
          <p style={{ color: "#666" }}>Brak danych usług dla tego okresu.</p>
        ) : (
          <table className="print-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Usługa</th>
                <th style={{ padding: "8px 6px" }}>Wizyty</th>
                <th style={{ padding: "8px 6px" }}>Przychód</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((row) => (
                <tr key={row.service.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: "10px 6px" }}>{row.service.name}</td>
                  <td style={{ padding: "10px 6px" }}>{row.total_appointments}</td>
                  <td style={{ padding: "10px 6px" }}>{row.total_revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Employees */}
      <div className="appointments-section" style={{ marginTop: 16 }}>
        <h2>Pracownicy</h2>

        {data.employees.length === 0 ? (
          <p style={{ color: "#666" }}>Brak danych pracowników dla tego okresu.</p>
        ) : (
          <table className="print-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Pracownik</th>
                <th style={{ padding: "8px 6px" }}>Wizyty</th>
                <th style={{ padding: "8px 6px" }}>Obłożenie</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((row) => (
                <tr key={row.employee.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: "10px 6px" }}>{row.employee.full_name}</td>
                  <td style={{ padding: "10px 6px" }}>{row.total_appointments}</td>
                  <td style={{ padding: "10px 6px" }}>{row.occupancy_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
