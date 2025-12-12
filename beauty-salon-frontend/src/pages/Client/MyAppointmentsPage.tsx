import React, { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { AppointmentListItem } from '../../types';
import { appointmentsAPI } from '../../api/appointments';

export const MyAppointmentsPage: React.FC = (): ReactElement => {
  const [items, setItems] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMy = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await appointmentsAPI.myAppointments();
      setItems(res.data ?? []);
    } catch (e) {
      console.error(e);
      setError('Nie udało się pobrać Twoich rezerwacji.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMy();
  }, []);

  const now = useMemo(() => Date.now(), []);
  const canCancel = (a: AppointmentListItem): boolean => {
    // klient sensownie: tylko przyszłe i nieodwołane/niezakończone
    const isFuture = new Date(a.start).getTime() > now;
    const notFinal = !['cancelled', 'completed'].includes(a.status);
    return isFuture && notFinal;
  };

  const cancelMy = async (a: AppointmentListItem): Promise<void> => {
    if (!canCancel(a)) return;

    const ok = window.confirm('Na pewno anulować tę wizytę?');
    if (!ok) return;

    const reason = window.prompt('Powód anulowania (opcjonalnie):', '') ?? '';

    setActionLoadingId(a.id);
    setError(null);
    try {
      await appointmentsAPI.changeStatus(a.id, {
        status: 'cancelled',
        cancellation_reason: reason.trim() ? reason.trim() : undefined,
      });
      await fetchMy();
    } catch (e) {
      console.error(e);
      setError('Nie udało się anulować rezerwacji.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ margin: 0 }}>Moje Rezerwacje</h1>
      <p style={{ opacity: 0.8 }}>Lista Twoich wizyt.</p>

      {loading && <p>Ładowanie...</p>}
      {error && <p style={{ color: '#b00020' }}>{error}</p>}

      {!loading && !error && (
        <ul style={{ marginTop: 12 }}>
          {items.length === 0 ? (
            <li>Brak rezerwacji.</li>
          ) : (
            items.map((a) => (
              <li key={a.id} style={{ marginBottom: 10 }}>
                <div>
                  <strong>{new Date(a.start).toLocaleString()}</strong> — {a.service_name} — {a.employee_name}{' '}
                  <span style={{ opacity: 0.8 }}>({a.status_display ?? a.status})</span>
                </div>

                <div style={{ marginTop: 6 }}>
                  <button
                    onClick={() => void cancelMy(a)}
                    disabled={!canCancel(a) || actionLoadingId === a.id}
                    title={!canCancel(a) ? 'Nie można anulować tej wizyty' : 'Anuluj'}
                  >
                    {actionLoadingId === a.id ? 'Anuluję...' : 'Anuluj'}
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
