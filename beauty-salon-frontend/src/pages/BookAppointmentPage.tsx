import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";

import { servicesAPI } from "../api/services";
import { employeesAPI } from "../api/employees";
import { availabilityAPI, type AvailabilitySlot } from "../api/availability";
import { appointmentsAPI } from "../api/appointments";

import type { Employee, Service } from "../types";
import {
  beautyButtonSecondaryStyle,
  beautyButtonStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
  beautySelectStyle,
} from "../utils/ui";

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

const formatEmployeeName = (e: Employee): string => `${e.first_name} ${e.last_name}`.trim();

const formatDatePL = (isoOrDate: string | Date): string => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};

const formatWeekdayPL = (date: Date): string => {
  return new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(date);
};

const formatTimePL = (iso: string): string => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(d);
};

function extractErrorMessage(err: unknown): { status: number | null; message: string } {
  if (!isAxiosError(err)) {
    return { status: null, message: "Wystąpił nieoczekiwany błąd." };
  }

  const status = typeof err.response?.status === "number" ? err.response.status : null;

  const data = err.response?.data as unknown;
  if (typeof data === "object" && data !== null) {
    const maybeDetail = (data as { detail?: unknown }).detail;
    if (typeof maybeDetail === "string" && maybeDetail.trim()) {
      return { status, message: maybeDetail };
    }

    const fieldEntries = Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          const first = v.find((x) => typeof x === "string") as string | undefined;
          return first ? `${k}: ${first}` : null;
        }
        if (typeof v === "string") return `${k}: ${v}`;
        return null;
      })
      .filter((x): x is string => Boolean(x));

    if (fieldEntries.length > 0) {
      return { status, message: fieldEntries.join("\n") };
    }
  }

  return { status, message: "Nie udało się wykonać operacji." };
}

type DayKey = string; // YYYY-MM-DD (lokalnie)

export function BookAppointmentPage(): ReactElement {
  const navigate = useNavigate();

  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  const [serviceId, setServiceId] = useState<number | "">("");
  const [employeeId, setEmployeeId] = useState<number | "">("");

  // Dzień startowy zakresu 7 dni
  const [dateFromStr, setDateFromStr] = useState<string>(yyyyMmDd(new Date()));
  // Wybrany dzień (tab) w ramach pobranego zakresu
  const [activeDayStr, setActiveDayStr] = useState<string>(yyyyMmDd(new Date()));

  const [selectedStart, setSelectedStart] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<string>("");

  const [loadingInit, setLoadingInit] = useState<boolean>(true);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService: Service | undefined = useMemo(() => {
    if (serviceId === "") return undefined;
    return services.find((s) => s.id === serviceId);
  }, [serviceId, services]);

  const selectedEmployee: Employee | undefined = useMemo(() => {
    if (employeeId === "") return undefined;
    return employees.find((e) => e.id === employeeId);
  }, [employeeId, employees]);

  // ✅ Filtr pracowników po usłudze (jak było)
  const filteredEmployees: Employee[] = useMemo(() => {
    if (serviceId === "") return employees;
    return employees.filter((e) => e.skills.some((sk) => sk.id === serviceId));
  }, [employees, serviceId]);

  // ✅ NOWE: filtr usług po pracowniku (żeby dało się wybrać pracownika -> tylko jego usługi)
  const filteredServices: Service[] = useMemo(() => {
    if (employeeId === "") return services;

    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return services;

    const allowedIds = new Set(emp.skills.map((s) => s.id));
    return services.filter((s) => allowedIds.has(s.id));
  }, [services, employees, employeeId]);

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

  const loadInit = async (): Promise<void> => {
    setLoadingInit(true);
    setError(null);
    try {
      const [svcRes, empRes] = await Promise.all([servicesAPI.published(), employeesAPI.active()]);
      setServices(svcRes.data ?? []);
      setEmployees(empRes.data ?? []);
    } catch (e: unknown) {
      console.error(e);
      setError("Nie udało się załadować danych (usługi/pracownicy).");
    } finally {
      setLoadingInit(false);
    }
  };

  const refreshSlots = async (): Promise<void> => {
    if (serviceId === "" || employeeId === "") return;

    setLoadingSlots(true);
    setError(null);
    setSelectedStart("");

    try {
      const res = await availabilityAPI.getSlots({
        employee: employeeId,
        service: serviceId,
        date_from: dateRange.fromStr,
        date_to: dateRange.toStr,
      });

      const newSlots = res.data?.slots ?? [];
      setSlots(newSlots);

      // aktywny dzień w zakresie (local)
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
      const { status, message } = extractErrorMessage(e);
      if (status === 404) {
        setError("Nie znaleziono pracownika lub usługi (albo są nieaktywne).");
      } else {
        setError(message || "Nie udało się pobrać terminów.");
      }
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const createBooking = async (): Promise<void> => {
    if (!selectedService || !selectedEmployee || !selectedStart) return;

    if (!window.confirm("Potwierdzić rezerwację wizyty?")) return;

    setCreating(true);
    setError(null);

    try {
      await appointmentsAPI.book({
        service: selectedService.id,
        employee: selectedEmployee.id,
        start: selectedStart,
        ...(clientNotes.trim() ? { notes: clientNotes.trim() } : {}),
      });

      window.alert("Wizyta została zarezerwowana ✅");
      navigate("/my-appointments");
    } catch (e: unknown) {
      console.error(e);
      const { status, message } = extractErrorMessage(e);

      if (status === 409) {
        window.alert("Wybrany termin jest niedostępny (ktoś mógł go właśnie zająć). Wybierz inny termin.");
        await refreshSlots();
        return;
      }

      if (status === 403) {
        window.alert("Brak uprawnień do rezerwacji. Upewnij się, że jesteś zalogowany jako klient.");
      } else if (status === 401) {
        window.alert("Sesja wygasła. Zaloguj się ponownie.");
      } else {
        window.alert(message || "Nie udało się utworzyć rezerwacji.");
      }

      setError(message || "Nie udało się utworzyć rezerwacji.");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    void loadInit();
  }, []);

  // ✅ jeśli zmieniono usługę i aktualnie wybrany pracownik nie ma tej usługi -> reset pracownika
  useEffect(() => {
    if (serviceId === "") return;
    if (employeeId === "") return;

    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;

    if (!emp.skills.some((sk) => sk.id === serviceId)) {
      setEmployeeId("");
      setSlots([]);
      setSelectedStart("");
    }
  }, [serviceId, employeeId, employees]);

  // ✅ NOWE: jeśli zmieniono pracownika i aktualnie wybrana usługa nie jest u niego -> reset usługi
  useEffect(() => {
    if (employeeId === "") return;
    if (serviceId === "") return;

    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;

    if (!emp.skills.some((sk) => sk.id === serviceId)) {
      setServiceId("");
      setSlots([]);
      setSelectedStart("");
    }
  }, [employeeId, serviceId, employees]);

  // zmiana dateFrom -> przestaw aktywny dzień na pierwszy w zakresie
  useEffect(() => {
    setActiveDayStr(dateFromStr);
  }, [dateFromStr]);

  useEffect(() => {
    void refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, employeeId, dateRange.fromStr, dateRange.toStr]);

  // ✅ FIX daty: grupowanie slotów po lokalnej dacie (nie po slice(0,10), które potrafi rozjechać dzień przez timezone)
  const slotsByDay = useMemo(() => {
    const map = new Map<DayKey, AvailabilitySlot[]>();
    for (const d of dateRange.days) {
      map.set(d.key, []);
    }
    for (const s of slots) {
      const key = yyyyMmDd(new Date(s.start));
      const list = map.get(key);
      if (list) list.push(s);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      map.set(k, list);
    }
    return map;
  }, [slots, dateRange.days]);

  const visibleSlots: AvailabilitySlot[] = useMemo(() => {
    return slotsByDay.get(activeDayStr) ?? [];
  }, [slotsByDay, activeDayStr]);

  return (
    <div style={{ padding: 16, background: "#fff7fb", minHeight: "100vh" }}>
      <h1 style={beautyPageTitleStyle}>Rezerwacja wizyty</h1>

      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>Wybór usługi i pracownika</div>
        <div style={beautyCardBodyStyle}>
          {loadingInit ? (
            <div style={beautyMutedTextStyle}>Ładowanie…</div>
          ) : (
            <>
              {error ? (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "#ffe3ef" }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Błąd</div>
                  <div style={{ whiteSpace: "pre-line" }}>{error}</div>
                </div>
              ) : null}

              <label style={{ display: "block", marginBottom: 8 }}>
                <div style={{ marginBottom: 6 }}>Pracownik</div>
                <select
                  style={beautySelectStyle}
                  value={employeeId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmployeeId(v ? Number(v) : "");
                  }}
                >
                  <option value="">— wybierz pracownika —</option>
                  {filteredEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatEmployeeName(e)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                <div style={{ marginBottom: 6 }}>Usługa</div>
                <select
                  style={beautySelectStyle}
                  value={serviceId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setServiceId(v ? Number(v) : "");
                  }}
                >
                  <option value="">— wybierz usługę —</option>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {employeeId !== "" && filteredServices.length === 0 ? (
                  <div style={{ ...beautyMutedTextStyle, marginTop: 6 }}>
                    Ten pracownik nie ma przypisanych opublikowanych usług.
                  </div>
                ) : null}
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                <div style={{ marginBottom: 6 }}>Zakres (7 dni) od</div>
                <input
                  style={beautyInputStyle}
                  type="date"
                  value={dateFromStr}
                  onChange={(e) => setDateFromStr(e.target.value)}
                  disabled={serviceId === "" || employeeId === ""}
                />
                <div style={{ ...beautyMutedTextStyle, marginTop: 6 }}>
                  Pokażemy terminy od {formatDatePL(parseYyyyMmDdLocal(dateRange.fromStr))} do{" "}
                  {formatDatePL(parseYyyyMmDdLocal(dateRange.toStr))}.
                </div>
              </label>

              <div style={{ ...beautyMutedTextStyle, marginTop: 8 }}>
                Dostępne godziny są wyliczane przez system na podstawie grafiku, przerw i zajętości.
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>Wybór terminu</div>
        <div style={beautyCardBodyStyle}>
          {serviceId === "" || employeeId === "" ? (
            <div style={beautyMutedTextStyle}>Wybierz usługę i pracownika, aby zobaczyć terminy.</div>
          ) : loadingSlots ? (
            <div style={beautyMutedTextStyle}>Ładowanie terminów…</div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {selectedService ? selectedService.name : "—"} •{" "}
                  {selectedEmployee ? formatEmployeeName(selectedEmployee) : "—"}
                </div>
                <div style={beautyMutedTextStyle}>
                  Zakres: {formatDatePL(parseYyyyMmDdLocal(dateRange.fromStr))} –{" "}
                  {formatDatePL(parseYyyyMmDdLocal(dateRange.toStr))}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {dateRange.days.map(({ key, date }) => {
                  const count = (slotsByDay.get(key) ?? []).length;
                  const isActive = key === activeDayStr;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActiveDayStr(key);
                        setSelectedStart("");
                      }}
                      style={{
                        ...(isActive ? beautyButtonStyle : beautyButtonSecondaryStyle),
                        padding: "10px 12px",
                        minWidth: 150,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                      title={count === 0 ? "Brak terminów" : `Dostępne: ${count}`}
                    >
                      <span style={{ textTransform: "capitalize" }}>{formatWeekdayPL(date)}</span>
                      <span style={{ fontWeight: 700 }}>{formatDatePL(date)}</span>
                      <span style={{ fontSize: 12, opacity: 0.85 }}>{count === 0 ? "brak" : `${count} slotów`}</span>
                    </button>
                  );
                })}
              </div>

              {visibleSlots.length === 0 ? (
                <div style={{ ...beautyMutedTextStyle, padding: 8, background: "#fff", borderRadius: 10 }}>
                  Brak wolnych terminów dla tego dnia. Wybierz inny dzień z zakładek albo zmień zakres/pracownika.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {visibleSlots.map((s) => {
                    const isSelected = selectedStart === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => setSelectedStart(s.start)}
                        style={{
                          ...(isSelected ? beautyButtonStyle : beautyButtonSecondaryStyle),
                          padding: "10px 12px",
                          minWidth: 110,
                        }}
                      >
                        {formatTimePL(s.start)}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", marginBottom: 8 }}>
                  <div style={{ marginBottom: 6 }}>Uwagi dla salonu (opcjonalnie)</div>
                  <textarea
                    style={{ ...beautyInputStyle, minHeight: 80 }}
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder="Np. prośba o konkretny kolor / informacja ważna dla pracownika"
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  style={beautyButtonSecondaryStyle}
                  onClick={() => void refreshSlots()}
                  disabled={loadingSlots || creating}
                >
                  Odśwież terminy
                </button>

                <button
                  type="button"
                  style={beautyButtonStyle}
                  onClick={() => void createBooking()}
                  disabled={!selectedStart || creating}
                >
                  {creating ? "Rezerwuję…" : "Zarezerwuj"}
                </button>
              </div>

              {selectedStart ? (
                <div style={{ ...beautyMutedTextStyle, marginTop: 10 }}>
                  Wybrany termin: {formatDatePL(selectedStart)} {formatTimePL(selectedStart)}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
