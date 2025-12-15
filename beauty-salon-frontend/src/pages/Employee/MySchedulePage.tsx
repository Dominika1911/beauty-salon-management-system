import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { Employee, TimeOff, ScheduleEntry, ScheduleDetail } from '../../types';
import { employeesAPI } from '../../api/employees';
import { scheduleAPI } from '../../api/schedule';
import { ScheduleEditor } from '../../components/Schedule/ScheduleEditor';
import { TimeOffForm } from '../../components/Schedule/TimeOffForm';
import { Modal } from '../../components/UI/Modal';
import { useNotification } from '../../components/UI/Notification';

type PageState = 'idle' | 'loading' | 'ready';

function extractScheduleEntries(data: unknown): ScheduleEntry[] {
  if (Array.isArray(data)) return data as ScheduleEntry[];

  if (data && typeof data === 'object' && 'availability_periods' in (data as Record<string, unknown>)) {
    const periods = (data as ScheduleDetail).availability_periods;
    return Array.isArray(periods) ? periods : [];
  }

  return [];
}

export const MySchedulePage: React.FC = (): ReactElement => {
  const { isEmployee } = useAuth();
  const { showNotification } = useNotification();

  const [employeeData, setEmployeeData] = useState<Employee | null>(null);

  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [timeOffList, setTimeOffList] = useState<TimeOff[]>([]);
  const [timeOffError, setTimeOffError] = useState<string | null>(null);

  const [pageState, setPageState] = useState<PageState>('idle');

  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState<boolean>(false);
  const [timeOffToEdit, setTimeOffToEdit] = useState<TimeOff | undefined>(undefined);

  // błędy krytyczne (tylko gdy nie da się nawet pobrać employee/me lub przy akcjach)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);
  const [errorModalMessage, setErrorModalMessage] = useState<string>('');

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const canLoad = useMemo(() => Boolean(isEmployee), [isEmployee]);

  const fetchScheduleData = useCallback(async (): Promise<void> => {
    if (!isEmployee) return;

    setPageState('loading');
    setScheduleError(null);
    setTimeOffError(null);

    // 1) employee/me – krytyczne
    let employee: Employee;
    try {
      const empResponse = await employeesAPI.me();
      employee = empResponse.data;
      setEmployeeData(employee);
    } catch (err) {
      console.error('employeesAPI.me error:', err);
      setEmployeeData(null);
      setScheduleEntries([]);
      setTimeOffList([]);

      setErrorModalMessage('Nie udało się pobrać danych pracownika (employees/me).');
      setIsErrorModalOpen(true);
      showNotification('Nie udało się pobrać profilu pracownika.', 'error');

      setPageState('ready');
      return;
    }

    // 2) Grafik – jeśli backend wywala 500, NIE blokujemy strony (bez modala na starcie)
    const schedulePromise = (async (): Promise<boolean> => {
      try {
        const res = await scheduleAPI.getEmployeeSchedule(employee.id);
        setScheduleEntries(extractScheduleEntries(res.data));
        setScheduleError(null);
        return true;
      } catch (err1) {
        console.error('getEmployeeSchedule error:', err1);

        // fallback: /schedules/?employee={id}
        try {
          const res2 = await scheduleAPI.list({ employee: employee.id, ordering: '-id', page_size: 1 });
          const first = res2.data.results?.[0];
          if (first) {
            setScheduleEntries(extractScheduleEntries(first));
            setScheduleError(null);
            return true;
          }

          setScheduleEntries([]);
          setScheduleError('Nie udało się pobrać grafiku (brak danych).');
          return false;
        } catch (err2) {
          console.error('schedulesAPI.list fallback error:', err2);
          setScheduleEntries([]);
          // Tu w logach widać 500 – to backend. Nie spamujemy modalem.
          setScheduleError('Nie udało się pobrać grafiku (błąd serwera).');
          return false;
        }
      }
    })();

    // 3) Urlopy – niezależnie
    const timeOffPromise = scheduleAPI
      .listTimeOff({ employee: employee.id, ordering: '-date_from' })
      .then((res) => {
        setTimeOffList(res.data.results ?? []);
        setTimeOffError(null);
        return true;
      })
      .catch((err) => {
        console.error('listTimeOff error:', err);
        setTimeOffList([]);
        setTimeOffError('Nie udało się pobrać urlopów.');
        return false;
      });

    const [scheduleOk, timeOffOk] = await Promise.all([schedulePromise, timeOffPromise]);

    // toast informacyjny (bez modala)
    if (!scheduleOk) {
      showNotification('Nie udało się pobrać grafiku (backend 500).', 'error');
    }
    if (!timeOffOk) {
      showNotification('Nie udało się pobrać urlopów.', 'error');
    }

    setPageState('ready');
  }, [isEmployee, showNotification]);

  const handleSuccess = useCallback(() => {
    setIsTimeOffModalOpen(false);
    setTimeOffToEdit(undefined);
    void fetchScheduleData();
  }, [fetchScheduleData]);

  const requestDeleteTimeOff = useCallback(
    (timeOffId: number, status: TimeOff['status']) => {
      if (status !== 'pending') {
        showNotification('Możesz usunąć tylko zgłoszenia w statusie "pending".', 'info');
        return;
      }
      setPendingDeleteId(timeOffId);
      setIsConfirmDeleteOpen(true);
    },
    [showNotification]
  );

  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!pendingDeleteId) return;

    try {
      await scheduleAPI.deleteTimeOff(pendingDeleteId);
      showNotification('Zgłoszenie zostało usunięte.', 'success');
      setIsConfirmDeleteOpen(false);
      setPendingDeleteId(null);
      void fetchScheduleData();
    } catch (err) {
      console.error('deleteTimeOff error:', err);
      setErrorModalMessage('Nie udało się usunąć zgłoszenia. Spróbuj ponownie.');
      setIsErrorModalOpen(true);
      showNotification('Błąd podczas usuwania zgłoszenia.', 'error');
    }
  }, [fetchScheduleData, pendingDeleteId, showNotification]);

  useEffect(() => {
    if (!canLoad) return;
    void fetchScheduleData();
  }, [canLoad, fetchScheduleData]);

  if (!isEmployee) {
    return <div style={{ padding: 20, color: 'red' }}>Strona dostępna tylko dla pracownika.</div>;
  }

  if (pageState === 'loading') {
    return <div style={{ padding: 20 }}>Ładowanie Twojego grafiku...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>
        Mój Grafik{employeeData ? ` (${employeeData.first_name} ${employeeData.last_name})` : ''}
      </h1>

      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => void fetchScheduleData()}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer', fontWeight: 700 }}
        >
          Odśwież
        </button>
      </div>

      <p style={{ marginTop: 10 }}>
        Tutaj możesz przeglądać swoje standardowe godziny pracy oraz zarządzać zgłoszonymi urlopami i nieobecnościami.
      </p>

      <h2 style={{ marginTop: 30 }}>Tygodniowa Dostępność</h2>

      {scheduleError ? (
        <div style={{ padding: 12, border: '1px solid #f3c4cc', borderRadius: 12, background: '#fff0f3', color: '#8b2c3b' }}>
          <b>Grafik niedostępny.</b> {scheduleError}
          <div style={{ marginTop: 8, fontSize: 13, color: '#5a2a35' }}>
            (W konsoli widać HTTP 500 — to błąd backendu, nie frontu.)
          </div>
        </div>
      ) : employeeData ? (
        <ScheduleEditor
          employeeId={employeeData.id}
          initialSchedule={scheduleEntries}
          onSuccess={handleSuccess}
          isManager={false}
        />
      ) : (
        <p>Brak danych pracownika.</p>
      )}

      <h2 style={{ marginTop: 30 }}>Urlopy i Nieobecności</h2>

      <button
        type="button"
        onClick={() => {
          setIsTimeOffModalOpen(true);
          setTimeOffToEdit(undefined);
        }}
        style={{
          marginBottom: 15,
          padding: '10px 15px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 8,
          fontWeight: 700,
        }}
      >
        + Zgłoś Nową Nieobecność
      </button>

      {timeOffError && (
        <div style={{ padding: 12, color: 'red' }}>
          Błąd: {timeOffError}{' '}
          <button type="button" onClick={() => void fetchScheduleData()} style={{ marginLeft: 10, cursor: 'pointer' }}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {timeOffList.length === 0 ? (
          <p>Brak zgłoszonych urlopów.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Od</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Do</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Powód</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {timeOffList.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{item.date_from}</td>
                  <td style={{ padding: '8px' }}>{item.date_to}</td>
                  <td style={{ padding: '8px' }}>{item.reason}</td>
                  <td
                    style={{
                      padding: '8px',
                      color: item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'orange',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {item.status}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <button
                      type="button"
                      onClick={() => requestDeleteTimeOff(item.id, item.status)}
                      disabled={item.status !== 'pending'}
                      style={{
                        color: item.status !== 'pending' ? '#999' : 'red',
                        border: 'none',
                        background: 'none',
                        cursor: item.status !== 'pending' ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      {item.status !== 'pending' ? '---' : 'Usuń'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {employeeData && (
        <TimeOffForm
          isOpen={isTimeOffModalOpen}
          onClose={() => setIsTimeOffModalOpen(false)}
          onSuccess={handleSuccess}
          employeeId={employeeData.id}
          isManager={false}
          timeOffToEdit={timeOffToEdit}
        />
      )}

      <Modal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setPendingDeleteId(null);
        }}
        title="Potwierdź usunięcie"
      >
        <div style={{ padding: 12 }}>
          <p style={{ marginTop: 0 }}>Czy na pewno chcesz usunąć to zgłoszenie nieobecności?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => {
                setIsConfirmDeleteOpen(false);
                setPendingDeleteId(null);
              }}
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

      <Modal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} title="Wystąpił błąd">
        <div style={{ padding: 12 }}>
          <p style={{ marginTop: 0, whiteSpace: 'pre-line' }}>{errorModalMessage}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => {
                setIsErrorModalOpen(false);
                void fetchScheduleData();
              }}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Spróbuj ponownie
            </button>
            <button
              type="button"
              onClick={() => setIsErrorModalOpen(false)}
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

export default MySchedulePage;
