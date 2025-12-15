import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { employeesAPI } from '../../api/employees';
import { availabilityAPI, type AvailabilityResponse, type AvailabilitySlot } from '../../api/availability';
import type { Employee, Service } from '../../types';
import { Modal } from '../../components/UI/Modal';
import { useAuth } from '../../hooks/useAuth';

function toYMD(d: Date): string {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toYMD(dt);
}

function groupSlotsByDate(slots: AvailabilitySlot[]): Record<string, AvailabilitySlot[]> {
  return slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    const day = s.start.slice(0, 10);
    acc[day] = acc[day] ?? [];
    acc[day].push(s);
    return acc;
  }, {});
}

export const MyAvailabilityPage: React.FC = (): ReactElement => {
  const { isEmployee } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);

  const [dateFrom, setDateFrom] = useState<string>(() => toYMD(new Date()));
  const dateTo = useMemo(() => addDays(dateFrom, 6), [dateFrom]);

  const [loading, setLoading] = useState(false);
  const [slotsResp, setSlotsResp] = useState<AvailabilityResponse | null>(null);

  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadEmployeeAndServices = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const empRes = await employeesAPI.me();
      const emp = empRes.data;
      setEmployee(emp);

      // jeśli backend zwraca skills w /employees/me/ – bierzemy stamtąd
      if (emp.skills && emp.skills.length > 0) {
        setServices(emp.skills);
        setServiceId(emp.skills[0]?.id ?? null);
      } else {
        // fallback na /employees/{id}/services/
        const srvRes = await employeesAPI.services(emp.id);
        setServices(srvRes.data);
        setServiceId(srvRes.data[0]?.id ?? null);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('Nie udało się pobrać danych pracownika lub listy usług.');
      setErrorModalOpen(true);
      setEmployee(null);
      setServices([]);
      setServiceId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSlots = useCallback(async (): Promise<void> => {
    if (!employee || !serviceId) return;

    try {
      setLoading(true);
      const res = await availabilityAPI.getSlots({
        employee: employee.id,
        service: serviceId,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setSlotsResp(res.data);
    } catch (e) {
      console.error(e);
      setSlotsResp(null);
      setErrorMessage('Nie udało się pobrać slotów dostępności.');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, [employee, serviceId, dateFrom, dateTo]);

  useEffect(() => {
    if (!isEmployee) return;
    void loadEmployeeAndServices();
  }, [isEmployee, loadEmployeeAndServices]);

  useEffect(() => {
    if (!employee || !serviceId) return;
    void loadSlots();
  }, [employee, serviceId, dateFrom, dateTo, loadSlots]);

  if (!isEmployee) {
    return <div style={{ padding: 20 }}>Dostęp tylko dla pracownika.</div>;
  }

  const grouped = groupSlotsByDate(slotsResp?.slots ?? []);
  const days = Object.keys(grouped).sort();

  return (
    <div style={{ padding: 20, maxWidth: 1000 }}>
      <h1>Moja dostępność</h1>
      <p style={{ marginTop: 6, color: '#666' }}>
        Podgląd wolnych slotów (kolejne 7 dni) dla wybranej usługi.
      </p>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Usługa</div>
          <select
            value={serviceId ?? ''}
            onChange={(e) => setServiceId(Number(e.target.value))}
            disabled={services.length === 0}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #f3c4cc' }}
          >
            {services.length === 0 ? (
              <option value="">Brak usług</option>
            ) : (
              services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Początek zakresu</div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #f3c4cc' }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Zakres</div>
          <div style={{ padding: 10, borderRadius: 8, border: '1px solid #f3c4cc', background: '#fff0f3' }}>
            {dateFrom} → {dateTo}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => void loadSlots()}
          disabled={loading || !employee || !serviceId}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ccc',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700,
          }}
        >
          {loading ? 'Ładowanie…' : 'Odśwież sloty'}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        {!serviceId ? (
          <p>Wybierz usługę, aby zobaczyć dostępność.</p>
        ) : loading ? (
          <p>Ładowanie slotów…</p>
        ) : (slotsResp?.slots?.length ?? 0) === 0 ? (
          <p>Brak dostępnych slotów w wybranym zakresie.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {days.map((day) => (
              <div
                key={day}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 12,
                  padding: 14,
                  background: '#fff',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 10 }}>{day}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {grouped[day].map((s) => (
                    <span
                      key={s.start}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1px solid #f3c4cc',
                        background: '#fff0f3',
                        fontWeight: 700,
                        fontSize: 13,
                        color: '#5a2a35',
                      }}
                    >
                      {s.start.slice(11, 16)}–{s.end.slice(11, 16)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} title="Wystąpił błąd">
        <div style={{ padding: 12 }}>
          <p style={{ marginTop: 0 }}>{errorMessage}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => {
                setErrorModalOpen(false);
                void loadEmployeeAndServices();
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

export default MyAvailabilityPage;
