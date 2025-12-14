import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { isAxiosError } from "axios";
import { appointmentsAPI } from "../api/appointments";
import type { AppointmentListItem, AppointmentStatus } from "../types";
import { useAuth } from "../hooks/useAuth";
import {
  beautyButtonSecondaryStyle,
  beautyButtonStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
  beautyColors,
} from "../utils/ui";

type Tab = "client" | "employee-today" | "employee-upcoming";

const formatDT = (iso: string): string =>
  new Date(iso).toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

const statusLabel = (a: AppointmentListItem): string => a.status_display ?? a.status;

const canClientCancel = (a: AppointmentListItem): boolean =>
  a.status === "pending" || a.status === "confirmed";

const canEmployeeAccept = (a: AppointmentListItem): boolean => a.status === "pending";
const canEmployeeFinish = (a: AppointmentListItem): boolean =>
  a.status === "confirmed" || a.status === "in_progress";
const canEmployeeNoShow = (a: AppointmentListItem): boolean =>
  a.status === "confirmed" || a.status === "in_progress";

function extractError(err: unknown): string {
  if (!isAxiosError(err)) return "Nieznany błąd";
  const data = err.response?.data as unknown;

  if (typeof data === "object" && data !== null) {
    const d = (data as { detail?: unknown }).detail;
    if (typeof d === "string" && d.trim()) return d;

    const entries = Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          const first = v.find((x) => typeof x === "string") as string | undefined;
          return first ? `${k}: ${first}` : null;
        }
        if (typeof v === "string") return `${k}: ${v}`;
        return null;
      })
      .filter((x): x is string => Boolean(x));

    if (entries.length) return entries.join("\n");
  }

  return "Błąd zapytania do API";
}

type ModalVariant = "info" | "confirm" | "error";

function Modal(props: {
  open: boolean;
  title: string;
  message: string;
  variant: ModalVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
}): ReactElement | null {
  if (!props.open) return null;

  const isConfirm = props.variant === "confirm";
  const isError = props.variant === "error";

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };

  const boxStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 14,
    border: `1px solid ${beautyColors.border}`,
    boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
    overflow: "hidden",
  };

  const headerStyle: React.CSSProperties = {
    padding: "14px 16px",
    background: beautyColors.bg,
    borderBottom: `1px solid ${beautyColors.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: isError ? beautyColors.dangerDark : beautyColors.primaryDarker,
  };

  const bodyStyle: React.CSSProperties = {
    padding: 16,
    color: beautyColors.text,
    whiteSpace: "pre-line",
  };

  const footerStyle: React.CSSProperties = {
    padding: "12px 16px",
    borderTop: `1px solid ${beautyColors.border}`,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    background: "#fff",
  };

  const xBtnStyle: React.CSSProperties = {
    border: `1px solid ${beautyColors.border}`,
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 800,
    color: beautyColors.text,
  };

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div style={boxStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>{props.title}</h3>
          <button type="button" style={xBtnStyle} onClick={props.onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>

        <div style={bodyStyle}>{props.message}</div>

        <div style={footerStyle}>
          {isConfirm ? (
            <>
              <button
                type="button"
                style={beautyButtonSecondaryStyle}
                onClick={props.onClose}
              >
                {props.cancelText ?? "Anuluj"}
              </button>
              <button
                type="button"
                style={beautyButtonStyle}
                onClick={() => {
                  props.onConfirm?.();
                }}
              >
                {props.confirmText ?? "OK"}
              </button>
            </>
          ) : (
            <button type="button" style={beautyButtonStyle} onClick={props.onClose}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MyAppointmentsPage(): ReactElement {
  const { user, isClient, isEmployee, isManager } = useAuth();

  const [tab, setTab] = useState<Tab>("client");

  const [clientAppointments, setClientAppointments] = useState<AppointmentListItem[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentListItem[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentListItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cancelReason, setCancelReason] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>("info");
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalMessage, setModalMessage] = useState<string>("");
  const [modalConfirmText, setModalConfirmText] = useState<string>("OK");
  const [modalCancelText, setModalCancelText] = useState<string>("Anuluj");
  const [modalOnConfirm, setModalOnConfirm] = useState<(() => void) | undefined>(undefined);

  const openInfo = useCallback((title: string, message: string) => {
    setModalVariant("info");
    setModalTitle(title);
    setModalMessage(message);
    setModalConfirmText("OK");
    setModalCancelText("Anuluj");
    setModalOnConfirm(undefined);
    setModalOpen(true);
  }, []);

  const openError = useCallback((title: string, message: string) => {
    setModalVariant("error");
    setModalTitle(title);
    setModalMessage(message);
    setModalConfirmText("OK");
    setModalCancelText("Anuluj");
    setModalOnConfirm(undefined);
    setModalOpen(true);
  }, []);

  const openConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText?: string) => {
    setModalVariant("confirm");
    setModalTitle(title);
    setModalMessage(message);
    setModalConfirmText(confirmText ?? "Potwierdź");
    setModalCancelText("Anuluj");
    setModalOnConfirm(() => onConfirm);
    setModalOpen(true);
  }, []);

  useEffect(() => {
    if (isEmployee) setTab("employee-today");
    if (isClient) setTab("client");
  }, [isEmployee, isClient]);

  const loadClient = useCallback(async (): Promise<void> => {
    const res = await appointmentsAPI.myAppointments();
    setClientAppointments(res.data ?? []);
  }, []);

  const loadEmployeeToday = useCallback(async (): Promise<void> => {
    const res = await appointmentsAPI.today();
    setTodayAppointments(res.data ?? []);
  }, []);

  const loadEmployeeUpcoming = useCallback(async (): Promise<void> => {
    const res = await appointmentsAPI.upcoming();
    setUpcomingAppointments(res.data ?? []);
  }, []);

  const loadAll = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      if (isClient) {
        await loadClient();
      } else if (isEmployee) {
        await Promise.all([loadEmployeeToday(), loadEmployeeUpcoming()]);
      } else if (isManager) {
        await loadClient();
      } else {
        await loadClient();
      }
    } catch (e: unknown) {
      console.error(e);
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  }, [isClient, isEmployee, isManager, loadClient, loadEmployeeToday, loadEmployeeUpcoming]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const visibleList = useMemo(() => {
    if (tab === "client") return clientAppointments;
    if (tab === "employee-today") return todayAppointments;
    return upcomingAppointments;
  }, [tab, clientAppointments, todayAppointments, upcomingAppointments]);

  const cancelAppointment = async (id: number): Promise<void> => {
    setBusyId(id);
    setError(null);

    try {
      await appointmentsAPI.cancelMy(id, cancelReason);
      setCancelReason("");
      await loadAll();
      openInfo("Gotowe", "Wizyta anulowana.");
    } catch (e: unknown) {
      console.error(e);
      const msg = extractError(e);
      setError(msg);
      openError("Błąd", msg);
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (id: number, status: AppointmentStatus): Promise<void> => {
    setBusyId(id);
    setError(null);

    try {
      await appointmentsAPI.changeStatus(id, { status });
      await loadAll();
      openInfo("Gotowe", "Status zapisany.");
    } catch (e: unknown) {
      console.error(e);
      const msg = extractError(e);
      setError(msg);
      openError("Błąd", msg);
    } finally {
      setBusyId(null);
    }
  };

  const askCancel = (id: number): void => {
    openConfirm(
      "Anulować wizytę?",
      "Czy na pewno chcesz anulować tę wizytę?",
      () => void cancelAppointment(id),
      "Anuluj wizytę"
    );
  };

  const askAccept = (id: number): void => {
    openConfirm(
      "Akceptować wizytę?",
      "Czy na pewno chcesz zaakceptować wizytę i oznaczyć ją jako „Potwierdzona”?",
      () => void changeStatus(id, "confirmed"),
      "Akceptuj"
    );
  };

  const askComplete = (id: number): void => {
    openConfirm(
      "Oznaczyć jako zrealizowaną?",
      "Czy na pewno chcesz oznaczyć tę wizytę jako „Zrealizowana”?",
      () => void changeStatus(id, "completed"),
      "Zrealizowana"
    );
  };

  const askNoShow = (id: number): void => {
    openConfirm(
      "Oznaczyć nieobecność?",
      "Czy na pewno chcesz oznaczyć wizytę jako „Nieobecność klienta”?",
      () => void changeStatus(id, "no_show"),
      "Nieobecność"
    );
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Ładowanie wizyt…</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={beautyPageTitleStyle}>{isEmployee ? "Wizyty pracownika" : "Moje wizyty"}</h1>

      {error ? (
        <div
          style={{
            marginBottom: 14,
            padding: 10,
            borderRadius: 10,
            background: "#ffe3ef",
            whiteSpace: "pre-line",
          }}
        >
          <strong>Błąd:</strong> {error}
        </div>
      ) : null}

      {isEmployee ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            style={tab === "employee-today" ? beautyButtonStyle : beautyButtonSecondaryStyle}
            onClick={() => setTab("employee-today")}
          >
            Dzisiaj ({todayAppointments.length})
          </button>
          <button
            type="button"
            style={tab === "employee-upcoming" ? beautyButtonStyle : beautyButtonSecondaryStyle}
            onClick={() => setTab("employee-upcoming")}
          >
            Nadchodzące ({upcomingAppointments.length})
          </button>
          <button type="button" style={beautyButtonSecondaryStyle} onClick={() => void loadAll()}>
            Odśwież
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button type="button" style={beautyButtonSecondaryStyle} onClick={() => void loadAll()}>
            Odśwież
          </button>
        </div>
      )}

      {isClient ? (
        <div style={{ ...beautyCardStyle, marginBottom: 12 }}>
          <div style={beautyCardHeaderStyle}>Anulowanie (opcjonalny powód)</div>
          <div style={beautyCardBodyStyle}>
            <input
              style={beautyInputStyle}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Powód anulowania (może być pusty)"
            />
            <div style={beautyMutedTextStyle}>
              Przycisk „Anuluj” pojawia się tylko dla statusów: pending/confirmed.
            </div>
          </div>
        </div>
      ) : null}

      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          {isEmployee ? (tab === "employee-today" ? "Dzisiejsze wizyty" : "Nadchodzące wizyty") : "Lista wizyt"}
        </div>

        <div style={beautyCardBodyStyle}>
          {visibleList.length === 0 ? (
            <div style={beautyMutedTextStyle}>Brak wizyt.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(233, 30, 99, 0.20)" }}>
                  <th style={{ padding: 10 }}>Termin</th>
                  <th style={{ padding: 10 }}>Usługa</th>
                  <th style={{ padding: 10 }}>{isEmployee ? "Klient" : "Pracownik"}</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>Akcje</th>
                </tr>
              </thead>

              <tbody>
                {visibleList.map((a) => {
                  const showEmployeeTodayActions = isEmployee && tab === "employee-today";
                  const showEmployeeUpcomingActions = isEmployee && tab === "employee-upcoming";

                  return (
                    <tr key={a.id} style={{ borderBottom: "1px solid rgba(233, 30, 99, 0.10)" }}>
                      <td style={{ padding: 10 }}>
                        {isEmployee && tab === "employee-today" ? formatTime(a.start) : formatDT(a.start)}
                      </td>
                      <td style={{ padding: 10 }}>{a.service_name}</td>
                      <td style={{ padding: 10 }}>{isEmployee ? a.client_name ?? "—" : a.employee_name}</td>
                      <td style={{ padding: 10 }}>{statusLabel(a)}</td>
                      <td style={{ padding: 10 }}>
                        {isClient && canClientCancel(a) ? (
                          <button
                            type="button"
                            style={beautyButtonSecondaryStyle}
                            disabled={busyId === a.id}
                            onClick={() => askCancel(a.id)}
                          >
                            {busyId === a.id ? "…" : "Anuluj"}
                          </button>
                        ) : null}

                        {isEmployee ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {/* UPCOMING: tylko Akceptuj (bo nie powinno być Zrealizowana/Nieobecność) */}
                            {showEmployeeUpcomingActions && canEmployeeAccept(a) ? (
                              <button
                                type="button"
                                style={beautyButtonStyle}
                                disabled={busyId === a.id}
                                onClick={() => askAccept(a.id)}
                              >
                                {busyId === a.id ? "…" : "Akceptuj"}
                              </button>
                            ) : null}

                            {/* TODAY: Akceptuj + Zrealizowana + Nieobecność */}
                            {showEmployeeTodayActions && canEmployeeAccept(a) ? (
                              <button
                                type="button"
                                style={beautyButtonStyle}
                                disabled={busyId === a.id}
                                onClick={() => askAccept(a.id)}
                              >
                                {busyId === a.id ? "…" : "Akceptuj"}
                              </button>
                            ) : null}

                            {showEmployeeTodayActions && canEmployeeFinish(a) ? (
                              <button
                                type="button"
                                style={beautyButtonStyle}
                                disabled={busyId === a.id}
                                onClick={() => askComplete(a.id)}
                              >
                                {busyId === a.id ? "…" : "Zrealizowana"}
                              </button>
                            ) : null}

                            {showEmployeeTodayActions && canEmployeeNoShow(a) ? (
                              <button
                                type="button"
                                style={beautyButtonSecondaryStyle}
                                disabled={busyId === a.id}
                                onClick={() => askNoShow(a.id)}
                              >
                                {busyId === a.id ? "…" : "Nieobecność"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isManager ? (
        <div style={{ marginTop: 12, ...beautyMutedTextStyle }}>
          Manager: pełne zarządzanie wizytami masz w panelu „Wizyty – zarządzanie”.
        </div>
      ) : null}

      <div style={{ marginTop: 14, ...beautyMutedTextStyle }}>
        Zalogowany jako: {user?.email ?? "—"} ({user?.role ?? "—"})
      </div>

      <Modal
        open={modalOpen}
        title={modalTitle}
        message={modalMessage}
        variant={modalVariant}
        confirmText={modalConfirmText}
        cancelText={modalCancelText}
        onConfirm={() => {
          setModalOpen(false);
          modalOnConfirm?.();
        }}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
