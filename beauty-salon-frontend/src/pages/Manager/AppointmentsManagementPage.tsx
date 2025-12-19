import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { isAxiosError } from "axios";
import { appointmentsAPI } from "@/shared/api/appointments";
import { AppointmentFormModal } from "@/features/manager/components/AppointmentFormModal";
import type { AppointmentListItem, AppointmentStatus, PaginatedResponse } from "@/shared/types";
import {
  beautyButtonSecondaryStyle,
  beautyButtonStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyColors,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
  beautySelectStyle,
} from "@/shared/utils/ui";

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
    maxWidth: 560,
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
              <button type="button" style={beautyButtonSecondaryStyle} onClick={props.onClose}>
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

function safeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return null;
}

function safeObj(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function formatMoney(v: unknown): string | null {
  const s = safeString(v);
  if (!s) return null;
  const normalized = s.replace(".", ",");
  return `${normalized} zł`;
}

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

function formatDurationHHMMSS(v: unknown): string | null {
  const s = safeString(v);
  if (!s) return null;
  const parts = s.split(":").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return s;
  const totalMin = parts[0] * 60 + parts[1];
  return `${totalMin} min`;
}

function DetailsModal(props: {
  open: boolean;
  title: string;
  loading: boolean;
  error: string | null;
  data: unknown;
  onClose: () => void;
}): ReactElement | null {
  const obj = safeObj(props.data);

  const clientObj = safeObj(obj?.client);
  const employeeObj = safeObj(obj?.employee);
  const serviceObj = safeObj(obj?.service);

  const clientNameCandidate = safeString(clientObj?.full_name);
  const clientFirst = safeString(clientObj?.first_name);
  const clientLast = safeString(clientObj?.last_name);

  const parts = [clientFirst, clientLast].filter((x): x is string => Boolean(x));
  const joinedClientName = parts.length > 0 ? parts.join(" ") : null;

  const clientName = clientNameCandidate ?? joinedClientName;

  const employeeName = safeString(employeeObj?.full_name) ?? null;
  const serviceName = safeString(serviceObj?.name) ?? null;

  const startISO = safeString(obj?.start);
  const endISO = safeString(obj?.end);

  const statusDisplay = safeString(obj?.status_display) ?? safeString(obj?.status);
  const timespan = safeString(obj?.timespan) ?? null;
  const bookingChannel = safeString(obj?.booking_channel) ?? null;

  const clientNotes = safeString(obj?.client_notes) ?? safeString(obj?.notes) ?? null;
  const internalNotes = safeString(obj?.internal_notes) ?? null;

  const cancellationReason = safeString(obj?.cancellation_reason) ?? safeString(obj?.cancel_reason) ?? null;

  const serviceCategory = safeString(serviceObj?.category) ?? null;
  const servicePrice = formatMoney(serviceObj?.price_with_promotion) ?? formatMoney(serviceObj?.price);
  const serviceDuration = formatDurationHHMMSS(serviceObj?.duration);

  const clientEmail = safeString(clientObj?.email) ?? safeString(clientObj?.user_email) ?? null;
  const clientPhone = safeString(clientObj?.phone) ?? null;
  const clientNumber = safeString(clientObj?.number) ?? null;

  if (!props.open) return null;

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
    maxWidth: 760,
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
    color: beautyColors.primaryDarker,
  };

  const bodyStyle: React.CSSProperties = {
    padding: 16,
    color: beautyColors.text,
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

  const sectionBoxStyle: React.CSSProperties = {
    border: `1px solid ${beautyColors.border}`,
    borderRadius: 12,
    padding: 12,
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

        <div style={bodyStyle}>
          {props.loading ? <div style={{ padding: 8 }}>Ładowanie…</div> : null}

          {!props.loading && props.error ? (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "#ffe3ef", whiteSpace: "pre-line" }}>
              <strong>Błąd:</strong> {props.error}
            </div>
          ) : null}

          {!props.loading && !props.error ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div style={sectionBoxStyle}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Wizyta</div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, columnGap: 10 }}>
                    <div style={beautyMutedTextStyle as any}>Status:</div>
                    <div>
                      <strong>{statusDisplay ?? "—"}</strong>
                    </div>

                    <div style={beautyMutedTextStyle as any}>Start:</div>
                    <div>{formatDateTime(startISO) ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Koniec:</div>
                    <div>{formatDateTime(endISO) ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Czas trwania:</div>
                    <div>{timespan ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Kanał:</div>
                    <div>{bookingChannel ?? "—"}</div>
                  </div>
                </div>

                <div style={sectionBoxStyle}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Usługa</div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, columnGap: 10 }}>
                    <div style={beautyMutedTextStyle as any}>Nazwa:</div>
                    <div>{serviceName ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Kategoria:</div>
                    <div>{serviceCategory ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Cena:</div>
                    <div>{servicePrice ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Czas:</div>
                    <div>{serviceDuration ?? "—"}</div>
                  </div>
                </div>

                <div style={sectionBoxStyle}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Klient</div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, columnGap: 10 }}>
                    <div style={beautyMutedTextStyle as any}>Numer:</div>
                    <div>{clientNumber ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Imię i nazwisko:</div>
                    <div>{clientName ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Email:</div>
                    <div>{clientEmail ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Telefon:</div>
                    <div>{clientPhone ?? "—"}</div>
                  </div>
                </div>

                <div style={sectionBoxStyle}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Notatki</div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, columnGap: 10 }}>
                    <div style={beautyMutedTextStyle as any}>Klienta:</div>
                    <div style={{ whiteSpace: "pre-line" }}>{clientNotes ?? "—"}</div>

                    <div style={beautyMutedTextStyle as any}>Wewnętrzne:</div>
                    <div style={{ whiteSpace: "pre-line" }}>{internalNotes ?? "—"}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, ...sectionBoxStyle }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Anulowanie</div>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, columnGap: 10 }}>
                  <div style={beautyMutedTextStyle as any}>Powód:</div>
                  <div style={{ whiteSpace: "pre-line" }}>{cancellationReason ?? "—"}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div style={footerStyle}>
          <button type="button" style={beautyButtonStyle} onClick={props.onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

const statusOptions: { value: "" | AppointmentStatus; label: string }[] = [
  { value: "", label: "Wszystkie" },
  { value: "pending", label: "Oczekująca" },
  { value: "confirmed", label: "Potwierdzona" },
  { value: "in_progress", label: "W trakcie" },
  { value: "completed", label: "Zrealizowana" },
  { value: "cancelled", label: "Anulowana" },
  { value: "no_show", label: "Nieobecność" },
];

const formatDT = (iso: string): string => new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });

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

export function AppointmentsManagementPage(): ReactElement {
  const [data, setData] = useState<PaginatedResponse<AppointmentListItem> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"" | AppointmentStatus>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<ModalVariant>("info");
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalMessage, setModalMessage] = useState<string>("");
  const [modalConfirmText, setModalConfirmText] = useState<string>("OK");
  const [modalCancelText, setModalCancelText] = useState<string>("Anuluj");
  const [modalOnConfirm, setModalOnConfirm] = useState<(() => void) | undefined>(undefined);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsTitle, setDetailsTitle] = useState<string>("");
  const [detailsData, setDetailsData] = useState<unknown>(null);

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

  const params = useMemo(() => {
    const p: Record<string, unknown> = {
      ordering: "-id",
      page,
      page_size: pageSize,
    };

    if (status) p.status = status;

    const e = Number(employeeId);
    const c = Number(clientId);
    const s = Number(serviceId);

    if (employeeId.trim() && Number.isFinite(e) && e > 0) p.employee = e;
    if (clientId.trim() && Number.isFinite(c) && c > 0) p.client = c;
    if (serviceId.trim() && Number.isFinite(s) && s > 0) p.service = s;

    if (dateFrom.trim()) p.date_from = dateFrom.trim();
    if (dateTo.trim()) p.date_to = dateTo.trim();

    return p;
  }, [status, employeeId, clientId, serviceId, dateFrom, dateTo, page, pageSize]);

  const loadAppointments = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const res = await appointmentsAPI.list(params as any);
      setData(res.data);
    } catch (e: unknown) {
      console.error(e);
      const msg = extractError(e);
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const applyFilters = (): void => {
    setPage(1);
    void loadAppointments();
  };

  const clearFilters = (): void => {
    setStatus("");
    setEmployeeId("");
    setClientId("");
    setServiceId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    void loadAppointments();
  };

  const changeStatus = useCallback(
    async (appointmentId: number, newStatus: AppointmentStatus): Promise<void> => {
      setBusyId(appointmentId);
      setError(null);

      try {
        await appointmentsAPI.changeStatus(appointmentId, { status: newStatus });
        await loadAppointments();
        openInfo("Gotowe", "Status zapisany.");
      } catch (e: unknown) {
        console.error(e);
        const msg = extractError(e);
        setError(msg);
        openError("Błąd", msg);
      } finally {
        setBusyId(null);
      }
    },
    [loadAppointments, openError, openInfo]
  );

  const askChangeStatus = (a: AppointmentListItem, newStatus: AppointmentStatus, label: string): void => {
    openConfirm(
      "Zmienić status?",
      `Czy na pewno chcesz ustawić status wizyty #${a.id} na: ${label}?`,
      () => void changeStatus(a.id, newStatus),
      "Zapisz"
    );
  };

  const openDetails = useCallback(async (a: AppointmentListItem): Promise<void> => {
    setDetailsTitle(`Szczegóły wizyty #${a.id}`);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);
    setDetailsData(null);

    try {
      const res = await appointmentsAPI.detail(a.id);
      setDetailsData(res.data);
    } catch (e: unknown) {
      console.error(e);
      setDetailsError(extractError(e));
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const results = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ padding: 20, maxWidth: 1250, margin: "0 auto" }}>
      <h1 style={beautyPageTitleStyle}>Wizyty – zarządzanie</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" style={beautyButtonStyle} onClick={() => setCreateOpen(true)}>
          Dodaj wizytę
        </button>
        <button type="button" style={beautyButtonSecondaryStyle} onClick={() => void loadAppointments()}>
          Odśwież listę
        </button>
      </div>

      {loading ? <div style={{ padding: 10 }}>Ładowanie wizyt…</div> : null}

      {error ? (
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: "#ffe3ef", whiteSpace: "pre-line" }}>
          <strong>Błąd:</strong> {error}
        </div>
      ) : null}

      <div style={{ ...beautyCardStyle, marginBottom: 12 }}>
        <div style={beautyCardHeaderStyle}>Filtry</div>
        <div style={beautyCardBodyStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Status</div>
              <select style={beautySelectStyle} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                {statusOptions.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Pracownik ID</div>
              <input style={beautyInputStyle} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="np. 3" />
            </label>

            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Klient ID</div>
              <input style={beautyInputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="np. 12" />
            </label>

            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Usługa ID</div>
              <input style={beautyInputStyle} value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="np. 5" />
            </label>

            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Data od</div>
              <input style={beautyInputStyle} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>

            <label style={{ display: "block" }}>
              <div style={{ marginBottom: 6 }}>Data do</div>
              <input style={beautyInputStyle} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <button type="button" style={beautyButtonStyle} onClick={applyFilters}>
              Zastosuj
            </button>
            <button type="button" style={beautyButtonSecondaryStyle} onClick={clearFilters}>
              Wyczyść
            </button>
            <button type="button" style={beautyButtonSecondaryStyle} onClick={() => void loadAppointments()}>
              Odśwież
            </button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={beautyMutedTextStyle as any}>Na stronę:</span>
              <select
                style={{ ...beautySelectStyle, width: 120 }}
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPageSize(Number.isFinite(v) && v > 0 ? v : 20);
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div style={{ ...beautyMutedTextStyle, marginTop: 8 }}>
            Wyniki: {total} • Strona {page} / {totalPages}
          </div>
        </div>
      </div>

      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>Lista wizyt</div>
        <div style={beautyCardBodyStyle}>
          {results.length === 0 ? (
            <div style={beautyMutedTextStyle}>Brak wyników.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1020 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: `1px solid ${beautyColors.border}` }}>
                    <th style={{ padding: 10 }}>ID</th>
                    <th style={{ padding: 10 }}>Klient</th>
                    <th style={{ padding: 10 }}>Pracownik</th>
                    <th style={{ padding: 10 }}>Usługa</th>
                    <th style={{ padding: 10 }}>Termin</th>
                    <th style={{ padding: 10 }}>Status</th>
                    <th style={{ padding: 10 }}>Akcje</th>
                  </tr>
                </thead>

                <tbody>
                  {results.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid rgba(233, 30, 99, 0.10)" }}>
                      <td style={{ padding: 10, fontWeight: 800 }}>#{a.id}</td>
                      <td style={{ padding: 10 }}>{a.client_name ?? "—"}</td>
                      <td style={{ padding: 10 }}>{a.employee_name}</td>
                      <td style={{ padding: 10 }}>{a.service_name}</td>
                      <td style={{ padding: 10 }}>{formatDT(a.start)}</td>
                      <td style={{ padding: 10 }}>{a.status_display ?? a.status}</td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" style={beautyButtonSecondaryStyle} disabled={busyId === a.id} onClick={() => void openDetails(a)}>
                            Szczegóły
                          </button>

                          {a.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                style={beautyButtonStyle}
                                disabled={busyId === a.id}
                                onClick={() => askChangeStatus(a, "confirmed", "Potwierdzona")}
                              >
                                {busyId === a.id ? "…" : "Potwierdź"}
                              </button>
                              <button
                                type="button"
                                style={beautyButtonSecondaryStyle}
                                disabled={busyId === a.id}
                                onClick={() => askChangeStatus(a, "cancelled", "Anulowana")}
                              >
                                {busyId === a.id ? "…" : "Anuluj"}
                              </button>
                            </>
                          ) : null}

                          {a.status === "confirmed" ? (
                            <>
                              <button
                                type="button"
                                style={beautyButtonStyle}
                                disabled={busyId === a.id}
                                onClick={() => askChangeStatus(a, "in_progress", "W trakcie")}
                              >
                                {busyId === a.id ? "…" : "Rozpocznij"}
                              </button>
                              <button
                                type="button"
                                style={beautyButtonSecondaryStyle}
                                disabled={busyId === a.id}
                                onClick={() => askChangeStatus(a, "no_show", "Nieobecność")}
                              >
                                {busyId === a.id ? "…" : "No-show"}
                              </button>
                              <button
                                type="button"
                                style={beautyButtonSecondaryStyle}
                                disabled={busyId === a.id}
                                onClick={() => askChangeStatus(a, "cancelled", "Anulowana")}
                              >
                                {busyId === a.id ? "…" : "Anuluj"}
                              </button>
                            </>
                          ) : null}

                          {a.status === "in_progress" ? (
                            <>
                              <button
                                type="button"
                                style={beautyButtonStyle}
                                disabled={busyId === a.id}
                                onClick={() => askChangeStatus(a, "completed", "Zrealizowana")}
                              >
                                {busyId === a.id ? "…" : "Zakończ"}
                              </button>
                              <button
                                type="button"
                                style={beautyButtonSecondaryStyle}
                                disabled={busyId === a.id}
                                onClick={() => askChangeStatus(a, "no_show", "Nieobecność")}
                              >
                                {busyId === a.id ? "…" : "No-show"}
                              </button>
                            </>
                          ) : null}

                          {(a.status === "completed" || a.status === "cancelled" || a.status === "no_show") && (
                            <span style={beautyMutedTextStyle}>Brak akcji</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <button type="button" style={beautyButtonSecondaryStyle} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Poprzednia
            </button>
            <button
              type="button"
              style={beautyButtonSecondaryStyle}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Następna
            </button>
            <div style={{ ...beautyMutedTextStyle, marginLeft: "auto" }}>
              Strona {page} / {totalPages}
            </div>
          </div>
        </div>
      </div>

      <AppointmentFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        allowIgnoreTimeOff
        onSuccess={() => {
          void loadAppointments();
          openInfo("Gotowe", "Wizyta została utworzona.");
        }}
      />

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

      <DetailsModal
        open={detailsOpen}
        title={detailsTitle}
        loading={detailsLoading}
        error={detailsError}
        data={detailsData}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  );
}
