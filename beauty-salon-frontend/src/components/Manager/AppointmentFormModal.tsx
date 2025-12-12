// src/components/Manager/AppointmentFormModal.tsx

import React, { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { Employee, Service, Client, AppointmentCreateData } from '../../types';

import { clientsAPI } from '../../api/clients';
import { Modal } from '../UI/Modal';
import { servicesAPI } from '../../api/services';
import { employeesAPI } from '../../api/employees';
import { availabilityAPI, type AvailabilitySlot } from '../../api/availability';
import { appointmentsAPI } from '../../api/appointments';

import '../Manager/EmployeeForm.css';

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;

  /** manager może widzieć sloty mimo TimeOff */
  allowIgnoreTimeOff?: boolean;
}

interface AppointmentFormData {
  serviceId: number | '';
  employeeId: number | '';
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD

  client_number: string; // opcjonalnie (dla managera)
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

const getInitialFormData = (allowIgnoreTimeOff?: boolean): AppointmentFormData => ({
  serviceId: '',
  employeeId: '',
  date_from: todayYMD(),
  date_to: addDaysYMD(7),
  client_number: '',
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
}): ReactElement => {
  const [formData, setFormData] = useState<AppointmentFormData>(getInitialFormData(allowIgnoreTimeOff));

  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // reset przy otwarciu
  useEffect(() => {
    if (!isOpen) return;
    setFormData(getInitialFormData(allowIgnoreTimeOff));
    setSlots([]);
    setSelectedSlotIndex(null);
    setSubmissionError(null);
  }, [isOpen, allowIgnoreTimeOff]);

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
          clientsAPI.list({ page: 1, page_size: 100 }),
        ]);

        setServices(svcRes.data);
        setEmployees(empRes.data);
        setClients((cliRes.data.results ?? []).filter((c) => !!c.number));
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

  // ✅ 1:1 pod Twoje typy: Employee.skills: Service[]
  const filteredEmployees = useMemo(() => {
    if (!formData.serviceId) return [];
    return employees.filter((e) => (e.skills ?? []).some((svc) => svc.id === formData.serviceId));
  }, [employees, formData.serviceId]);

  // ✅ reset pracownika, jeśli zmieniono usługę i obecny pracownik jej nie ma
  useEffect(() => {
    if (!isOpen) return;

    if (!formData.serviceId) {
      if (formData.employeeId !== '') {
        setFormData((prev) => ({ ...prev, employeeId: '' }));
      }
      setSlots([]);
      setSelectedSlotIndex(null);
      return;
    }

    if (
      formData.employeeId &&
      !filteredEmployees.some((e) => e.id === formData.employeeId)
    ) {
      setFormData((prev) => ({ ...prev, employeeId: '' }));
      setSlots([]);
      setSelectedSlotIndex(null);
    }
  }, [isOpen, formData.serviceId, formData.employeeId, filteredEmployees]);

  // fetch slotów po zmianie wyborów
  useEffect(() => {
    if (!isOpen) return;

    if (!formData.employeeId || !formData.serviceId || !formData.date_from || !formData.date_to) {
      setSlots([]);
      setSelectedSlotIndex(null);
      return;
    }

    const fetchSlots = async (): Promise<void> => {
      setLoadingSlots(true);
      setSubmissionError(null);
      setSelectedSlotIndex(null);

      try {
        const res = await availabilityAPI.getSlots({
          employee: formData.employeeId as number,
          service: formData.serviceId as number,
          date_from: formData.date_from,
          date_to: formData.date_to,
          ignore_timeoff: !!(allowIgnoreTimeOff && formData.ignore_timeoff),
        });

        setSlots(res.data.slots ?? []);
      } catch (e) {
        console.error(e);
        setSubmissionError('Nie udało się pobrać wolnych terminów.');
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    void fetchSlots();
  }, [
    isOpen,
    formData.employeeId,
    formData.serviceId,
    formData.date_from,
    formData.date_to,
    formData.ignore_timeoff,
    allowIgnoreTimeOff,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : (name === 'serviceId' || name === 'employeeId')
            ? (value === '' ? '' : Number(value))
            : value,
    }));
  };

  const validateForm = useCallback((): boolean => {
    setSubmissionError(null);

    if (!formData.serviceId) {
      setSubmissionError('Wybierz usługę.');
      return false;
    }
    if (!formData.employeeId) {
      setSubmissionError('Wybierz pracownika.');
      return false;
    }
    if (!formData.date_from || !formData.date_to) {
      setSubmissionError('Wybierz zakres dat.');
      return false;
    }
    if (formData.date_to < formData.date_from) {
      setSubmissionError('Data "do" nie może być wcześniejsza niż "od".');
      return false;
    }
    if (selectedSlotIndex === null) {
      setSubmissionError('Wybierz termin (slot).');
      return false;
    }
    if (!selectedEmployee?.number) {
      setSubmissionError('Brak employee.number (nie da się utworzyć wizyty).');
      return false;
    }
    if (!selectedService?.name) {
      setSubmissionError('Brak service.name (nie da się utworzyć wizyty).');
      return false;
    }

    // dodatkowa asekuracja (UI już filtruje, ale to jeszcze lepiej)
    const ok = (selectedEmployee.skills ?? []).some((s) => s.id === (formData.serviceId as number));
    if (!ok) {
      setSubmissionError('Wybrany pracownik nie ma przypisanej tej usługi.');
      return false;
    }

    return true;
  }, [formData, selectedSlotIndex, selectedEmployee, selectedService]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validateForm()) return;

    const slot = slots[selectedSlotIndex as number];
    if (!slot) {
      setSubmissionError('Wybrany slot nie istnieje (odśwież terminy).');
      return;
    }

    setLoadingSubmit(true);
    setSubmissionError(null);

    try {
      const payload: AppointmentCreateData = {
        employee: selectedEmployee!.number,
        service: selectedService!.name,
        start: slot.start,
        end: slot.end,
        client_notes: formData.client_notes || '',
        internal_notes: formData.internal_notes || '',
      };

      if (formData.client_number.trim().length > 0) {
        payload.client = formData.client_number.trim();
      }

      await appointmentsAPI.create(payload);

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: Record<string, unknown> } };
      console.error('Błąd z API:', err.response?.data);
      setSubmissionError('Nie udało się utworzyć wizyty. Sprawdź dane i spróbuj ponownie.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <Modal title="Dodaj Nową Wizytę" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="employee-form">
        {loadingInit && <p>Ładowanie danych...</p>}

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
          <option value="">
            {!formData.serviceId ? '— najpierw wybierz usługę —' : '— wybierz pracownika —'}
          </option>

          {filteredEmployees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name}
            </option>
          ))}
        </select>

        {formData.serviceId && filteredEmployees.length === 0 && (
          <p style={{ opacity: 0.8, margin: 0 }}>
            Brak pracowników przypisanych do tej usługi.
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="date"
            name="date_from"
            value={formData.date_from}
            onChange={handleChange}
            required
            style={{ flex: 1 }}
          />
          <input
            type="date"
            name="date_to"
            value={formData.date_to}
            onChange={handleChange}
            required
            style={{ flex: 1 }}
          />
        </div>

        {allowIgnoreTimeOff && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <input
              type="checkbox"
              name="ignore_timeoff"
              checked={formData.ignore_timeoff}
              onChange={handleChange}
            />
            Pokaż sloty mimo TimeOff (tylko manager)
          </label>
        )}

        <h4 className="form-section-title">Wolne terminy</h4>

        {loadingSlots && <p>Liczenie dostępności...</p>}

        {!loadingSlots && slots.length === 0 && (
          <p style={{ opacity: 0.8 }}>Brak wolnych terminów w tym zakresie.</p>
        )}

        {!loadingSlots && slots.length > 0 && (
          <div style={{ border: '1px dashed #DDD', borderRadius: 4, padding: 10, background: '#f9f9f9' }}>
            {slots.slice(0, 60).map((slot, idx) => (
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
            {slots.length > 60 && (
              <small style={{ opacity: 0.7 }}>
                Pokazuję pierwsze 60 slotów (zawęź zakres dat, żeby zobaczyć mniej).
              </small>
            )}
          </div>
        )}

        <h4 className="form-section-title">Dodatkowe informacje</h4>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Klient (opcjonalnie)</span>
          <select name="client_number" value={formData.client_number} onChange={handleChange}>
            <option value="">— brak (bez klienta) —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.number ?? ''}>
                {c.number} — {c.first_name} {c.last_name}
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
          style={{ marginTop: '10px' }}
        />

        <textarea
          name="internal_notes"
          placeholder="Notatki wewnętrzne (dla personelu)"
          value={formData.internal_notes}
          onChange={handleChange}
          rows={3}
          style={{ marginTop: '10px' }}
        />

        {submissionError && <p className="submission-error">{submissionError}</p>}

        <button type="submit" disabled={loadingSubmit || loadingInit} style={{ marginTop: '20px' }}>
          {loadingSubmit ? 'Zapisywanie...' : 'Utwórz wizytę'}
        </button>
      </form>
    </Modal>
  );
};
