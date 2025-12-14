import React, { useEffect, useMemo, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { servicesAPI } from "../../api/services";
import { employeesAPI } from "../../api/employees";
import { availabilityAPI, type AvailabilitySlot } from "../../api/availability";
import { appointmentsAPI } from "../../api/appointments";

import type { Employee, Service } from "../../types";

const yyyyMmDd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatEmployeeName = (e: Employee): string => `${e.first_name} ${e.last_name}`.trim();

const formatDatePL = (iso: string): string => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};

const formatTimePL = (iso: string): string => {
  const d = new Date(iso);
  // ✅ bez sekund
  return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(d);
};

// Service.duration w Twoich typach to string (często "HH:MM:SS")
const durationToMinutes = (duration: string | null | undefined): number | null => {
  if (!duration) return null;
  const parts = duration.split(":").map((x) => Number(x));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [hh, mm, ss] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  return hh * 60 + mm + (ss ? 1 : 0);
};

const slotLabel = (slot: AvailabilitySlot): string => {
  const start = formatTimePL(slot.start);
  const end = slot.end ? formatTimePL(slot.end) : null;
  return end ? `${start}–${end}` : start;
};

export const BookAppointmentPage: React.FC = (): ReactElement => {
  const navigate = useNavigate();

  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [serviceId, setServiceId] = useState<number | "">("");
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [dateStr, setDateStr] = useState<string>(yyyyMmDd(new Date()));

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedStart, setSelectedStart] = useState<string>("");

  const [loadingInit, setLoadingInit] = useState<boolean>(false);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // INIT: usługi + pracownicy
  useEffect(() => {
    const run = async (): Promise<void> => {
      setLoadingInit(true);
      setError(null);
      try {
        const [svcRes, empRes] = await Promise.all([servicesAPI.published(), employeesAPI.active()]);
        setServices(svcRes.data ?? []);
        setEmployees(empRes.data ?? []);
      } catch (e) {
        console.error(e);
        setError("Nie udało się pobrać usług / pracowników.");
      } finally {
        setLoadingInit(false);
      }
    };

    void run();
  }, []);

  const selectedService = useMemo(() => {
    if (serviceId === "") return null;
    return services.find((s) => s.id === serviceId) ?? null;
  }, [services, serviceId]);

  const filteredEmployees = useMemo(() => {
    if (serviceId === "") return employees;
    return employees.filter((e) => (e.skills ?? []).some((s) => s.id === serviceId));
  }, [employees, serviceId]);

  const selectedEmployee = useMemo(() => {
    if (employeeId === "") return null;
    return employees.find((e) => e.id === employeeId) ?? null;
  }, [employees, employeeId]);

  // SLOTS
  useEffect(() => {
    const run = async (): Promise<void> => {
      setSlots([]);
      setSelectedStart("");
      setError(null);

      if (serviceId === "" || employeeId === "") return;

      setLoadingSlots(true);
      try {
        const res = await availabilityAPI.getSlots({
          employee: employeeId,
          service: serviceId,
          date_from: dateStr,
          date_to: dateStr,
        });

        setSlots(res.data?.slots ?? []);
      } catch (e) {
        console.error(e);
        setError("Nie udało się pobrać wolnych terminów.");
      } finally {
        setLoadingSlots(false);
      }
    };

    void run();
  }, [serviceId, employeeId, dateStr]);

  const normalizedSlots = useMemo(() => {
    return [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [slots]);

  // ✅ Auto-wybór najbliższego wolnego slotu, jeśli user jeszcze nic nie zaznaczył
  useEffect(() => {
    if (selectedStart) return;
    if (normalizedSlots.length === 0) return;

    setSelectedStart(normalizedSlots[0].start);
  }, [normalizedSlots, selectedStart]);

  const selectedSlot = useMemo(() => {
    return normalizedSlots.find((s) => s.start === selectedStart) ?? null;
  }, [normalizedSlots, selectedStart]);

  const serviceDurationMin = useMemo(() => durationToMinutes(selectedService?.duration), [selectedService]);

  const createAppointment = async (): Promise<void> => {
    setError(null);

    if (!selectedService) {
      setError("Wybierz usługę.");
      return;
    }
    if (!selectedEmployee) {
      setError("Wybierz pracownika.");
      return;
    }
    if (!selectedStart) {
      setError("Wybierz godzinę.");
      return;
    }

    setCreating(true);
    try {
      await appointmentsAPI.create({
        employee: selectedEmployee.number,
        service: selectedService.name,
        start: selectedStart,
      });

      window.alert("Wizyta została umówiona.");
      navigate("/my-appointments");
    } catch (e: any) {
      console.error(e);
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.non_field_errors?.[0] ||
        e?.response?.data?.start?.[0] ||
        e?.message ||
        "Nie udało się umówić wizyty.";
      setError(String(detail));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Umów wizytę</h1>
      <p style={{ opacity: 0.8 }}>Wybierz usługę, pracownika i termin.</p>

      {loadingInit && <p>Ładowanie danych…</p>}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Usługa */}
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>
              <strong>Usługa</strong>
            </label>
            <select
              value={serviceId}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setServiceId(v);
                setEmployeeId("");
              }}
              disabled={loadingInit}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">— wybierz usługę —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pracownik */}
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>
              <strong>Pracownik</strong>
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : "")}
              disabled={loadingInit || serviceId === ""}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">{serviceId === "" ? "— najpierw wybierz usługę —" : "— wybierz pracownika —"}</option>
              {filteredEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {formatEmployeeName(emp)}
                </option>
              ))}
            </select>

            {serviceId !== "" && filteredEmployees.length === 0 && (
              <div style={{ marginTop: 6, color: "#777", fontSize: 13 }}>Brak pracowników z tą usługą.</div>
            )}
          </div>

          {/* Data */}
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>
              <strong>Data</strong>
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          {/* Podgląd */}
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>
              <strong>Podgląd</strong>
            </label>
            <div style={{ padding: 8, border: "1px solid #eee", borderRadius: 8, minHeight: 40 }}>
              {selectedService ? (
                <>
                  <div>{selectedService.name}</div>
                  <div style={{ opacity: 0.75, fontSize: 13 }}>
                    {serviceDurationMin != null ? `Czas: ${serviceDurationMin} min` : "Czas: —"}
                    {selectedService.price ? ` • Cena: ${selectedService.price} zł` : ""}
                  </div>
                </>
              ) : (
                <span style={{ opacity: 0.7 }}>Wybierz usługę, aby zobaczyć szczegóły.</span>
              )}
            </div>
          </div>
        </div>

        {/* Sloty */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Dostępne godziny</h2>
            {loadingSlots && <span style={{ opacity: 0.7 }}>Ładowanie…</span>}
          </div>

          {serviceId === "" ? (
            <p style={{ opacity: 0.7 }}>Najpierw wybierz usługę.</p>
          ) : employeeId === "" ? (
            <p style={{ opacity: 0.7 }}>Wybierz pracownika, aby zobaczyć wolne terminy.</p>
          ) : normalizedSlots.length === 0 && !loadingSlots ? (
            <p style={{ opacity: 0.7 }}>Brak dostępnych terminów dla wybranej daty.</p>
          ) : (
            <>
              {/* ✅ mały summary “wybrane” */}
              {selectedSlot && (
                <div style={{ marginTop: 8, marginBottom: 6, fontSize: 13, opacity: 0.85 }}>
                  Wybrano: <strong>{formatDatePL(selectedSlot.start)}</strong> • <strong>{slotLabel(selectedSlot)}</strong>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {normalizedSlots.map((s, idx) => {
                  const active = selectedStart === s.start;
                  const isSuggested = idx === 0; // najbliższy po sortowaniu
                  return (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => setSelectedStart(s.start)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: active ? "2px solid #333" : isSuggested ? "2px solid #bbb" : "1px solid #ddd",
                        background: active ? "#f2f2f2" : "#fff",
                        cursor: "pointer",
                      }}
                      title={`${formatDatePL(s.start)} ${slotLabel(s)}`}
                    >
                      {slotLabel(s)}
                      {isSuggested && !active ? <span style={{ marginLeft: 6, opacity: 0.7 }}>(najbliższy)</span> : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Akcje */}
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button type="button" onClick={() => navigate("/my-appointments")}>
            Wróć do moich wizyt
          </button>

          <button
            type="button"
            onClick={() => void createAppointment()}
            disabled={creating || !selectedService || !selectedEmployee || !selectedStart}
          >
            {creating ? "Rezerwuję…" : "Umów wizytę"}
          </button>
        </div>
      </div>
    </div>
  );
};
