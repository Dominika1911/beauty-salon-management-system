import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { Employee, TimeOff, ScheduleEntry } from '../../types';
import { employeesAPI } from '../../api/employees';
import { scheduleAPI } from '../../api/schedule';
import { ScheduleEditor } from '../../components/Schedule/ScheduleEditor';
import { TimeOffForm } from '../../components/Schedule/TimeOffForm';
import { Modal } from '../../components/UI/Modal';
import { useNotification } from '../../components/UI/Notification';

type PageState = 'idle' | 'loading' | 'ready' | 'error';

export const MySchedulePage: React.FC = (): ReactElement => {
  const { isEmployee } = useAuth();
  const { showNotification } = useNotification();

  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [timeOffList, setTimeOffList] = useState<TimeOff[]>([]);
  const [pageState, setPageState] = useState<PageState>('idle');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [timeOffModalOpen, setTimeOffModalOpen] = useState(false);

  const canLoad = useMemo(() => isEmployee, [isEmployee]);

  const loadData = useCallback(async () => {
    try {
      setPageState('loading');

      const empRes = await employeesAPI.me();
      const employee = empRes.data;

      const scheduleRes = await scheduleAPI.getEmployeeSchedule(employee.id);
      const schedule = scheduleRes.data as ScheduleEntry[];

      const timeOffRes = await scheduleAPI.listTimeOff({
        employee: employee.id,
        ordering: '-date_from',
      });

      setEmployeeData(employee);
      setScheduleEntries(schedule);
      setTimeOffList(timeOffRes.data.results ?? []);
      setPageState('ready');
    } catch (e) {
      console.error(e);
      setPageState('error');
      setErrorMessage(
        'Nie udało się pobrać danych grafiku i urlopów. Spróbuj ponownie za chwilę.'
      );
      setErrorModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (canLoad) {
      void loadData();
    }
  }, [canLoad, loadData]);

  const handleDeleteRequest = (id: number, status: TimeOff['status']) => {
    if (status !== 'pending') {
      showNotification('Można usunąć tylko wnioski w statusie pending.', 'info');
      return;
    }
    setDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      await scheduleAPI.deleteTimeOff(deleteId);
      showNotification('Wniosek usunięty.', 'success');
      setConfirmDeleteOpen(false);
      setDeleteId(null);
      void loadData();
    } catch {
      setErrorMessage('Nie udało się usunąć wniosku.');
      setErrorModalOpen(true);
    }
  };

  if (!isEmployee) {
    return <div style={{ padding: 20 }}>Dostęp tylko dla pracownika.</div>;
  }

  if (pageState === 'loading') {
    return <div style={{ padding: 20 }}>Ładowanie…</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Mój grafik</h1>

      {employeeData && (
        <ScheduleEditor
          employeeId={employeeData.id}
          initialSchedule={scheduleEntries}
          isManager={false}
          onSuccess={loadData}
        />
      )}

      <h2 style={{ marginTop: 30 }}>Urlopy</h2>

      <button onClick={() => setTimeOffModalOpen(true)}>+ Zgłoś urlop</button>

      {timeOffList.length === 0 ? (
        <p>Brak zgłoszeń.</p>
      ) : (
        <table>
          <tbody>
            {timeOffList.map((t) => (
              <tr key={t.id}>
                <td>{t.date_from}</td>
                <td>{t.date_to}</td>
                <td>{t.status}</td>
                <td>
                  <button
                    disabled={t.status !== 'pending'}
                    onClick={() => handleDeleteRequest(t.id, t.status)}
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {employeeData && (
        <TimeOffForm
          isOpen={timeOffModalOpen}
          onClose={() => setTimeOffModalOpen(false)}
          onSuccess={loadData}
          employeeId={employeeData.id}
          isManager={false}
        />
      )}

      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Potwierdź"
      >
        <p>Czy na pewno usunąć wniosek?</p>
        <button onClick={confirmDelete}>Usuń</button>
        <button onClick={() => setConfirmDeleteOpen(false)}>Anuluj</button>
      </Modal>

      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Wystąpił błąd"
      >
        <p>{errorMessage}</p>
      </Modal>
    </div>
  );
};
