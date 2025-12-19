// src/components/Schedule/TimeOffForm.tsx

import React, { useEffect, useState, type ReactElement } from 'react';
import '@/styles/components/ScheduleStyles.css';
import type { TimeOff, TimeOffCreateUpdateData, TimeOffStatus, TimeOffType } from '@/shared/types';
import { scheduleAPI } from '@/shared/api/schedule';
import { Modal } from "@/shared/ui/Modal";
import { useNotification } from "@/shared/ui/Notification";


const getInitialFormData = (employeeId: number, timeOffToEdit?: TimeOff): TimeOffCreateUpdateData => {
  return {
    employee: employeeId,
    date_from: timeOffToEdit?.date_from ?? '',
    date_to: timeOffToEdit?.date_to ?? '',
    type: timeOffToEdit?.type ?? 'vacation',
    reason: timeOffToEdit?.reason ?? '',
    // status ustawiamy tylko jeśli manager edytuje; na create nie musi iść
  };
};

interface TimeOffFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: number;
  isManager: boolean;
  timeOffToEdit?: TimeOff;
}

export const TimeOffForm: React.FC<TimeOffFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
  isManager,
  timeOffToEdit,
}): ReactElement => {
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState<TimeOffCreateUpdateData>(getInitialFormData(employeeId, timeOffToEdit));
  const [status, setStatus] = useState<TimeOffStatus>(timeOffToEdit?.status ?? 'pending');
  const [loading, setLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const isEditing = !!timeOffToEdit;
  const modalTitle = isEditing ? 'Edytuj / Zatwierdź Nieobecność' : 'Zgłoś Nową Nieobecność';

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(employeeId, timeOffToEdit));
      setStatus(timeOffToEdit?.status ?? 'pending');
      setSubmissionError(null);
    }
  }, [isOpen, employeeId, timeOffToEdit]);

  const validateForm = (): boolean => {
    if (!formData.date_from || !formData.date_to) {
      setSubmissionError('Uzupełnij datę od/do.');
      return false;
    }
    if (formData.date_from > formData.date_to) {
      setSubmissionError('Data od nie może być później niż data do.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setSubmissionError(null);

    try {
      if (isEditing) {
        const patch: Partial<TimeOffCreateUpdateData & { status?: TimeOffStatus }> = {
          ...formData,
        };
        if (isManager) patch.status = status;

        await scheduleAPI.updateTimeOff(timeOffToEdit!.id, patch);
        showNotification('Nieobecność zaktualizowana.', 'success');
      } else {
        // Przy tworzeniu zwykle status backend ustawia na "pending"
        await scheduleAPI.createTimeOff(formData);
        showNotification('Nieobecność została zgłoszona do zatwierdzenia.', 'success');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Błąd zapisu nieobecności:', error?.response?.data ?? error);
      setSubmissionError('Nie udało się zapisać nieobecności. Sprawdź dane i logi serwera.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={modalTitle} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ padding: '10px' }}>
        <h4 style={{ marginTop: 0 }}>Termin</h4>

        <label>Od:</label>
        <input
          type="date"
          name="date_from"
          value={formData.date_from}
          onChange={(e) => setFormData(prev => ({ ...prev, date_from: e.target.value }))}
          required
          style={{ display: 'block', marginBottom: '10px' }}
        />

        <label>Do:</label>
        <input
          type="date"
          name="date_to"
          value={formData.date_to}
          onChange={(e) => setFormData(prev => ({ ...prev, date_to: e.target.value }))}
          required
          style={{ display: 'block', marginBottom: '20px' }}
        />

        <h4 style={{ marginTop: 0 }}>Typ</h4>
        <select
          value={formData.type ?? 'vacation'}
          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as TimeOffType }))}
          style={{ display: 'block', marginBottom: '20px' }}
          required
        >
          <option value="vacation">Urlop</option>
          <option value="sick_leave">Chorobowe</option>
          <option value="other">Inne</option>
        </select>

        <h4 style={{ marginTop: 0 }}>Powód</h4>
        <textarea
          name="reason"
          placeholder="Urlop, choroba, szkolenie..."
          value={formData.reason ?? ''}
          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
          rows={3}
          required
          style={{ width: '100%', resize: 'none', marginBottom: '20px' }}
        />

        {isManager && isEditing && (
          <div style={{ borderTop: '1px solid #ccc', padding: '10px 0' }}>
            <h4>Status</h4>
            <select value={status} onChange={(e) => setStatus(e.target.value as TimeOffStatus)}>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
        )}

        {submissionError && <p style={{ color: 'red', marginTop: '10px' }}>{submissionError}</p>}

        <button type="submit" disabled={loading} style={{ marginTop: '20px', width: '100%' }}>
          {loading ? 'Zapisywanie...' : isEditing ? 'Zapisz Zmiany' : 'Zgłoś Nieobecność'}
        </button>
      </form>
    </Modal>
  );
};
