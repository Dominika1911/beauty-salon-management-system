// src/pages/Employee/MySchedulePage.tsx

import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { Employee, TimeOff, ScheduleEntry } from '../../types';
import { employeesAPI } from '../../api/employees';
import { scheduleAPI } from '../../api/schedule';
import { ScheduleEditor } from '../../components/Schedule/ScheduleEditor';
import { TimeOffForm } from '../../components/Schedule/TimeOffForm';
import { useNotification } from '../../components/UI/Notification';

type PageState = 'idle' | 'loading' | 'ready' | 'error';

export const MySchedulePage: React.FC = (): ReactElement => {
  const { isEmployee } = useAuth();
  const { showNotification } = useNotification();

  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [timeOffList, setTimeOffList] = useState<TimeOff[]>([]);
  const [pageState, setPageState] = useState<PageState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState<boolean>(false);
  const [timeOffToEdit, setTimeOffToEdit] = useState<TimeOff | undefined>(undefined);

  const canLoad = useMemo(() => Boolean(isEmployee), [isEmployee]);

  const fetchScheduleData = useCallback(async (): Promise<void> => {
    if (!isEmployee) return;

    try {
      setPageState('loading');
      setError(null);

      // 1) Bierzemy dane pracownika (imię/nazwisko + prawdziwe employee.id)
      const empResponse = await employeesAPI.me();
      const employee = empResponse.data;

      // 2) Bierzemy grafik z dedykowanego endpointu grafiku (to co ustawił manager)
      const scheduleResponse = await scheduleAPI.getEmployeeSchedule(employee.id);
      const periods = (scheduleResponse.data?.availability_periods ?? []) as unknown as ScheduleEntry[];

      // 3) Urlopy (zostawiamy Twoje listTimeOff po employee.id)
      const timeOffResponse = await scheduleAPI.listTimeOff(employee.id);

      setEmployeeData(employee);
      setScheduleEntries(periods);
      setTimeOffList(timeOffResponse.data.results ?? []);
      setPageState('ready');
    } catch (err) {
      console.error('Błąd pobierania danych grafiku:', err);
      setEmployeeData(null);
      setScheduleEntries([]);
      setTimeOffList([]);
      setError('Nie udało się załadować grafiku i urlopów. Sprawdź status backendu.');
      setPageState('error');
      showNotification('Nie udało się pobrać danych grafiku.', 'error');
    }
  }, [isEmployee, showNotification]);

  const handleSuccess = useCallback(() => {
    setIsTimeOffModalOpen(false);
    setTimeOffToEdit(undefined);
    void fetchScheduleData();
  }, [fetchScheduleData]);

  const handleDeleteTimeOff = useCallback(
    async (timeOffId: number, status: TimeOff['status']) => {
      if (status !== 'pending') {
        showNotification('Możesz usunąć tylko zgłoszenia w statusie "pending".', 'info');
        return;
      }

      const confirmed = window.confirm('Czy na pewno chcesz usunąć to zgłoszenie nieobecności?');
      if (!confirmed) return;

      try {
        await scheduleAPI.deleteTimeOff(timeOffId);
        showNotification('Zgłoszenie zostało usunięte.', 'success');
        handleSuccess();
      } catch (err) {
        console.error('Błąd podczas usuwania urlopu:', err);
        showNotification('Błąd podczas usuwania zgłoszenia.', 'error');
      }
    },
    [handleSuccess, showNotification]
  );

  useEffect(() => {
    if (!canLoad) return;

    (async () => {
      await fetchScheduleData();
    })();
  }, [canLoad, fetchScheduleData]);

  if (!isEmployee) {
    return <div style={{ padding: 20, color: 'red' }}>Strona dostępna tylko dla pracownika.</div>;
  }

  if (pageState === 'loading') {
    return <div style={{ padding: 20 }}>Ładowanie Twojego grafiku...</div>;
  }

  if (pageState === 'error') {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        Błąd: {error ?? 'Wystąpił nieznany błąd.'}{' '}
        <button type="button" onClick={() => void fetchScheduleData()} style={{ marginLeft: 10, cursor: 'pointer' }}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>
        Mój Grafik{employeeData ? ` (${employeeData.first_name} ${employeeData.last_name})` : ''}
      </h1>

      <p>
        Tutaj możesz przeglądać swoje standardowe godziny pracy oraz zarządzać zgłoszonymi urlopami i nieobecnościami.
      </p>

      <h2 style={{ marginTop: 30 }}>Tygodniowa Dostępność</h2>
      {employeeData ? (
        <ScheduleEditor
          employeeId={employeeData.id}
          //najważniejsze: bierzemy grafik z /employees/{id}/schedule/
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
                      onClick={() => void handleDeleteTimeOff(item.id, item.status)}
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
    </div>
  );
};
