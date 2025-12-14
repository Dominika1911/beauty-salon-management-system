import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { employeesAPI } from '../../api/employees';
import { scheduleAPI } from '../../api/schedule';
import { servicesAPI } from '../../api/services';
import { availabilityAPI, type AvailabilitySlot } from '../../api/availability';

import type { Employee, TimeOff, ScheduleEntry, Weekday, Service } from '../../types';

import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { ScheduleEditor } from '../../components/Schedule/ScheduleEditor';
import { TimeOffForm } from '../../components/Schedule/TimeOffForm';
import { WeeklySalonSchedule } from '../../components/Schedule/WeeklySalonSchedule';

import { usePagination } from '../../hooks/usePagination';
import { useNotification } from '../../components/UI/Notification';
import { Modal } from '../../components/UI/Modal';

const SCHEDULE_PAGE_SIZE = 20;
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

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry[]>(EMPTY_SCHEDULE);
  const [selectedLoading, setSelectedLoading] = useState<boolean>(false);

  // --- dostępność / sloty (pod rezerwacje)
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | ''>('');
  const [slotDateFrom, setSlotDateFrom] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [slotDateTo, setSlotDateTo] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [ignoreTimeOff, setIgnoreTimeOff] = useState<boolean>(false);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  // --- modal komunikatów (bez alert())
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalMessage, setModalMessage] = useState<string>('');
  const openModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  const [employeeQuery, setEmployeeQuery] = useState<string>('');

  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState<boolean>(false);
  const [timeOffToEdit, setTimeOffToEdit] = useState<TimeOff | undefined>(undefined);

  const { currentPage, totalPages, setTotalCount, handlePreviousPage, handleNextPage } =
    usePagination(SCHEDULE_PAGE_SIZE);

  // ======= MEMO / CALLBACKI (ZAWSZE PRZED RETURN) =======

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

  const formatDatePL = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTimePL = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatWeekdayShortPL = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pl-PL', { weekday: 'short' }); // np. "pon."
  };

  const groupedSlots = useMemo(() => {
    // grupujemy po dacie startu
    const map = new Map<string, AvailabilitySlot[]>();
    for (const sl of slots) {
      const key = formatDatePL(sl.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sl);
    }
    // stabilna kolejność (data rosnąco według realnego czasu startu)
    const entries = Array.from(map.entries()).map(([dateLabel, list]) => {
      const sorted = [...list].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      const first = sorted[0]?.start;
      return { dateLabel, weekday: first ? formatWeekdayShortPL(first) : '', list: sorted, sortKey: first ? new Date(first).getTime() : 0 };
    });
    entries.sort((a, b) => a.sortKey - b.sortKey);
    return entries;
  }, [slots]);

  const fetchAllData = async (page: number) => {
    if (!isManager) return;

    try {
      setLoading(true);
      setError(null);

      const empResponse = await employeesAPI.list({ page, page_size: SCHEDULE_PAGE_SIZE });
      setEmployeeList(empResponse.data.results);
      setTotalCount(empResponse.data.count);

      const timeOffResponse = await scheduleAPI.listTimeOff({ page: 1, page_size: 200 });
      setAllTimeOff(timeOffResponse.data.results);

      // usługi (do podglądu slotów) – brak usług nie powinien blokować strony
      try {
        const servicesRes = await servicesAPI.published();
        setServices(servicesRes.data ?? []);
      } catch (e) {
        console.warn('Nie udało się pobrać listy usług (sloty):', e);
      }
    } catch (err) {
      console.error('Błąd pobierania danych harmonogramu:', err);
      setError('Nie udało się załadować listy pracowników lub urlopów.');
      showNotification('Nie udało się załadować danych harmonogramu.', 'error');
      openModal('Błąd', 'Nie udało się załadować danych harmonogramu (pracownicy/urlopy).');
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

  const fetchSlots = useCallback(async () => {
    if (!selectedEmployee?.id) {
      openModal('Brak pracownika', 'Wybierz pracownika, aby pobrać sloty.');
      return;
    }
    if (!selectedServiceId) {
      openModal('Brak usługi', 'Wybierz usługę, aby pobrać sloty.');
      return;
    }
    if (!slotDateFrom || !slotDateTo) {
      openModal('Brak zakresu dat', 'Ustaw daty "od" i "do".');
      return;
    }
    if (slotDateFrom > slotDateTo) {
      openModal('Błędny zakres dat', 'Data "od" nie może być późniejsza niż data "do".');
      return;
    }

    setSlotsLoading(true);
    try {
      const res = await availabilityAPI.getSlots({
        employee: selectedEmployee.id,
        service: Number(selectedServiceId),
        date_from: slotDateFrom,
        date_to: slotDateTo,
        ...(ignoreTimeOff ? { ignore_timeoff: true } : {}),
      });
      const newSlots = res.data?.slots ?? [];
      setSlots(newSlots);

      if (newSlots.length === 0) {
        openModal(
          'Brak terminów',
          'Dla tego zakresu nie ma wolnych terminów. Sprawdź grafik pracownika i przypisaną usługę (skills).'
        );
      }
    } catch (err: any) {
      console.error('Błąd pobierania slotów:', err?.response?.data ?? err);
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : 'Nie udało się pobrać slotów.';
      openModal('Błąd', msg);
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedEmployee?.id, selectedServiceId, slotDateFrom, slotDateTo, ignoreTimeOff]);

  useEffect(() => {
    void fetchAllData(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, isManager]);

  const pendingTimeOff = useMemo(() => allTimeOff.filter((t) => t.status === 'pending'), [allTimeOff]);
  const approvedTimeOff = useMemo(() => allTimeOff.filter((t) => t.status === 'approved'), [allTimeOff]);
  const rejectedTimeOff = useMemo(() => allTimeOff.filter((t) => t.status === 'rejected'), [allTimeOff]);

  const filteredEmployeeList = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return employeeList;
    return employeeList.filter((e) => {
      const hay = `${e.first_name} ${e.last_name} ${e.phone ?? ''} ${e.user ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [employeeList, employeeQuery]);

  // ✅ dane do tygodniowego podglądu (na szybko: tylko wybrany pracownik ma wypełniony grafik)
  const weeklySchedules = useMemo(() => {
    const obj: Record<number, ScheduleEntry[]> = {};
    employeeList.forEach((e) => {
      obj[e.id] = selectedEmployee?.id === e.id ? selectedSchedule : [];
    });
    return obj;
  }, [employeeList, selectedEmployee?.id, selectedSchedule]);

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

    if (selectedEmployee?.id) {
      await fetchEmployeeDetail(selectedEmployee.id);
      await fetchEmployeeSchedule(selectedEmployee.id);
    }

    openModal('Zapisano', 'Grafik / nieobecność zapisane.');
    if (selectedEmployee?.id && selectedServiceId) {
      void fetchSlots();
    }
  };

  // ======= RETURNY WARUNKOWE (NA KOŃCU, PO HOOKACH) =======
  if (!isManager) return <div style={{ padding: 20, color: 'red' }}>Brak uprawnień.</div>;
  if (loading) return <div style={{ padding: 20 }}>Ładowanie danych harmonogramu.</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>Błąd: {error}</div>;

  // ======= KOLUMNY =======

  const employeeColumns: ColumnDefinition<Employee>[] = [
    {
      header: 'Imię i Nazwisko',
      key: 'first_name',
      render: (item) => `${item.first_name} ${item.last_name}`,
    },
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

  const timeOffColumns: ColumnDefinition<TimeOff>[] = [
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

  // ======= UI =======

  return (
    <div style={{ padding: 20 }}>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{modalMessage}</div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setModalOpen(false)}>
            Zamknij
          </button>
        </div>
      </Modal>

      <h1>Zarządzanie Harmonogramami</h1>
      <p>Zarządzanie tygodniową dostępnością oraz urlopami wszystkich pracowników.</p>

      <h2 style={{ marginTop: 30 }}>Nieobecności Oczekujące ({pendingTimeOff.length})</h2>
      <Table data={pendingTimeOff} columns={timeOffColumns} loading={false} emptyMessage="Brak oczekujących zgłoszeń urlopowych." />

      <h2 style={{ marginTop: 30 }}>Lista Pracowników</h2>

      <div style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={employeeQuery}
          onChange={(e) => setEmployeeQuery(e.target.value)}
          placeholder="Szukaj pracownika (imię, nazwisko, telefon, ID użytkownika)"
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e6a1ad', minWidth: 320 }}
        />
        <span style={{ color: '#666' }}>
          Wyniki: {filteredEmployeeList.length} / {employeeList.length}
        </span>
      </div>

      <Table data={filteredEmployeeList} columns={employeeColumns} loading={false} emptyMessage="Brak pracowników do zarządzania." />

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

      <div style={{ marginTop: 22 }}>
        <h2>Nieobecności zatwierdzone ({approvedTimeOff.length})</h2>
        <Table data={approvedTimeOff} columns={timeOffColumns} loading={false} emptyMessage="Brak zatwierdzonych nieobecności." />

        <h2 style={{ marginTop: 22 }}>Nieobecności odrzucone ({rejectedTimeOff.length})</h2>
        <Table data={rejectedTimeOff} columns={timeOffColumns} loading={false} emptyMessage="Brak odrzuconych nieobecności." />
      </div>

      {/* ✅ PODGLĄD TYGODNIOWY */}
      <div style={{ marginTop: 40 }}>
        <h2>Tygodniowy grafik salonu</h2>
        <WeeklySalonSchedule employees={employeeList} schedules={weeklySchedules} timeOffs={allTimeOff} />
      </div>

      {/* ✅ EDYTOR GRAFIKU WYBRANEGO PRACOWNIKA */}
      {selectedEmployee && (
        <div id="schedule-editor-section" style={{ marginTop: 30 }}>
          <h2>
            Grafik: {selectedEmployee.first_name} {selectedEmployee.last_name}
          </h2>

          {selectedLoading ? (
            <p>Ładowanie grafiku pracownika...</p>
          ) : (
            <>
              <ScheduleEditor employeeId={selectedEmployee.id} initialSchedule={selectedSchedule} onSuccess={handleSuccess} isManager={true} />

              {/* ✅ PODGLĄD SLOTÓW */}
              <div style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ marginTop: 0, marginBottom: 0 }}>Dostępne terminy</h3>
                  <div style={{ color: '#666' }}>
                    {slotsLoading ? 'Ładowanie…' : slots.length > 0 ? `Razem: ${slots.length}` : ''}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Usługa</span>
                    <select
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : '')}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e6a1ad', minWidth: 260 }}
                    >
                      <option value="">-- wybierz usługę --</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Od</span>
                    <input
                      type="date"
                      value={slotDateFrom}
                      onChange={(e) => setSlotDateFrom(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e6a1ad' }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Do</span>
                    <input
                      type="date"
                      value={slotDateTo}
                      onChange={(e) => setSlotDateTo(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e6a1ad' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                    <input type="checkbox" checked={ignoreTimeOff} onChange={(e) => setIgnoreTimeOff(e.target.checked)} />
                    <span style={{ color: '#666' }}>Ignoruj urlopy</span>
                  </label>

                  <button type="button" onClick={() => void fetchSlots()} disabled={slotsLoading} style={{ marginTop: 22 }}>
                    {slotsLoading ? 'Pobieranie…' : 'Pobierz'}
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  {groupedSlots.length === 0 && !slotsLoading ? (
                    <div style={{ color: '#666' }}>Brak terminów do wyświetlenia.</div>
                  ) : (
                    <div style={{ marginTop: 6, maxHeight: 320, overflowY: 'auto' }}>
                      {groupedSlots.map((group) => (
                        <div key={group.dateLabel} style={{ marginBottom: 14 }}>
                          <div style={{ fontWeight: 700, padding: '8px 10px', background: '#fafafa', borderRadius: 10, border: '1px solid #eee' }}>
                            {group.dateLabel} <span style={{ color: '#666', fontWeight: 500 }}>({group.weekday})</span>
                          </div>

                          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {group.list.slice(0, 96).map((sl, idx) => {
                              const from = formatTimePL(sl.start);
                              const to = formatTimePL(sl.end);
                              return (
                                <div
                                  key={`${sl.start}-${idx}`}
                                  style={{
                                    padding: '8px 10px',
                                    border: '1px solid #eee',
                                    borderRadius: 10,
                                    background: '#fff',
                                    fontWeight: 600,
                                  }}
                                >
                                  {from}–{to}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ✅ MODAL URLOPU */}
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
