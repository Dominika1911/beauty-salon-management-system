import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { Client, Employee, Service } from '@/types';

import { clientsAPI } from '@/api/clients.ts';
import { servicesAPI } from '@/api/services.ts';
import { employeesAPI } from '@/api/employees.ts';
import { availabilityAPI, type AvailabilitySlot } from '@/api/availability.ts';
import { appointmentsAPI } from '@/api/appointments.ts';

import { Modal } from "@/components/Modal.tsx";

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allowIgnoreTimeOff?: boolean;

  /** YYYY-MM-DD — jeżeli podasz, modal startuje od tej daty (np. dzień z kalendarza) */
  initialDate?: string;
}

interface AppointmentFormData {
  serviceId: number | '';
  employeeId: number | '';
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD

  clientId: number | '';
  client_notes: string;
  internal_notes: string;

  ignore_timeoff: boolean;
}

const todayYMD = (): string => new Date().toISOString().slice(0, 10);

const addDaysYMD = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const getInitialFormData = (allowIgnoreTimeOff?: boolean, initialDate?: string): AppointmentFormData => ({
  serviceId: '',
  employeeId: '',
  date_from: initialDate ?? todayYMD(),
  // jeśli initialDate jest podane, domyślnie pokazujemy tylko ten dzień (żeby pasowało do widoku dziennego)
  date_to: initialDate ?? addDaysYMD(7),
  clientId: '',
  client_notes: '',
  internal_notes: '',
  ignore_timeoff: !!allowIgnoreTimeOff,
});

const formatSlotLabel = (slot: AvailabilitySlot): string => {
  const s = new Date(slot.start);
  const e = new Date(slot.end);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
  const hhmm = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
  const ehmm = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
  return `${ymd} ${hhmm} – ${ehmm}`;
};

export const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  allowIgnoreTimeOff,
  initialDate,
}): ReactElement => {
  const [formData, setFormData] = useState<AppointmentFormData>(getInitialFormData(allowIgnoreTimeOff, initialDate));

  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // reset przy otwarciu (ważne: z datą z kalendarza)
  useEffect(() => {
    if (!isOpen) return;
    setFormData(getInitialFormData(allowIgnoreTimeOff, initialDate));
    setSlots([]);
    setSelectedSlotIndex(null);
    setSubmissionError(null);
  }, [isOpen, allowIgnoreTimeOff, initialDate]);

  // init: usługi + pracownicy + klienci
  useEffect(() => {
    if (!isOpen) return;

    const load = async (): Promise<void> => {
      setLoadingInit(true);
      setSubmissionError(null);

      try {
        const [svcRes, empRes, cliRes] = await Promise.all([
          servicesAPI.published(),
          employeesAPI.active(),
          clientsAPI.list({ page: 1, page_size: 200 }),
        ]);

        setServices(svcRes.data ?? []);
        setEmployees(empRes.data ?? []);
        setClients(cliRes.data?.results ?? []);
      } catch (e) {
        console.error(e);
        setSubmissionError('Nie udało się pobrać listy usług, pracowników lub klientów.');
      } finally {
        setLoadingInit(false);
      }
    };

    void load();
  }, [isOpen]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === formData.serviceId),
    [services, formData.serviceId]
  );

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === formData.employeeId),
    [employees, formData.employeeId]
  );

  const selectedClient = useMemo(() => {
    if (formData.clientId === '') return null;
    return clients.find((c) => c.id === formData.clientId) ?? null;
  }, [clients, formData.clientId]);

  // pracownicy, którzy mają daną usługę
  const filteredEmployees = useMemo(() => {
    if (!formData.serviceId) return [];
    return employees.filter((e) => (e.skills ?? []).some((svc) => svc.id === formData.serviceId));
  }, [employees, formData.serviceId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
      const target = e.target;
      const { name } = target;

      // checkbox
      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        const checked = target.checked;
        setFormData((prev) => ({ ...prev, [name]: checked }));
        return;
      }

      const value = target.value;

      // selecty z ID
      if (name === 'serviceId' || name === 'employeeId' || name === 'clientId') {
        setFormData((prev) => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
        return;
      }

      // reszta (input/date/textarea)
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  // po zmianie usługi resetuj pracownika + sloty
  useEffect(() => {
    setFormData((prev) => ({ ...prev, employeeId: '' }));
    setSlots([]);
    setSelectedSlotIndex(null);
  }, [formData.serviceId]);

  // po zmianie pracownika / dat / ignore_timeoff pobierz sloty
  useEffect(() => {
    if (!isOpen) return;
    if (!formData.employeeId || !formData.serviceId) return;

    const loadSlots = async (): Promise<void> => {
      setLoadingSlots(true);
      setSlots([]);
      setSelectedSlotIndex(null);

      try {
        const res = await availabilityAPI.getSlots({
          employee: Number(formData.employeeId),
          service: Number(formData.serviceId),
          date_from: formData.date_from,
          date_to: formData.date_to,
          ignore_timeoff: formData.ignore_timeoff,
        });

        //  backend API wrapper typuje odpowiedź jako { slots: AvailabilitySlot[] }
        const list = res.data?.slots ?? [];
        setSlots(list.slice(0, 60));
      } catch (e: any) {
        console.error('Slots error:', e?.response?.status, e?.response?.data ?? e);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    void loadSlots();
  }, [isOpen, formData.employeeId, formData.serviceId, formData.date_from, formData.date_to, formData.ignore_timeoff]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmissionError(null);

    if (!selectedService || !selectedEmployee) {
      setSubmissionError('Wybierz usługę i pracownika.');
      return;
    }

    // WYMAGAJ klienta (backend wymaga pola client w serializerze)
    if (!selectedClient) {
      setSubmissionError('Wybierz klienta.');
      return;
    }

    if (selectedSlotIndex === null || !slots[selectedSlotIndex]) {
      setSubmissionError('Wybierz konkretny termin (slot).');
      return;
    }

    setLoadingSubmit(true);

    try {
      const slot = slots[selectedSlotIndex];

      // backend przyjmuje "slugowe" pola:
      // client: Client.number, employee: Employee.number, service: Service.name
      const payload = {
        client: selectedClient.number, // ✅ bez null
        employee: (selectedEmployee as any).number,
        service: selectedService.name,
        start: slot.start,
        end: slot.end,
        client_notes: formData.client_notes || '',
        internal_notes: formData.internal_notes || '',
      };

      await appointmentsAPI.create(payload as any);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Create appointment error:', err?.response?.status, err?.response?.data ?? err);
      setSubmissionError('Nie udało się utworzyć wizyty. Sprawdź dane i spróbuj ponownie.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <Modal title="Dodaj nową wizytę" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="employee-form">
        {loadingInit && <p>Ładowanie danych…</p>}

        <h4 className="form-section-title">Wybór</h4>

        <select name="serviceId" value={formData.serviceId} onChange={handleChange} required>
          <option value="">— wybierz usługę —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          name="employeeId"
          value={formData.employeeId}
          onChange={handleChange}
          required
          disabled={!formData.serviceId}
        >
          <option value="">{!formData.serviceId ? '— najpierw wybierz usługę —' : '— wybierz pracownika —'}</option>
          {filteredEmployees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name}
            </option>
          ))}
        </select>

        {formData.serviceId && filteredEmployees.length === 0 && (
          <p style={{ opacity: 0.8, margin: 0 }}>Brak pracowników przypisanych do tej usługi.</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <input type="date" name="date_from" value={formData.date_from} onChange={handleChange} required />
          <input type="date" name="date_to" value={formData.date_to} onChange={handleChange} required />
        </div>

        {allowIgnoreTimeOff && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <input type="checkbox" name="ignore_timeoff" checked={formData.ignore_timeoff} onChange={handleChange} />
            Pokaż sloty mimo nieobecności (TimeOff)
          </label>
        )}

        <h4 className="form-section-title">Dostępne terminy</h4>

        {loadingSlots && <p>Liczenie dostępności…</p>}

        {!loadingSlots && slots.length === 0 && (
          <p style={{ opacity: 0.8 }}>Brak wolnych terminów w tym zakresie.</p>
        )}

        {!loadingSlots && slots.length > 0 && (
          <div style={{ border: '1px dashed #DDD', borderRadius: 8, padding: 10, maxHeight: 220, overflow: 'auto' }}>
            {slots.map((slot, idx) => (
              <label
                key={`${slot.start}-${idx}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}
              >
                <input
                  type="radio"
                  name="slot"
                  checked={selectedSlotIndex === idx}
                  onChange={() => setSelectedSlotIndex(idx)}
                />
                {formatSlotLabel(slot)}
              </label>
            ))}
          </div>
        )}

        <h4 className="form-section-title">Dodatkowe informacje</h4>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Klient (wymagane)</span>
          <select name="clientId" value={formData.clientId} onChange={handleChange} required>
            <option value="">— wybierz klienta —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.number ? `${c.number} — ` : ''}
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
        </label>

        <textarea
          name="client_notes"
          placeholder="Notatki klienta"
          value={formData.client_notes}
          onChange={handleChange}
          rows={3}
          style={{ marginTop: 10 }}
        />

        <textarea
          name="internal_notes"
          placeholder="Notatki wewnętrzne"
          value={formData.internal_notes}
          onChange={handleChange}
          rows={3}
          style={{ marginTop: 10 }}
        />

        {submissionError && <p className="submission-error">{submissionError}</p>}

        <button type="submit" disabled={loadingSubmit || loadingInit} style={{ marginTop: 20 }}>
          {loadingSubmit ? 'Zapisywanie…' : 'Utwórz wizytę'}
        </button>
      </form>
    </Modal>
  );
};
