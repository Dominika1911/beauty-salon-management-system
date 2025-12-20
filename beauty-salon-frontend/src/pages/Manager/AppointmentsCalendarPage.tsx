import React, { useEffect, useMemo, useState } from 'react';
import type { AppointmentListItem, AppointmentStatus } from '@/types';

import { appointmentsAPI } from '@/api/appointments.ts';
import { employeesAPI } from '@/api/employees.ts';
import { AppointmentFormModal } from "@/components/Manager/AppointmentFormModal";
import { useAuth } from '@/hooks/useAuth.ts';


type EmployeeLite = { id: number; first_name: string; last_name: string; is_active?: boolean };

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const minutesFromMidnight = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

const statusLabelPL: Record<AppointmentStatus, string> = {
  pending: 'Oczekująca (do potwierdzenia)',
  confirmed: 'Potwierdzona',
  in_progress: 'W trakcie',
  completed: 'Zakończona',
  cancelled: 'Anulowana',
  no_show: 'Nieobecność (No-show)',
};

type CurrentUser = { role: 'manager' | 'employee' | 'client'; employeeId?: number };

const toCurrentUser = (authUser: any): CurrentUser => {
  const role = (authUser?.role ?? 'manager') as CurrentUser['role'];
  const employeeId = authUser?.employee_id ?? authUser?.employeeId ?? authUser?.employee?.id ?? undefined;
  return { role, employeeId: typeof employeeId === 'number' ? employeeId : undefined };
};

const canStartNow = (startISO: string): boolean => {
  const start = new Date(startISO).getTime();
  const now = Date.now();
  const earliest = start - 15 * 60 * 1000;
  const latest = start + 4 * 60 * 60 * 1000;
  return now >= earliest && now <= latest;
};

type StatusAction = {
  next: AppointmentStatus;
  label: string;
  variant: 'success' | 'info' | 'danger' | 'ghost';
  askReason?: boolean;
};

const isActionAllowed = (a: AppointmentListItem, user: CurrentUser): boolean => {
  if (user.role === 'manager') return true;
  if (user.role === 'employee') return !!user.employeeId && a.employee === user.employeeId;
  return false;
};

const actionsForAppointment = (a: AppointmentListItem, user: CurrentUser): StatusAction[] => {
  if (!isActionAllowed(a, user)) return [];

  switch (a.status) {
    case 'pending':
      return [
        { next: 'confirmed', label: 'Potwierdź', variant: 'success' },
        { next: 'cancelled', label: 'Anuluj', variant: 'danger', askReason: true },
      ];

    case 'confirmed': {
      const actions: StatusAction[] = [
        { next: 'cancelled', label: 'Anuluj', variant: 'danger', askReason: true },
        { next: 'no_show', label: 'Nieobecność', variant: 'ghost' },
      ];
      if (canStartNow(a.start)) actions.unshift({ next: 'in_progress', label: 'Rozpocznij', variant: 'info' });
      return actions;
    }

    case 'in_progress':
      return [{ next: 'completed', label: 'Zakończ', variant: 'success' }];

    default:
      return [];
  }
};

const btnClass = (variant: StatusAction['variant']): string => {
  switch (variant) {
    case 'success':
      return 'btn btn-success';
    case 'info':
      return 'btn btn-info';
    case 'danger':
      return 'btn btn-danger';
    default:
      return 'btn';
  }
};

export const AppointmentsCalendarPage: React.FC = () => {
  const auth = useAuth() as any;
  const currentUser = useMemo(() => toCurrentUser(auth?.user), [auth?.user]);

  const [day, setDay] = useState<string>(isoDate(new Date()));
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // modal podglądu wizyty
  const [selected, setSelected] = useState<AppointmentListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadEmployees = async () => {
    try {
      const res = await employeesAPI.active();
      setEmployees((res.data ?? []) as EmployeeLite[]);
    } catch {
      setEmployees([]);
    }
  };

  const loadAppointments = async (dayISO: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await appointmentsAPI.list({
        page: 1,
        page_size: 200,
        date_from: dayISO,
        date_to: dayISO,
      });

      let list = (res.data.results ?? []) as AppointmentListItem[];

      // pracownik widzi tylko swoje (lista)
      if (currentUser.role === 'employee' && currentUser.employeeId) {
        list = list.filter((a) => a.employee === currentUser.employeeId);
      }

      setAppointments(list);

      // jeśli masz otwarty modal i zmienił się dzień -> zamknij
      setSelected((prev) => (prev ? list.find((x) => x.id === prev.id) ?? null : null));
    } catch {
      setErr('Nie udało się pobrać wizyt na ten dzień.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, []);

  useEffect(() => {
    void loadAppointments(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, currentUser.role, currentUser.employeeId]);

  const GRID_START_MIN = 8 * 60;
  const GRID_END_MIN = 20 * 60;
  const STEP_MIN = 15;

  const timeLabels = useMemo(() => {
    const arr: string[] = [];
    for (let m = GRID_START_MIN; m <= GRID_END_MIN; m += 60) {
      arr.push(`${pad2(Math.floor(m / 60))}:00`);
    }
    return arr;
  }, []);

  const employeesShown = useMemo(() => {
    if (currentUser.role === 'employee' && currentUser.employeeId) {
      return employees.filter((e) => e.id === currentUser.employeeId);
    }
    return employees;
  }, [employees, currentUser.role, currentUser.employeeId]);

  const apptsByEmployee = useMemo(() => {
    const map = new Map<number, AppointmentListItem[]>();
    for (const a of appointments) {
      const arr = map.get(a.employee) ?? [];
      arr.push(a);
      map.set(a.employee, arr);
    }
    for (const [k, arr] of map) {
      arr.sort((x, y) => new Date(x.start).getTime() - new Date(y.start).getTime());
      map.set(k, arr);
    }
    return map;
  }, [appointments]);

  const dayDate = useMemo(() => startOfDay(new Date(day + 'T00:00:00')), [day]);

  const dayPrev = () => {
    const d = new Date(dayDate);
    d.setDate(d.getDate() - 1);
    setDay(isoDate(d));
  };

  const dayNext = () => {
    const d = new Date(dayDate);
    d.setDate(d.getDate() + 1);
    setDay(isoDate(d));
  };

  const totalMinutes = GRID_END_MIN - GRID_START_MIN;

  const calcStyle = (a: AppointmentListItem) => {
    const s = new Date(a.start);
    const e = new Date(a.end);

    const sMin = minutesFromMidnight(s);
    const eMin = minutesFromMidnight(e);

    const topMin = clamp(sMin, GRID_START_MIN, GRID_END_MIN) - GRID_START_MIN;
    const heightMin = clamp(eMin, GRID_START_MIN, GRID_END_MIN) - clamp(sMin, GRID_START_MIN, GRID_END_MIN);

    const topPct = (topMin / totalMinutes) * 100;
    const heightPct = Math.max((heightMin / totalMinutes) * 100, 2);

    return { top: `${topPct}%`, height: `${heightPct}%` };
  };

  const optimisticSetStatus = (id: number, next: AppointmentStatus) => {
    setAppointments((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: next, status_display: statusLabelPL[next] } : x))
    );
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status: next, status_display: statusLabelPL[next] } : prev));
  };

  const changeStatus = async (a: AppointmentListItem, act: StatusAction) => {
    if (!isActionAllowed(a, currentUser)) return;

    const ok = window.confirm(`Zmienić status na: ${statusLabelPL[act.next]}?`);
    if (!ok) return;

    const reason = act.askReason ? (window.prompt('Powód (opcjonalnie):', '') ?? '').trim() : '';

    setActionLoading(true);

    const prevStatus = a.status;
    const prevDisplay = a.status_display;

    optimisticSetStatus(a.id, act.next);

    try {
      await appointmentsAPI.changeStatus(a.id, {
        status: act.next,
        cancellation_reason: act.next === 'cancelled' && reason ? reason : undefined,
      });
    } catch {
      // rollback
      setAppointments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status: prevStatus, status_display: prevDisplay } : x))
      );
      setSelected((prev) => (prev && prev.id === a.id ? { ...prev, status: prevStatus, status_display: prevDisplay } : prev));
      alert('Nie udało się zmienić statusu.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Wizyty — Kalendarz</h1>

        <div className="calendar-toolbar">
          <div className="calendar-day-controls">
            <button className="btn" onClick={dayPrev}>←</button>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            <button className="btn" onClick={dayNext}>→</button>
          </div>

          <div className="calendar-actions">
            {currentUser.role === 'manager' && (
              <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                Dodaj wizytę
              </button>
            )}
            <button className="btn" disabled={loading} onClick={() => void loadAppointments(day)}>
              Odśwież
            </button>
          </div>
        </div>
      </div>

      {err && <div className="page-error">{err}</div>}

      <div className="calendar-grid">
        <div className="calendar-times">
          <div className="calendar-times-head" />
          {timeLabels.map((t) => (
            <div key={t} className="calendar-time">{t}</div>
          ))}
        </div>

        <div className="calendar-cols">
          <div className="calendar-cols-head">
            {employeesShown.map((e) => (
              <div key={e.id} className="calendar-col-head">
                {e.first_name} {e.last_name}
              </div>
            ))}
          </div>

          <div className="calendar-cols-body">
            {employeesShown.map((e) => {
              const list = apptsByEmployee.get(e.id) ?? [];
              return (
                <div key={e.id} className="calendar-col">
                  <div className="calendar-col-bg">
                    {Array.from({ length: totalMinutes / STEP_MIN + 1 }).map((_, i) => (
                      <div
                        key={i}
                        className="calendar-gridline"
                        style={{ top: `${(i * STEP_MIN / totalMinutes) * 100}%` }}
                      />
                    ))}
                  </div>

                  {list.map((a) => (
                    <div
                      key={a.id}
                      className={`calendar-appt status-${a.status}`}
                      style={calcStyle(a)}
                      onClick={() => setSelected(a)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="calendar-appt-title">{a.service_name}</div>
                      <div className="calendar-appt-sub">
                        {new Date(a.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {new Date(a.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="calendar-appt-sub">{a.client_name ?? '—'}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL PODGLĄDU + AKCJE */}
      {selected && (
        <div className="calendar-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h3>Wizyta #{selected.id}</h3>
              <button className="calendar-modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="calendar-modal-body">
              <div className="calendar-modal-row">
                <span>Usługa</span>
                <b>{selected.service_name}</b>
              </div>
              <div className="calendar-modal-row">
                <span>Klient</span>
                <b>{selected.client_name ?? '—'}</b>
              </div>
              <div className="calendar-modal-row">
                <span>Pracownik</span>
                <b>{selected.employee_name}</b>
              </div>
              <div className="calendar-modal-row">
                <span>Godzina</span>
                <b>
                  {new Date(selected.start).toLocaleString('pl-PL')} – {new Date(selected.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </b>
              </div>
              <div className="calendar-modal-row">
                <span>Status</span>
                <b>{selected.status_display ?? statusLabelPL[selected.status]}</b>
              </div>

              <div className="calendar-modal-actions">
                {actionsForAppointment(selected, currentUser).length === 0 ? (
                  <span className="status-badge ghost">Brak akcji</span>
                ) : (
                  actionsForAppointment(selected, currentUser).map((act) => (
                    <button
                      key={act.next}
                      className={btnClass(act.variant)}
                      disabled={actionLoading}
                      onClick={() => void changeStatus(selected, act)}
                    >
                      {actionLoading ? '…' : act.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AppointmentFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => void loadAppointments(day)}
        allowIgnoreTimeOff
        initialDate={day}
      />
    </div>
  );
};
