import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { employeesAPI } from '../../api/employees';
import { scheduleAPI } from '../../api/schedule';

import type { Employee, TimeOff, ScheduleEntry, Weekday } from '../../types';

import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { ScheduleEditor } from '../../components/Schedule/ScheduleEditor';
import { TimeOffForm } from '../../components/Schedule/TimeOffForm';

import { usePagination } from '../../hooks/usePagination';
import { useNotification } from '../../components/UI/Notification';


const SCHEDULE_PAGE_SIZE = 20;
// ✅ stała referencja, żeby nie robić nowego [] na każdym renderze
const EMPTY_SCHEDULE: ScheduleEntry[] = [];

type BackendPeriod = { weekday: string; start_time: string; end_time: string };

const ENGLISH_TO_POLISH_MAP = new Map<string, Weekday>([
  ['Monday', 'Poniedziałek'],
  ['Tuesday', 'Wtorek'],
  ['Wednesday', 'Środa'],
  ['Thursday', 'Czwartek'],
  ['Friday', 'Piątek'],
  ['Saturday', 'Sobota'],
  ['Sunday', 'Niedziela'],
]);

export const ScheduleManagementPage: React.FC = (): ReactElement => {
  const { isManager } = useAuth();
  const { showNotification } = useNotification();

  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [allTimeOff, setAllTimeOff] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ wybrany pracownik zawsze z DETAIL()
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // ✅ osobno trzymamy grafik (nie zakładamy, że employee.detail ma schedule)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry[]>(EMPTY_SCHEDULE);

  const [selectedLoading, setSelectedLoading] = useState<boolean>(false);

  // Urlopy w modalu
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState<boolean>(false);
  const [timeOffToEdit, setTimeOffToEdit] = useState<TimeOff | undefined>(undefined);

  const { currentPage, totalPages, setTotalCount, handlePreviousPage, handleNextPage } =
    usePagination(SCHEDULE_PAGE_SIZE);

  const employeeMap = useMemo(() => {
    const m = new Map<number, Employee>();
    employeeList.forEach((e) => m.set(e.id, e));
    return m;
  }, [employeeList]);

  const mapPeriodsToScheduleEntries = (periods: BackendPeriod[]): ScheduleEntry[] => {
    return periods.map((p, idx) => ({
      id: idx,
      weekday: (ENGLISH_TO_POLISH_MAP.get(p.weekday) ?? p.weekday) as any,
      start_time: (p.start_time ?? '').substring(0, 5),
      end_time: (p.end_time ?? '').substring(0, 5),
    }));
  };

  const fetchAllData = async (page: number) => {
    if (!isManager) return;

    try {
      setLoading(true);
      setError(null);

      const empResponse = await employeesAPI.list({ page, page_size: SCHEDULE_PAGE_SIZE });
      setEmployeeList(empResponse.data.results);
      setTotalCount(empResponse.data.count);

      const timeOffResponse = await scheduleAPI.listTimeOff();
      setAllTimeOff(timeOffResponse.data.results);
    } catch (err) {
      console.error('Błąd pobierania danych harmonogramu:', err);
      setError('Nie udało się załadować listy pracowników lub urlopów.');
      showNotification('Nie udało się załadować danych harmonogramu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeDetail = async (employeeId: number) => {
    try {
      setSelectedLoading(true);
      const res = await employeesAPI.detail(employeeId);
      setSelectedEmployee(res.data);
    } catch (err) {
      console.error('Błąd pobierania szczegółów pracownika:', err);
      showNotification('Nie udało się pobrać szczegółów pracownika.', 'error');
    } finally {
      setSelectedLoading(false);
    }
  };

  const fetchEmployeeSchedule = useCallback(
    async (employeeId: number) => {
      try {
        setSelectedLoading(true);
        const res = await scheduleAPI.getEmployeeSchedule(employeeId);
        const periods = (res.data?.availability_periods ?? []) as BackendPeriod[];
        setSelectedSchedule(mapPeriodsToScheduleEntries(periods));
      } catch (err) {
        console.error('Błąd pobierania grafiku pracownika:', err);
        setSelectedSchedule(EMPTY_SCHEDULE);
        showNotification('Nie udało się pobrać grafiku pracownika.', 'error');
      } finally {
        setSelectedLoading(false);
      }
    },
    [showNotification]
  );

  useEffect(() => {
    void fetchAllData(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, isManager]);

  const scrollToEditor = () => {
    setTimeout(() => {
      document.getElementById('schedule-editor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const openEditorInline = async (employee: Employee) => {
    await fetchEmployeeDetail(employee.id);
    await fetchEmployeeSchedule(employee.id);
    scrollToEditor();
  };

  const openTimeOffModal = (employee: Employee, timeOff?: TimeOff) => {
    setSelectedEmployee(employee);
    setTimeOffToEdit(timeOff);
    setIsTimeOffModalOpen(true);
  };

  const handleSuccess = async () => {
    setIsTimeOffModalOpen(false);
    setTimeOffToEdit(undefined);

    await fetchAllData(currentPage);

    // ✅ po zapisie zawsze odśwież detail + schedule
    if (selectedEmployee?.id) {
      await fetchEmployeeDetail(selectedEmployee.id);
      await fetchEmployeeSchedule(selectedEmployee.id);
    }
  };

  if (!isManager) return <div style={{ padding: 20, color: 'red' }}>Brak uprawnień.</div>;
  if (loading) return <div style={{ padding: 20 }}>Ładowanie danych harmonogramu.</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>Błąd: {error}</div>;

  const employeeColumns: ColumnDefinition<Employee>[] = [
    { header: 'Imię i Nazwisko', key: 'first_name', render: (item) => `${item.first_name} ${item.last_name}` },
    { header: 'Telefon', key: 'phone' },
    { header: 'ID Użytkownika', key: 'user' },
    {
      header: 'Akcje',
      key: 'actions',
      render: (item) => (
        <>
          <button onClick={() => void openEditorInline(item)} style={{ marginRight: '5px' }}>
            Edytuj Grafik
          </button>
          <button onClick={() => openTimeOffModal(item)} style={{ color: 'red' }}>
            Urlop (Dodaj)
          </button>
        </>
      ),
    },
  ];

  const pendingTimeOffColumns: ColumnDefinition<TimeOff>[] = [
    {
      header: 'Pracownik',
      key: 'employee',
      render: (item) => {
        const emp = employeeMap.get(item.employee);
        return emp ? `${emp.first_name} ${emp.last_name}` : `ID: ${item.employee}`;
      },
    },
    { header: 'Od', key: 'date_from', render: (item) => item.date_from },
    { header: 'Do', key: 'date_to', render: (item) => item.date_to },
    { header: 'Powód', key: 'reason' },
    { header: 'Status', key: 'status', render: (item) => item.status },
    {
      header: 'Akcje',
      key: 'actions',
      render: (item) => {
        const emp = employeeMap.get(item.employee);
        if (!emp) return <span style={{ color: '#999' }}>Brak danych</span>;
        return <button onClick={() => openTimeOffModal(emp, item)}>Zatwierdź / Edytuj</button>;
      },
    },
  ];

  const pendingTimeOff = allTimeOff.filter((t) => t.status === 'pending');

  return (
    <div style={{ padding: 20 }}>
      <h1>Zarządzanie Harmonogramami</h1>
      <p>Zarządzanie tygodniową dostępnością oraz urlopami wszystkich pracowników.</p>

      <h2 style={{ marginTop: 30 }}>Nieobecności Oczekujące ({pendingTimeOff.length})</h2>
      <Table
        data={pendingTimeOff}
        columns={pendingTimeOffColumns}
        loading={loading}
        emptyMessage="Brak oczekujących zgłoszeń urlopowych."
      />

      <h2 style={{ marginTop: 30 }}>Lista Pracowników</h2>
      <Table data={employeeList} columns={employeeColumns} loading={loading} emptyMessage="Brak pracowników do zarządzania." />

      {totalPages > 1 && (
        <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" onClick={handlePreviousPage} disabled={currentPage === 1}>
            Poprzednia
          </button>
          <span>
            Strona {currentPage} z {totalPages}
          </span>
          <button type="button" onClick={handleNextPage} disabled={currentPage === totalPages}>
            Następna
          </button>
        </div>
      )}

      {selectedEmployee && (
        <div id="schedule-editor-section" style={{ marginTop: 30 }}>
          <h2>
            Grafik: {selectedEmployee.first_name} {selectedEmployee.last_name}
          </h2>

          {selectedLoading ? (
            <p>Ładowanie grafiku pracownika...</p>
          ) : (
            <ScheduleEditor
              employeeId={selectedEmployee.id}
              initialSchedule={selectedSchedule}
              onSuccess={handleSuccess}
              isManager={true}
            />
          )}
        </div>
      )}

      {selectedEmployee && (
        <TimeOffForm
          isOpen={isTimeOffModalOpen}
          onClose={() => setIsTimeOffModalOpen(false)}
          onSuccess={handleSuccess}
          employeeId={selectedEmployee.id}
          isManager={true}
          timeOffToEdit={timeOffToEdit}
        />
      )}
    </div>
  );
};
