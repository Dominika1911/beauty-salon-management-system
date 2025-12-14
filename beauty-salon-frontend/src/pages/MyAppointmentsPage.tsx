import { useEffect, useState, type ReactElement } from 'react';
import { appointmentsAPI } from '../api/appointments';
import type { AppointmentListItem } from '../types';
import { useAuth } from '../hooks/useAuth';

export function MyAppointmentsPage(): ReactElement {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAppointments = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await appointmentsAPI.myAppointments();
      setAppointments(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments();
  }, []);

  const cancelAppointment = async (id: number): Promise<void> => {
    const reason = window.prompt('Podaj powód anulowania wizyty:');
    if (!reason) return;

    await appointmentsAPI.cancelMy(id, reason);
    await loadAppointments();
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Ładowanie wizyt…</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Moje wizyty</h1>

      {appointments.length === 0 && <p>Brak wizyt.</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Usługa</th>
            <th>Pracownik</th>
            <th>Termin</th>
            <th>Status</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.service_name}</td>
              <td>{a.employee_name}</td>
              <td>
                {new Date(a.start).toLocaleString('pl-PL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </td>
              <td>{a.status_display}</td>
              <td>
                {user?.role === 'client' &&
                  (a.status === 'pending' || a.status === 'confirmed') && (
                    <button onClick={() => void cancelAppointment(a.id)}>
                      Anuluj
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
