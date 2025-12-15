import React, { useCallback, useEffect, useState, type ReactElement } from 'react';
import { employeesAPI } from '../../api/employees';
import { scheduleAPI } from '../../api/schedule';
import type { Employee, TimeOff } from '../../types';
import { TimeOffForm } from '../../components/Schedule/TimeOffForm';
import { Modal } from '../../components/UI/Modal';
import { useNotification } from '../../components/UI/Notification';
import { useAuth } from '../../hooks/useAuth';

export const MyTimeOffPage: React.FC = (): ReactElement => {
  const { isEmployee } = useAuth();
  const { showNotification } = useNotification();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [timeOffList, setTimeOffList] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [timeOffModalOpen, setTimeOffModalOpen] = useState<boolean>(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [errorModalOpen, setErrorModalOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const loadData = useCallback(async (): Promise<void> => {
    if (!isEmployee) return;

    try {
      setLoading(true);

      const empRes = await employeesAPI.me();
      const emp = empRes.data;
      setEmployee(emp);

      const timeOffRes = await scheduleAPI.listTimeOff({
        employee: emp.id,
        ordering: '-date_from',
      });

      setTimeOffList(timeOffRes.data.results ?? []);
    } catch (e) {
      console.error(e);
      setErrorMessage('Nie udało się pobrać listy urlopów.');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, [isEmployee]);

  useEffect(() => {
    if (isEmployee) void loadData();
  }, [isEmployee, loadData]);

  const requestDelete = (id: number, status: TimeOff['status']): void => {
    if (status !== 'pending') {
      showNotification('Możesz usunąć tylko wnioski w statusie pending.', 'info');
      return;
    }
    setDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!deleteId) return;

    try {
      await scheduleAPI.deleteTimeOff(deleteId);
      showNotification('Wniosek został usunięty.', 'success');
      setConfirmDeleteOpen(false);
      setDeleteId(null);
      void loadData();
    } catch (e) {
      console.error(e);
      setErrorMessage('Nie udało się usunąć wniosku.');
      setErrorModalOpen(true);
    }
  }, [deleteId, loadData, showNotification]);

  const handleSuccess = useCallback((): void => {
    setTimeOffModalOpen(false);
    showNotification('Wniosek został wysłany.', 'success');
    void loadData();
  }, [loadData, showNotification]);

  if (!isEmployee) {
    return <div style={{ padding: 20 }}>Dostęp tylko dla pracownika.</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000 }}>
      <h1>Moje urlopy</h1>
      <p style={{ marginTop: 6, color: '#666' }}>Lista Twoich wniosków o urlop/nieobecność.</p>

      <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => setTimeOffModalOpen(true)}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ccc',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          + Zgłoś urlop / nieobecność
        </button>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ccc',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700,
          }}
        >
          {loading ? 'Ładowanie…' : 'Odśwież'}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        {loading ? (
          <p>Ładowanie…</p>
        ) : timeOffList.length === 0 ? (
          <p>Brak zgłoszeń.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Od</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Do</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Powód</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Status</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {timeOffList.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{t.date_from}</td>
                  <td style={{ padding: 8 }}>{t.date_to}</td>
                  <td style={{ padding: 8 }}>{t.reason}</td>
                  <td
                    style={{
                      padding: 8,
                      fontWeight: 800,
                      color: t.status === 'approved' ? 'green' : t.status === 'rejected' ? 'red' : 'orange',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t.status}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => requestDelete(t.id, t.status)}
                      disabled={t.status !== 'pending'}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: t.status !== 'pending' ? 'not-allowed' : 'pointer',
                        color: t.status !== 'pending' ? '#999' : '#c62828',
                        fontWeight: 800,
                      }}
                    >
                      {t.status !== 'pending' ? '—' : 'Usuń'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {employee && (
        <TimeOffForm
          isOpen={timeOffModalOpen}
          onClose={() => setTimeOffModalOpen(false)}
          onSuccess={handleSuccess}
          employeeId={employee.id}
          isManager={false}
        />
      )}

      <Modal isOpen={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Potwierdź usunięcie">
        <div style={{ padding: 12 }}>
          <p style={{ marginTop: 0 }}>Czy na pewno chcesz usunąć ten wniosek?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Usuń
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} title="Wystąpił błąd">
        <div style={{ padding: 12 }}>
          <p style={{ marginTop: 0 }}>{errorMessage}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => {
                setErrorModalOpen(false);
                void loadData();
              }}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Spróbuj ponownie
            </button>
            <button
              type="button"
              onClick={() => setErrorModalOpen(false)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Zamknij
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyTimeOffPage;
