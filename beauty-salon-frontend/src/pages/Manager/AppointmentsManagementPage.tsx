import { useEffect, useState, type ReactElement } from 'react';
import { appointmentsAPI } from '../../api/appointments';
import type { AppointmentListItem, AppointmentStatus } from '../../types';

export function AppointmentsManagementPage(): ReactElement {
  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAppointments = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await appointmentsAPI.list({
        ordering: '-id',
      });
      setAppointments(res.data.results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments();
  }, []);

  const changeStatus = async (
    appointmentId: number,
    status: AppointmentStatus
  ): Promise<void> => {
    await appointmentsAPI.changeStatus(appointmentId, { status });
    await loadAppointments();
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Ładowanie wizyt…</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Wizyty – zarządzanie</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Klient</th>
            <th>Pracownik</th>
            <th>Usługa</th>
            <th>Termin</th>
            <th>Status</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.client_name}</td>
              <td>{a.employee_name}</td>
              <td>{a.service_name}</td>
              <td>
                {new Date(a.start).toLocaleString('pl-PL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </td>
              <td>{a.status_display}</td>
              <td>
                {a.status === 'pending' && (
                  <>
                    <button onClick={() => void changeStatus(a.id, 'confirmed')}>
                      Potwierdź
                    </button>
                    <button onClick={() => void changeStatus(a.id, 'cancelled')}>
                      Anuluj
                    </button>
                  </>
                )}

                {a.status === 'confirmed' && (
                  <>
                    <button onClick={() => void changeStatus(a.id, 'in_progress')}>
                      Rozpocznij
                    </button>
                    <button onClick={() => void changeStatus(a.id, 'no_show')}>
                      No-show
                    </button>
                  </>
                )}

                {a.status === 'in_progress' && (
                  <button onClick={() => void changeStatus(a.id, 'completed')}>
                    Zakończ
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
