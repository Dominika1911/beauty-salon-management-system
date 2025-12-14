import React, { useEffect, useMemo, useState, type ReactElement } from "react";
import type { AppointmentListItem } from "../../types";
import { appointmentsAPI } from "../../api/appointments";

type StatusKey = string;

const formatDateTimePL = (isoOrDate: string | Date): string => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const badgeStyleFor = (status: StatusKey): React.CSSProperties => {
  const s = String(status).toLowerCase();

  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid #ccc",
    background: "#f7f7f7",
    marginLeft: 8,
    whiteSpace: "nowrap",
  };

  if (s === "cancelled" || s === "canceled") return { ...base, borderColor: "#f1b4b4", background: "#fff1f1" };
  if (s === "completed") return { ...base, borderColor: "#b8d7b8", background: "#f1fff1" };
  if (s === "confirmed") return { ...base, borderColor: "#bcd3ff", background: "#f3f7ff" };
  if (s === "scheduled") return { ...base, borderColor: "#ddd", background: "#fafafa" };

  return base;
};

const StatusBadge: React.FC<{ status: string; label?: string | null }> = ({ status, label }) => {
  return <span style={badgeStyleFor(status)}>{label?.trim() ? label : status}</span>;
};

export const MyAppointmentsPage: React.FC = (): ReactElement => {
  const [items, setItems] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showUpcomingOnly, setShowUpcomingOnly] = useState<boolean>(false);

  const fetchMy = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await appointmentsAPI.myAppointments();
      setItems(res.data ?? []);
    } catch (e) {
      console.error(e);
      setError("Nie udało się pobrać Twoich rezerwacji.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMy();
  }, []);

  // Sortowanie: po dacie (rosnąco), potem po id jako stabilizator
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = new Date(a.start).getTime();
      const tb = new Date(b.start).getTime();
      if (ta !== tb) return ta - tb;
      return a.id - b.id;
    });
  }, [items]);

  const now = useMemo(() => Date.now(), []);
  const isUpcoming = (a: AppointmentListItem): boolean => new Date(a.start).getTime() > now;

  const canCancel = (a: AppointmentListItem): boolean => {
    // UI: tylko przyszłe i nieodwołane/niezakończone
    const future = isUpcoming(a);
    const notFinal = !["cancelled", "completed"].includes(String(a.status).toLowerCase());
    return future && notFinal;
  };

  const upcomingCount = useMemo(() => sortedItems.filter(isUpcoming).length, [sortedItems]);
  const allCount = sortedItems.length;

  const visibleItems = useMemo(() => {
    if (!showUpcomingOnly) return sortedItems;
    return sortedItems.filter(isUpcoming);
  }, [sortedItems, showUpcomingOnly]);

  // Najbliższa nadchodząca wizyta (z listy po sortowaniu)
  const nearestUpcoming = useMemo(() => {
    return sortedItems.find((a) => isUpcoming(a)) ?? null;
  }, [sortedItems]);

  const cancelMy = async (a: AppointmentListItem): Promise<void> => {
    if (!canCancel(a)) return;

    const ok = window.confirm("Na pewno anulować tę wizytę?");
    if (!ok) return;

    const reason = window.prompt("Powód anulowania (opcjonalnie):", "") ?? "";

    setActionLoadingId(a.id);
    setError(null);
    try {
      // Zostawiam Twoje istniejące wywołanie (tak jak w Twoim projekcie).
      // Jeśli masz już dedykowane POST /appointments/{id}/cancel_my/,
      // to podmień to na: await appointmentsAPI.cancelMy(a.id, reason.trim() ? reason.trim() : undefined)
      await appointmentsAPI.changeStatus(a.id, {
        status: "cancelled",
        cancellation_reason: reason.trim() ? reason.trim() : undefined,
      });
      await fetchMy();
    } catch (e) {
      console.error(e);
      setError("Nie udało się anulować rezerwacji.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Moje Rezerwacje</h1>
      <p style={{ opacity: 0.8 }}>Lista Twoich wizyt.</p>

      {/* Karta „Najbliższa wizyta” */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          background: "#fff",
          marginTop: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 10, fontSize: 18 }}>Najbliższa wizyta</h2>

        {nearestUpcoming ? (
          <div>
            <div style={{ marginBottom: 8 }}>
              <strong>{formatDateTimePL(nearestUpcoming.start)}</strong>
              <StatusBadge status={nearestUpcoming.status} label={nearestUpcoming.status_display} />
            </div>

            <div style={{ marginBottom: 4 }}>
              <strong>Usługa:</strong> {nearestUpcoming.service_name ?? "—"}
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong>Pracownik:</strong> {nearestUpcoming.employee_name ?? "—"}
            </div>

            {canCancel(nearestUpcoming) ? (
              <button
                onClick={() => void cancelMy(nearestUpcoming)}
                disabled={actionLoadingId === nearestUpcoming.id}
              >
                {actionLoadingId === nearestUpcoming.id ? "Anuluję..." : "Anuluj"}
              </button>
            ) : (
              <span style={{ color: "#777" }}>Nie można anulować tej wizyty.</span>
            )}
          </div>
        ) : (
          <div>Brak nadchodzących wizyt</div>
        )}
      </div>

      {/* Sterowanie (checkbox + liczniki) */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showUpcomingOnly}
            onChange={(e) => setShowUpcomingOnly(e.target.checked)}
          />
          Pokaż tylko nadchodzące
        </label>

        <div style={{ marginLeft: "auto" }}>
          Nadchodzące: <strong>{upcomingCount}</strong> / Wszystkie: <strong>{allCount}</strong>
        </div>
      </div>

      {loading && <p>Ładowanie...</p>}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {!loading && !error && (
        <ul style={{ marginTop: 12, paddingLeft: 18 }}>
          {visibleItems.length === 0 ? (
            <li>{showUpcomingOnly ? "Brak nadchodzących rezerwacji." : "Brak rezerwacji."}</li>
          ) : (
            visibleItems.map((a) => (
              <li key={a.id} style={{ marginBottom: 10 }}>
                <div>
                  <strong>{formatDateTimePL(a.start)}</strong> — {a.service_name ?? "—"} — {a.employee_name ?? "—"}
                  <StatusBadge status={a.status} label={a.status_display} />
                </div>

                <div style={{ marginTop: 6 }}>
                  <button
                    onClick={() => void cancelMy(a)}
                    disabled={!canCancel(a) || actionLoadingId === a.id}
                    title={!canCancel(a) ? "Nie można anulować tej wizyty" : "Anuluj"}
                  >
                    {actionLoadingId === a.id ? "Anuluję..." : "Anuluj"}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
