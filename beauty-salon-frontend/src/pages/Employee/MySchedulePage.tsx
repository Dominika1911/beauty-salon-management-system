// src/pages/Employee/MySchedulePage.tsx

import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import type { Employee, TimeOff, ScheduleEntry, Weekday } from '@/shared/types';
import { employeesAPI } from '@/shared/api/employees';
import { scheduleAPI } from '@/shared/api/schedule';
import { ScheduleEditor } from '@/features/schedule/components/ScheduleEditor';
import { TimeOffForm } from '@/features/schedule/components/TimeOffForm';
import { useNotification } from '@/shared/ui/Notification';

type PageState = 'idle' | 'loading' | 'ready' | 'error';

const EN_TO_PL_WEEKDAY: Record<string, Weekday> = {
  Monday: 'Poniedziałek',
  Tuesday: 'Wtorek',
  Wednesday: 'Środa',
  Thursday: 'Czwartek',
  Friday: 'Piątek',
  Saturday: 'Sobota',
  Sunday: 'Niedziela',
};

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

      // 1) dane pracownika
      const empResponse = await employeesAPI.me();
      const employee = empResponse.data;

      // 2) grafik pracownika
      const scheduleResponse = await scheduleAPI.getEmployeeSchedule(employee.id);

      const rawPeriods = (scheduleResponse.data?.availability_periods ?? []) as Array<{
        weekday: string;
        start_time: string;
        end_time: string;
        id?: number;
      }>;

      const periods: ScheduleEntry[] = rawPeriods
        .filter((p) => Boolean(p.weekday && p.start_time && p.end_time))
        .map((p, idx) => ({
          id: (p.id ?? Number(`${Date.now()}${idx}`)) as any,
          weekday: EN_TO_PL_WEEKDAY[p.weekday] ?? (p.weekday as any),
          start_time: (p.start_time ?? '').substring(0, 5),
          end_time: (p.end_time ?? '').substring(0, 5),
        }));

      // 3) urlopy
      // ✅ listTimeOff przyjmuje params object (a nie number).
      // Dla pracownika backend zwykle zwraca "moje" wpisy bez filtra employee=...
      const timeOffResponse = await scheduleAPI.listTimeOff({
        ordering: '-date_from',
        page_size: 100,
      });

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
    void fetchScheduleData();
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
        <ScheduleEditor employeeId={employeeData.id} initialSchedule={scheduleEntries} onSuccess={handleSuccess} isManager={false} />
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
