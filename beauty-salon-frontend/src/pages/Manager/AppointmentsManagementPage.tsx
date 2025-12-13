import React, { useEffect, useState } from 'react';
import type { AppointmentListItem, AppointmentStatus } from '../../types';

import { appointmentsAPI } from '../../api/appointments';
import { AppointmentFormModal } from '../../components/Manager/AppointmentFormModal';
import { useAuth } from '../../hooks/useAuth';

import '../DashboardPage.css';
import './AppointmentsManagementPage.css';

const getAxiosErrorDetails = (e: any): string => {
  const data = e?.response?.data;
  if (!data) return e?.message ?? 'unknown error';
  try {
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return 'error';
  }
};

const statusLabelPL: Record<AppointmentStatus, string> = {
  pending: 'Oczekująca (do potwierdzenia)',
  confirmed: 'Potwierdzona',
  in_progress: 'W trakcie',
  completed: 'Zakończona',
  cancelled: 'Anulowana',
  no_show: 'Nieobecność (No-show)',
};

// "Rozpocznij" dopiero 15 min przed startem
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

type CurrentUser = {
  role: 'manager' | 'employee' | 'client';
  employeeId?: number;
};

// jeden punkt prawdy: user z useAuth()
const toCurrentUser = (authUser: any): CurrentUser => {
  const role = (authUser?.role ?? 'manager') as CurrentUser['role'];

  // najczęstsze warianty z backendu:
  const employeeId =
    authUser?.employee_id ??
    authUser?.employeeId ??
    authUser?.employee?.id ??
    undefined;

  return {
    role,
    employeeId: typeof employeeId === 'number' ? employeeId : undefined,
  };
};

// KLUCZ: pracownik tylko swoje; manager wszystko
const isActionAllowed = (a: AppointmentListItem, user: CurrentUser): boolean => {
  if (user.role === 'manager') return true;

  if (user.role === 'employee') {
    // u Ciebie w typie jest "employee" (ID pracownika)
    return !!user.employeeId && a.employee === user.employeeId;
  }

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

      // "Rozpocznij" tylko gdy pora
      if (canStartNow(a.start)) {
        actions.unshift({ next: 'in_progress', label: 'Rozpocznij', variant: 'info' });
      }

      return actions;
    }

    case 'in_progress':
      return [{ next: 'completed', label: 'Zakończ', variant: 'success' }];

    default:
      return [];
  }
};

export const AppointmentsManagementPage: React.FC = () => {
  const auth = useAuth() as any;
  const [currentUser] = useState<CurrentUser>(() => toCurrentUser(auth?.user));

  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchAppointments = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // ✅ POPRAWKA: ordering = '-id' (najnowsze na górze)
      const res = await appointmentsAPI.list({ page: 1, page_size: 50, ordering: '-id' });
      setAppointments(res.data.results ?? []);
    } catch (e: any) {
      console.error(e);
      setError(`Nie udało się pobrać wizyt. ${getAxiosErrorDetails(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAppointments();
  }, []);

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

  const optimisticSetStatus = (id: number, next: AppointmentStatus): void => {
    setAppointments((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: next, status_display: statusLabelPL[next] } : x))
    );
  };

  const rollbackStatus = (id: number, prevStatus: AppointmentStatus, prevDisplay?: string): void => {
    setAppointments((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: prevStatus, status_display: prevDisplay } : x))
    );
  };

  const changeStatus = async (a: AppointmentListItem, act: StatusAction): Promise<void> => {
    // twarda blokada na froncie (i tak backend powinien też blokować)
    if (!isActionAllowed(a, currentUser)) {
      setError('Nie masz uprawnień do zmiany statusu tej wizyty.');
      return;
    }

    const ok = window.confirm(`Zmienić status wizyty #${a.id} na: ${statusLabelPL[act.next]}?`);
    if (!ok) return;

    const reason = act.askReason ? (window.prompt('Powód (opcjonalnie):', '') ?? '').trim() : '';

    setActionLoadingId(a.id);
    setError(null);

    const prevStatus = a.status;
    const prevDisplay = a.status_display;

    optimisticSetStatus(a.id, act.next);

    try {
      await appointmentsAPI.changeStatus(a.id, {
        status: act.next,
        cancellation_reason: act.next === 'cancelled' && reason ? reason : undefined,
      });
    } catch (e: any) {
      console.error(e);
      rollbackStatus(a.id, prevStatus, prevDisplay);
      setError(`Nie udało się zmienić statusu. ${getAxiosErrorDetails(e)}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Wizyty</h1>

        <div className="page-actions">
          {/* dla pracownika ukrywamy "Dodaj wizytę" (jeśli tak ma być) */}
          {currentUser.role === 'manager' && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              Dodaj wizytę
            </button>
          )}

          <button className="btn" onClick={() => void fetchAppointments()} disabled={loading}>
            Odśwież
          </button>
        </div>
      </div>

      {error && <div className="page-error">{error}</div>}

      <div className="custom-table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Start</th>
              <th>Koniec</th>
              <th>Klient</th>
              <th>Pracownik</th>
              <th>Usługa</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Akcje</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 16 }}>
                  Ładowanie…
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 16 }}>
                  Brak wizyt do wyświetlenia.
                </td>
              </tr>
            ) : (
              appointments.map((a) => {
                const actions = actionsForAppointment(a, currentUser);
                const busy = actionLoadingId === a.id;

                return (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{new Date(a.start).toLocaleString('pl-PL')}</td>
                    <td>{new Date(a.end).toLocaleString('pl-PL')}</td>
                    <td>{a.client_name ?? '—'}</td>
                    <td>{a.employee_name}</td>
                    <td>{a.service_name}</td>
                    <td>
                      <span className={`status-badge ${a.status}`}>
                        {a.status_display ?? statusLabelPL[a.status]}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {actions.length === 0 ? (
                          <span className="status-badge ghost">Brak akcji</span>
                        ) : (
                          actions.map((act) => (
                            <button
                              key={`${a.id}-${act.next}`}
                              className={btnClass(act.variant)}
                              disabled={busy}
                              onClick={() => void changeStatus(a, act)}
                            >
                              {busy ? '…' : act.label}
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AppointmentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => void fetchAppointments()}
        allowIgnoreTimeOff
      />
    </div>
  );
};