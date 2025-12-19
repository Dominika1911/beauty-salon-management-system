import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { isAxiosError } from "axios";

import { appointmentsAPI } from "@/shared/api/appointments";
import { availabilityAPI, type AvailabilitySlot } from "@/shared/api/availability";
import { employeesAPI } from "@/shared/api/employees";
import { clientsAPI } from "@/shared/api/clients";

import type { AppointmentCreateData, AppointmentListItem, AppointmentStatus, Client, Employee, Service } from "@/shared/types";
import { useAuth } from "@/shared/hooks/useAuth";
import { AppointmentDetailsModal } from "@/features/appointments/components/AppointmentDetailsModal";
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
  beautySelectStyle,
} from "@/shared/utils/ui";

// Zamiast stanu zakładek (tab) pokazujemy osobne sekcje dla wizyt dzisiaj oraz nadchodzących.

// ===== helpers dat/slots (kopiowane jak w BookAppointmentPage – bez refactoru) =====
const yyyyMmDd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const parseYyyyMmDdLocal = (s: string): Date => {
  const [y, m, d] = s.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
};

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

const formatTimePL = (iso: string): string => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(d);
};

const statusLabel = (a: AppointmentListItem): string => a.status_display ?? a.status;

const canClientCancel = (a: AppointmentListItem): boolean => a.status === "pending" || a.status === "confirmed";

// Employee flow:
const canEmployeeAccept = (a: AppointmentListItem): boolean => a.status === "pending";
const canEmployeeStart = (a: AppointmentListItem): boolean => a.status === "confirmed";
const canEmployeeFinish = (a: AppointmentListItem): boolean => a.status === "in_progress";
const canEmployeeNoShow = (a: AppointmentListItem): boolean => a.status === "confirmed" || a.status === "in_progress";

// Przesunięcie (reschedule) wizyty przez pracownika możliwe tylko dla przyszłych wizyt
// o statusie oczekującym lub potwierdzonym. Zmiana terminu w przeszłości jest
// niemożliwa, a wizyty w trakcie lub zakończone również nie kwalifikują się do
// zmiany terminu.
const canEmployeeReschedule = (a: AppointmentListItem): boolean => {
  const startDate = new Date(a.start);
  const now = new Date();
  return startDate > now && (a.status === "pending" || a.status === "confirmed");
};

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

type DayKey = string; // YYYY-MM-DD

export function MyAppointmentsPage(): ReactElement {
  const { user, isClient, isEmployee, isManager } = useAuth();

  // brak stanu zakładek – wizyty dzisiaj i nadchodzące będą wyświetlane osobno

  const [clientAppointments, setClientAppointments] = useState<AppointmentListItem[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentListItem[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentListItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cancelReason, setCancelReason] = useState<string>("");

  // ====== Szczegóły wizyty (wspólny modal) ======
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [detailsAppointmentId, setDetailsAppointmentId] = useState<number | null>(null);
  const openDetails = (id: number): void => {
    setDetailsAppointmentId(id);
    setDetailsOpen(true);
  };
  const closeDetails = (): void => {
    setDetailsOpen(false);
    setDetailsAppointmentId(null);
  };

  // ====== Employee: tworzenie wizyty ======
  const [employeeMe, setEmployeeMe] = useState<Employee | null>(null);
  const [employeeServices, setEmployeeServices] = useState<Service[]>([]);
  const [employeeServicesLoading, setEmployeeServicesLoading] = useState<boolean>(false);

  const [clientSearch, setClientSearch] = useState<string>("");
  const [clientSearchLoading, setClientSearchLoading] = useState<boolean>(false);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [serviceId, setServiceId] = useState<number | "">("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // zakres 7 dni jak w rezerwacji klienta
  const [dateFromStr, setDateFromStr] = useState<string>(yyyyMmDd(new Date()));
  const [activeDayStr, setActiveDayStr] = useState<string>(yyyyMmDd(new Date()));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedStart, setSelectedStart] = useState<string>("");

  const [internalNotes, setInternalNotes] = useState<string>("");

  // ==== Reschedule (employee) state ====
  /**
   * W ramach zmiany terminu wizyty pracownik może wybrać nowy slot
   * w nadchodzącym tygodniu. Przy przejściu w tryb zmiany terminu
   * zapisywana jest wizyta, której termin chcemy zmienić, a także
   * zakres dat oraz wybrane sloty.
   */
  const [rescheduleAppointment, setRescheduleAppointment] = useState<AppointmentListItem | null>(null);
  // początek zakresu dat (YYYY-MM-DD) – domyślnie dziś; pozwala przesuwać zakres
  const [rescheduleDateFromStr, setRescheduleDateFromStr] = useState<string>(yyyyMmDd(new Date()));
  // aktywny dzień wybrany w zakresie dat – domyślnie pierwszy dzień zakresu
  const [rescheduleActiveDayStr, setRescheduleActiveDayStr] = useState<string>(yyyyMmDd(new Date()));
  // dostępne sloty dla zmiany terminu
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailabilitySlot[]>([]);
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState<boolean>(false);
  // wybrany slot startu w ISO
  const [rescheduleSelectedStart, setRescheduleSelectedStart] = useState<string>("");

  // modal
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

  const openConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, confirmText?: string) => {
      setModalVariant("confirm");
      setModalTitle(title);
      setModalMessage(message);
      setModalConfirmText(confirmText ?? "Potwierdź");
      setModalCancelText("Anuluj");
      setModalOnConfirm(() => onConfirm);
      setModalOpen(true);
    },
    []
  );

  // Nie ustawiamy zakładek na podstawie roli – sekcje są zawsze widoczne

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

  const loadEmployeeMeAndServices = useCallback(async (): Promise<void> => {
    setEmployeeServicesLoading(true);
    try {
      const meRes = await employeesAPI.me();
      const me = meRes.data;
      setEmployeeMe(me);

      const servicesRes = await employeesAPI.services(me.id);
      setEmployeeServices(servicesRes.data ?? []);
    } catch (e: unknown) {
      console.error(e);
      openError("Błąd", extractError(e));
      setEmployeeMe(null);
      setEmployeeServices([]);
    } finally {
      setEmployeeServicesLoading(false);
    }
  }, [openError]);

  const loadAll = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      if (isClient) {
        await loadClient();
      } else if (isEmployee) {
        await Promise.all([loadEmployeeToday(), loadEmployeeUpcoming(), loadEmployeeMeAndServices()]);
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
  }, [isClient, isEmployee, isManager, loadClient, loadEmployeeToday, loadEmployeeUpcoming, loadEmployeeMeAndServices]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brak zmiennej visibleList – listy wyświetlane są osobno dla pracownika i klienta

  const dateRange = useMemo(() => {
    const from = parseYyyyMmDdLocal(dateFromStr);
    const days: { key: DayKey; date: Date }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(from, i);
      days.push({ key: yyyyMmDd(d), date: d });
    }
    const toStr = days[days.length - 1]?.key ?? dateFromStr;
    return { fromStr: dateFromStr, toStr, days };
  }, [dateFromStr]);

  // Zakres 7 dni dla zmiany terminu (employee reschedule)
  const rescheduleDateRange = useMemo(() => {
    const from = parseYyyyMmDdLocal(rescheduleDateFromStr);
    const days: { key: DayKey; date: Date }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(from, i);
      days.push({ key: yyyyMmDd(d), date: d });
    }
    const toStr = days[days.length - 1]?.key ?? rescheduleDateFromStr;
    return { fromStr: rescheduleDateFromStr, toStr, days };
  }, [rescheduleDateFromStr]);

  const refreshSlots = useCallback(async (): Promise<void> => {
    if (!employeeMe) return;
    if (serviceId === "") return;

    setLoadingSlots(true);
    setSelectedStart("");
    setSlots([]);

    try {
      const res = await availabilityAPI.getSlots({
        employee: employeeMe.id,
        service: serviceId,
        date_from: dateRange.fromStr,
        date_to: dateRange.toStr,
      });

      const newSlots = res.data?.slots ?? [];
      setSlots(newSlots);

      // pilnujemy, żeby activeDay był w zakresie i miał sloty (jeśli nie ma – przeskok na pierwszy dzień z terminami)
      const inRange = dateRange.days.some((d) => d.key === activeDayStr);
      if (!inRange) {
        setActiveDayStr(dateRange.fromStr);
      } else {
        const anyForActive = newSlots.some((s) => yyyyMmDd(new Date(s.start)) === activeDayStr);
        if (!anyForActive) {
          const firstDayWithSlots = dateRange.days.find((d) => newSlots.some((s) => yyyyMmDd(new Date(s.start)) === d.key));
          if (firstDayWithSlots) setActiveDayStr(firstDayWithSlots.key);
        }
      }
    } catch (e: unknown) {
      console.error(e);
      openError("Błąd", extractError(e));
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [activeDayStr, dateRange.fromStr, dateRange.toStr, employeeMe, openError, serviceId]);

  /**
   * Pobierz dostępne sloty dla zmiany terminu wizyty. Skorzystaj z API /availability/slots,
   * przekazując identyfikator pracownika i usługi pochodzące z wizyty, której termin
   * chcemy zmienić. Zakres dat pobierany jest z rescheduleDateRange.
   */
  const refreshRescheduleSlots = useCallback(async (): Promise<void> => {
    if (!rescheduleAppointment) return;
    // jeżeli brak przypisanej wizyty, nic nie robimy
    const employeeId = rescheduleAppointment.employee ?? null;
    const serviceIdRes = rescheduleAppointment.service ?? null;
    if (!employeeId || !serviceIdRes) return;

    setRescheduleLoadingSlots(true);
    setRescheduleSelectedStart("");
    setRescheduleSlots([]);

    try {
      const res = await availabilityAPI.getSlots({
        employee: employeeId,
        service: serviceIdRes,
        date_from: rescheduleDateRange.fromStr,
        date_to: rescheduleDateRange.toStr,
      });
      const newSlots: AvailabilitySlot[] = res.data?.slots ?? [];
      setRescheduleSlots(newSlots);
      // dbamy, żeby aktywny dzień był w zakresie i zawierał sloty
      const inRange = rescheduleDateRange.days.some((d) => d.key === rescheduleActiveDayStr);
      if (!inRange) {
        setRescheduleActiveDayStr(rescheduleDateRange.fromStr);
      } else {
        const anyForActive = newSlots.some((s) => yyyyMmDd(new Date(s.start)) === rescheduleActiveDayStr);
        if (!anyForActive) {
          const firstDayWithSlots = rescheduleDateRange.days.find((d) => newSlots.some((s) => yyyyMmDd(new Date(s.start)) === d.key));
          if (firstDayWithSlots) setRescheduleActiveDayStr(firstDayWithSlots.key);
        }
      }
    } catch (e: unknown) {
      console.error(e);
      openError("Błąd", extractError(e));
      setRescheduleSlots([]);
    } finally {
      setRescheduleLoadingSlots(false);
    }
  }, [rescheduleAppointment, rescheduleDateRange.fromStr, rescheduleDateRange.toStr, rescheduleDateRange.days, rescheduleActiveDayStr, openError]);

  // odśwież sloty gdy zmienia się usługa / zakres
  useEffect(() => {
    if (!isEmployee) return;
    if (!employeeMe) return;
    if (serviceId === "") return;
    void refreshSlots();
  }, [isEmployee, employeeMe, serviceId, dateFromStr, refreshSlots]);

  // Podczas zmiany terminu pobieraj sloty za każdym razem, gdy zmienia się zakres dat
  // lub wizyta do zmiany. Nie wczytujemy jednak slotów, jeśli tryb zmiany nie jest aktywny.
  useEffect(() => {
    if (!rescheduleAppointment) return;
    void refreshRescheduleSlots();
  }, [rescheduleAppointment, rescheduleDateRange.fromStr, rescheduleDateRange.toStr, refreshRescheduleSlots]);

  const slotsForActiveDay = useMemo(() => {
    return slots.filter((s) => yyyyMmDd(new Date(s.start)) === activeDayStr);
  }, [slots, activeDayStr]);

  // Sloty dostępne dla aktywnego dnia w trybie zmiany terminu
  const rescheduleSlotsForActiveDay = useMemo(() => {
    return rescheduleSlots.filter((s) => yyyyMmDd(new Date(s.start)) === rescheduleActiveDayStr);
  }, [rescheduleSlots, rescheduleActiveDayStr]);

  const searchClients = useCallback(async (): Promise<void> => {
    const q = clientSearch.trim();
    if (!q) {
      setClientResults([]);
      return;
    }

    setClientSearchLoading(true);
    try {
      const res = await clientsAPI.list({ search: q, page: 1, page_size: 10 });
      setClientResults(res.data?.results ?? []);
    } catch (e: unknown) {
      console.error(e);
      openError("Błąd", extractError(e));
      setClientResults([]);
    } finally {
      setClientSearchLoading(false);
    }
  }, [clientSearch, openError]);

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
    openConfirm("Anulować wizytę?", "Czy na pewno chcesz anulować tę wizytę?", () => void cancelAppointment(id), "Anuluj wizytę");
  };

  const askAccept = (id: number): void => {
    openConfirm(
      "Akceptować wizytę?",
      "Czy na pewno chcesz zaakceptować wizytę i oznaczyć ją jako „Potwierdzona”?",
      () => void changeStatus(id, "confirmed"),
      "Akceptuj"
    );
  };

  const askStart = (id: number): void => {
    openConfirm(
      "Rozpocząć wizytę?",
      "Czy na pewno chcesz oznaczyć tę wizytę jako „W trakcie”?",
      () => void changeStatus(id, "in_progress"),
      "Rozpocznij"
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

  /**
   * Rozpocznij proces zmiany terminu wizyty. Ustawia stan rescheduleAppointment na
   * wskazaną wizytę, resetuje zakres dat na dzisiejszy dzień oraz czyści wybrany slot.
   * Następnie pobiera dostępne sloty w bieżącym zakresie.
   */
  const openReschedule = (appointment: AppointmentListItem): void => {
    setRescheduleAppointment(appointment);
    // Resetuj zakres na dzisiejszy dzień
    const todayStr = yyyyMmDd(new Date());
    setRescheduleDateFromStr(todayStr);
    setRescheduleActiveDayStr(todayStr);
    setRescheduleSelectedStart("");
    setRescheduleSlots([]);

    // Upewnij się, że poprzednie akcje nie blokują przycisków w trybie zmiany terminu
    setBusyId(null);
  };

  // Otwarcie flow reschedule z poziomu modala szczegółów
  const openRescheduleFromDetails = (id: number): void => {
    const all = [...todayAppointments, ...upcomingAppointments];
    const found = all.find((a) => a.id === id);
    if (!found) {
      // jeśli lista nie zawiera już tej wizyty (np. po odświeżeniu) – po prostu zamknij modal
      closeDetails();
      return;
    }

    // Zamknij modal, żeby użytkownik widział edytor slotów
    closeDetails();
    openReschedule(found);
  };

  /**
   * Anuluj proces zmiany terminu bez zapisywania zmian.
   */
  const cancelReschedule = (): void => {
    setRescheduleAppointment(null);
    setRescheduleSlots([]);
    setRescheduleSelectedStart("");
  };

  /**
   * Zapisz zmianę terminu wizyty. Wywołuje API update z nową datą startu
   * i odświeża listę wizyt po zakończeniu.
   */
  const confirmReschedule = async (): Promise<void> => {
    if (!rescheduleAppointment || !rescheduleSelectedStart) return;
    const appt = rescheduleAppointment;
    setBusyId(appt.id);
    setError(null);
    try {
      await appointmentsAPI.update(appt.id, {
        employee: String(appt.employee),
        service: String(appt.service),
        start: rescheduleSelectedStart,
      } as Partial<AppointmentCreateData>);
      await loadAll();
      openInfo("Gotowe", "Termin wizyty został zmieniony.");
      cancelReschedule();
    } catch (e: unknown) {
      console.error(e);
      const msg = extractError(e);
      setError(msg);
      openError("Błąd", msg);
    } finally {
      setBusyId(null);
    }
  };

  const createEmployeeAppointment = useCallback(async (): Promise<void> => {
    if (!employeeMe) {
      openError("Błąd", "Nie udało się wczytać profilu pracownika.");
      return;
    }
    if (!selectedService) {
      openError("Brak danych", "Wybierz usługę.");
      return;
    }
    if (!selectedClient) {
      openError("Brak danych", "Wybierz klienta.");
      return;
    }
    if (!selectedStart) {
      openError("Brak danych", "Wybierz termin (slot).");
      return;
    }

    // Przygotuj payload w formacie wymaganym przez API.
    // Backend oczekuje:
    // - employee: Employee.number
    // - client: Client.number
    // - service: Service.name
    const payload: AppointmentCreateData = {
      employee: employeeMe.number,
      service: selectedService.name,
      client: selectedClient.number,
      start: selectedStart,
      ...(internalNotes.trim() ? { internal_notes: internalNotes.trim() } : {}),
    };

    openConfirm(
      "Dodać wizytę?",
      `Klient: ${selectedClient?.number ?? "—"}\nUsługa: ${selectedService?.name ?? "—"}\nStart: ${formatDT(selectedStart)}\n\nPotwierdzić utworzenie wizyty?`,
      async () => {
        setBusyId(-1);
        setError(null);
        try {
          await appointmentsAPI.create(payload);
          await loadAll();
          openInfo("Gotowe", "Wizyta została dodana.");
          // reset wyborów (zostawiamy usługę)
          setSelectedStart("");
          setInternalNotes("");
          setSelectedClientId("");
          setSelectedClient(null);
        } catch (e: unknown) {
          console.error(e);
          const msg = extractError(e);
          setError(msg);
          openError("Błąd", msg);
        } finally {
          setBusyId(null);
        }
      },
      "Utwórz"
    );
  }, [employeeMe, internalNotes, loadAll, openConfirm, openError, openInfo, selectedClient, selectedService, selectedStart]);

  if (loading) {
    return <div style={{ padding: 20 }}>Ładowanie wizyt…</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={beautyPageTitleStyle}>{isEmployee ? "Wizyty pracownika" : "Moje wizyty"}</h1>

      {error ? (
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: "#ffe3ef", whiteSpace: "pre-line" }}>
          <strong>Błąd:</strong> {error}
        </div>
      ) : null}

      {isEmployee ? (
        <>
          {/* Przyciski na górze: odśwież dane */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button type="button" style={beautyButtonSecondaryStyle} onClick={() => void loadAll()}>
              Odśwież
            </button>
          </div>

          {/* Formularz dodawania wizyty przez pracownika */}
          <div style={{ ...beautyCardStyle, marginBottom: 12 }}>
            <div style={beautyCardHeaderStyle}>Dodaj wizytę (pracownik)</div>
            <div style={beautyCardBodyStyle}>
              {employeeServicesLoading ? <div style={beautyMutedTextStyle}>Ładowanie danych pracownika…</div> : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                <label style={{ display: "block" }}>
                  <div style={{ marginBottom: 6, fontWeight: 700 }}>Klient (wyszukaj)</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      style={{ ...beautyInputStyle, flex: 1 }}
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="np. Kowalski / email / telefon"
                    />
                    <button
                      type="button"
                      style={beautyButtonSecondaryStyle}
                      onClick={() => void searchClients()}
                      disabled={clientSearchLoading}
                    >
                      {clientSearchLoading ? "…" : "Szukaj"}
                    </button>
                  </div>

                  {clientResults.length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <select
                        style={beautySelectStyle}
                        value={selectedClientId}
                        onChange={(e) => {
                          const id = e.target.value ? Number(e.target.value) : "";
                          setSelectedClientId(id);
                          const found = id === "" ? null : clientResults.find((c) => c.id === id) ?? null;
                          setSelectedClient(found);
                        }}
                      >
                        <option value="">Wybierz klienta…</option>
                        {clientResults.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.id} • {c.first_name} {c.last_name} {c.email ? `• ${c.email}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, ...beautyMutedTextStyle }}>Wpisz frazę i kliknij „Szukaj”.</div>
                  )}
                </label>

                <label style={{ display: "block" }}>
                  <div style={{ marginBottom: 6, fontWeight: 700 }}>Usługa</div>
                  <select
                    style={beautySelectStyle}
                    value={serviceId}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : "";
                      setServiceId(id);
                      const found = id === "" ? null : employeeServices.find((s) => s.id === id) ?? null;
                      setSelectedService(found);
                    }}
                  >
                    <option value="">Wybierz usługę…</option>
                    {employeeServices.map((s: Service) => (
                      <option key={s.id} value={s.id}>
                        #{s.id} • {s.name}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: 8, ...beautyMutedTextStyle }}>
                  </div>
                </label>

                <label style={{ display: "block" }}>
                  <div style={{ marginBottom: 6, fontWeight: 700 }}>Zakres dni (7 dni)</div>
                  <input
                    style={beautyInputStyle}
                    type="date"
                    value={dateFromStr}
                    onChange={(e) => setDateFromStr(e.target.value)}
                  />
                  <div style={{ marginTop: 8, ...beautyMutedTextStyle }}>
                  </div>
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Dostępne terminy</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {dateRange.days.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      style={d.key === activeDayStr ? beautyButtonStyle : beautyButtonSecondaryStyle}
                      onClick={() => setActiveDayStr(d.key)}
                      disabled={loadingSlots || serviceId === "" || !employeeMe}
                    >
                      {d.key}
                    </button>
                  ))}

                  <button
                    type="button"
                    style={beautyButtonSecondaryStyle}
                    onClick={() => void refreshSlots()}
                    disabled={loadingSlots || serviceId === "" || !employeeMe}
                  >
                    {loadingSlots ? "Pobieranie…" : "Odśwież sloty"}
                  </button>
                </div>

                {serviceId === "" ? <div style={beautyMutedTextStyle}>Wybierz usługę, żeby zobaczyć terminy.</div> : null}
                {serviceId !== "" && loadingSlots ? <div style={beautyMutedTextStyle}>Ładowanie terminów…</div> : null}

                {serviceId !== "" && !loadingSlots ? (
                  slotsForActiveDay.length > 0 ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {slotsForActiveDay.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          style={selectedStart === s.start ? beautyButtonStyle : beautyButtonSecondaryStyle}
                          onClick={() => setSelectedStart(s.start)}
                        >
                          {formatTimePL(s.start)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={beautyMutedTextStyle}>Brak wolnych slotów w tym dniu.</div>
                  )
                ) : null}
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block" }}>
                  <div style={{ marginBottom: 6, fontWeight: 700 }}>Notatka wewnętrzna (opcjonalna)</div>
                  <input
                    style={beautyInputStyle}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Opcjonalnie możesz dodać notatkę..."
                  />
                </label>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  style={beautyButtonStyle}
                  onClick={() => void createEmployeeAppointment()}
                  disabled={busyId === -1 || !employeeMe || !selectedService || !selectedClient || !selectedStart}
                >
                  {busyId === -1 ? "Tworzenie…" : "Dodaj wizytę"}
                </button>
                <div style={beautyMutedTextStyle}>
                </div>
              </div>
            </div>
          </div>

          {/* Sekcja dzisiejszych wizyt */}
          <div style={{ ...beautyCardStyle, marginBottom: 12 }}>
            <div style={beautyCardHeaderStyle}>Dzisiejsze wizyty ({todayAppointments.length})</div>
            <div style={beautyCardBodyStyle}>
              {todayAppointments.length === 0 ? (
                <div style={beautyMutedTextStyle}>Brak wizyt.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(233, 30, 99, 0.20)" }}>
                      <th style={{ padding: 10 }}>Termin</th>
                      <th style={{ padding: 10 }}>Usługa</th>
                      <th style={{ padding: 10 }}>Klient</th>
                      <th style={{ padding: 10 }}>Status</th>
                      <th style={{ padding: 10 }}>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAppointments.map((a) => {
                      // Wiersz wizyty dzisiaj
                      const showTodayActions = true;
                      const showUpcomingActions = false;
                      return (
                        <tr key={a.id} style={{ borderBottom: "1px solid rgba(233, 30, 99, 0.10)" }}>
                          <td style={{ padding: 10 }}>{formatTime(a.start)}</td>
                          <td style={{ padding: 10 }}>{a.service_name}</td>
                          <td style={{ padding: 10 }}>{a.client_name ?? "—"}</td>
                          <td style={{ padding: 10 }}>{statusLabel(a)}</td>
                          <td style={{ padding: 10 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" style={beautyButtonSecondaryStyle} onClick={() => openDetails(a.id)}>
                                Szczegóły
                              </button>
                              {/* Akcje dla dzisiejszych wizyt */}
                              {canEmployeeAccept(a) && showTodayActions ? (
                                <button
                                  type="button"
                                  style={beautyButtonStyle}
                                  disabled={busyId === a.id}
                                  onClick={() => askAccept(a.id)}
                                >
                                  {busyId === a.id ? "…" : "Akceptuj"}
                                </button>
                              ) : null}
                              {canEmployeeStart(a) && showTodayActions ? (
                                <button
                                  type="button"
                                  style={beautyButtonStyle}
                                  disabled={busyId === a.id}
                                  onClick={() => askStart(a.id)}
                                >
                                  {busyId === a.id ? "…" : "Rozpocznij"}
                                </button>
                              ) : null}
                              {canEmployeeFinish(a) && showTodayActions ? (
                                <button
                                  type="button"
                                  style={beautyButtonStyle}
                                  disabled={busyId === a.id}
                                  onClick={() => askComplete(a.id)}
                                >
                                  {busyId === a.id ? "…" : "Zrealizowana"}
                                </button>
                              ) : null}
                              {canEmployeeNoShow(a) && showTodayActions ? (
                                <button
                                  type="button"
                                  style={beautyButtonSecondaryStyle}
                                  disabled={busyId === a.id}
                                  onClick={() => askNoShow(a.id)}
                                >
                                  {busyId === a.id ? "…" : "Nieobecność"}
                                </button>
                              ) : null}
                              {canEmployeeReschedule(a) ? (
                                <button
                                  type="button"
                                  style={beautyButtonSecondaryStyle}
                                  disabled={busyId === a.id}
                                  onClick={() => openReschedule(a)}
                                >
                                  {busyId === a.id ? "…" : "Zmień termin"}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Sekcja nadchodzących wizyt */}
          <div style={{ ...beautyCardStyle }}>
            <div style={beautyCardHeaderStyle}>Nadchodzące wizyty ({upcomingAppointments.length})</div>
            <div style={beautyCardBodyStyle}>
              {upcomingAppointments.length === 0 ? (
                <div style={beautyMutedTextStyle}>Brak wizyt.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(233, 30, 99, 0.20)" }}>
                      <th style={{ padding: 10 }}>Termin</th>
                      <th style={{ padding: 10 }}>Usługa</th>
                      <th style={{ padding: 10 }}>Klient</th>
                      <th style={{ padding: 10 }}>Status</th>
                      <th style={{ padding: 10 }}>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingAppointments.map((a) => {
                      const showTodayActions = false;
                      const showUpcomingActions = true;
                      return (
                        <tr key={a.id} style={{ borderBottom: "1px solid rgba(233, 30, 99, 0.10)" }}>
                          <td style={{ padding: 10 }}>{formatDT(a.start)}</td>
                          <td style={{ padding: 10 }}>{a.service_name}</td>
                          <td style={{ padding: 10 }}>{a.client_name ?? "—"}</td>
                          <td style={{ padding: 10 }}>{statusLabel(a)}</td>
                          <td style={{ padding: 10 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" style={beautyButtonSecondaryStyle} onClick={() => openDetails(a.id)}>
                                Szczegóły
                              </button>
                              {/* Akcje dla nadchodzących wizyt – tylko akceptacja oraz zmiana terminu */}
                              {canEmployeeAccept(a) && showUpcomingActions ? (
                                <button
                                  type="button"
                                  style={beautyButtonStyle}
                                  disabled={busyId === a.id}
                                  onClick={() => askAccept(a.id)}
                                >
                                  {busyId === a.id ? "…" : "Akceptuj"}
                                </button>
                              ) : null}
                              {canEmployeeReschedule(a) ? (
                                <button
                                  type="button"
                                  style={beautyButtonSecondaryStyle}
                                  disabled={busyId === a.id}
                                  onClick={() => openReschedule(a)}
                                >
                                  {busyId === a.id ? "…" : "Zmień termin"}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
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
            <div style={beautyMutedTextStyle}>Przycisk „Anuluj” pojawia się tylko dla statusów: pending/confirmed.</div>
          </div>
        </div>
      ) : null}

      {/* Lista wizyt dla klientów i managerów */}
      {(!isEmployee) && (
        <div style={beautyCardStyle}>
          <div style={beautyCardHeaderStyle}>{isClient ? "Moje wizyty" : "Lista wizyt"}</div>
          <div style={beautyCardBodyStyle}>
            {clientAppointments.length === 0 ? (
              <div style={beautyMutedTextStyle}>Brak wizyt.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(233, 30, 99, 0.20)" }}>
                    <th style={{ padding: 10 }}>Termin</th>
                    <th style={{ padding: 10 }}>Usługa</th>
                    <th style={{ padding: 10 }}>Pracownik</th>
                    <th style={{ padding: 10 }}>Status</th>
                    <th style={{ padding: 10 }}>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {clientAppointments.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid rgba(233, 30, 99, 0.10)" }}>
                      <td style={{ padding: 10 }}>{formatDT(a.start)}</td>
                      <td style={{ padding: 10 }}>{a.service_name}</td>
                      <td style={{ padding: 10 }}>{a.employee_name ?? "—"}</td>
                      <td style={{ padding: 10 }}>{statusLabel(a)}</td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" style={beautyButtonSecondaryStyle} onClick={() => openDetails(a.id)}>
                            Szczegóły
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {isManager ? (
        <div style={{ marginTop: 12, ...beautyMutedTextStyle }}>
          Manager: pełne zarządzanie wizytami masz w panelu „Wizyty – zarządzanie”.
        </div>
      ) : null}

      <div style={{ marginTop: 14, ...beautyMutedTextStyle }}>
        Zalogowany jako: {user?.email ?? "—"} ({user?.role ?? "—"})
      </div>

      {/* Reschedule card: widoczne tylko dla pracownika, gdy wybrano wizytę do zmiany terminu */}
      {isEmployee && rescheduleAppointment ? (
        <div style={{ ...beautyCardStyle, marginTop: 20 }}>
          <div style={beautyCardHeaderStyle}>Zmiana terminu wizyty #{rescheduleAppointment.id}</div>
          <div style={beautyCardBodyStyle}>
            <p style={{ marginTop: 0 }}>
              Aktualny termin: <strong>{formatDT(rescheduleAppointment.start)}</strong>
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <label style={{ display: "block" }}>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Zakres dni (7 dni)</div>
                <input
                  style={beautyInputStyle}
                  type="date"
                  value={rescheduleDateFromStr}
                  onChange={(e) => setRescheduleDateFromStr(e.target.value)}
                />
                <div style={{ marginTop: 8, ...beautyMutedTextStyle }}>
                  Zakres od {rescheduleDateRange.fromStr} do {rescheduleDateRange.toStr}
                </div>
              </label>
              <div style={{ display: "block" }}>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Dni</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {rescheduleDateRange.days.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      style={d.key === rescheduleActiveDayStr ? beautyButtonStyle : beautyButtonSecondaryStyle}
                      onClick={() => setRescheduleActiveDayStr(d.key)}
                      disabled={rescheduleLoadingSlots}
                    >
                      {d.key}
                    </button>
                  ))}
                  <button
                    type="button"
                    style={beautyButtonSecondaryStyle}
                    onClick={() => void refreshRescheduleSlots()}
                    disabled={rescheduleLoadingSlots || !rescheduleAppointment}
                  >
                    {rescheduleLoadingSlots ? "Pobieranie…" : "Odśwież"}
                  </button>
                </div>
              </div>
              <div style={{ display: "block" }}>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Sloty</div>
                {rescheduleLoadingSlots ? (
                  <div style={beautyMutedTextStyle}>Ładowanie terminów…</div>
                ) : rescheduleSlotsForActiveDay.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {rescheduleSlotsForActiveDay.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        style={rescheduleSelectedStart === s.start ? beautyButtonStyle : beautyButtonSecondaryStyle}
                        onClick={() => setRescheduleSelectedStart(s.start)}
                      >
                        {formatTimePL(s.start)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={beautyMutedTextStyle}>Brak wolnych slotów dla tego dnia.</div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={beautyButtonStyle}
                onClick={() => void confirmReschedule()}
                disabled={!rescheduleSelectedStart || busyId === (rescheduleAppointment?.id ?? null)}
              >
                {busyId === (rescheduleAppointment?.id ?? null) ? "Zapisywanie…" : "Zapisz nowy termin"}
              </button>
              <button type="button" style={beautyButtonSecondaryStyle} onClick={() => cancelReschedule()}>
                Anuluj
              </button>
        {rescheduleSelectedStart ? (
          <div style={beautyMutedTextStyle}>
            Nowy termin: <strong>{formatDT(rescheduleSelectedStart)}</strong>
          </div>
        ) : (
          <div style={beautyMutedTextStyle}>Wybierz termin, aby aktywować przycisk</div>
        )}
            </div>
          </div>
        </div>
      ) : null}

      <AppointmentDetailsModal
        isOpen={detailsOpen}
        appointmentId={detailsAppointmentId}
        onClose={closeDetails}
        onUpdated={loadAll}
        onReschedule={isEmployee ? openRescheduleFromDetails : undefined}
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
    </div>
  );
}
