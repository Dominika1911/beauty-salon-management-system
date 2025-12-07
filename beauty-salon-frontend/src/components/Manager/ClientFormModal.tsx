// src/components/Manager/ClientFormModal.tsx

import React, { useState, useEffect, useCallback, type ReactElement } from 'react';
import type { Client, ClientCreateUpdateData } from '../../../types';
import { clientsAPI } from '../../api/clients';
import { Modal } from '../UI/Modal';

import '../Manager/EmployeeForm.css'; // Używamy tych samych stylów

// 🚨 Typ formularza: Używamy ClientCreateUpdateData
type ClientFormData = ClientCreateUpdateData;

// Ustalanie domyślnych danych
const getInitialFormData = (client?: Client): ClientFormData => ({
    first_name: client?.first_name || '',
    last_name: client?.last_name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    marketing_consent: client?.marketing_consent ?? false,
    preferred_contact: client?.preferred_contact || 'email',
    internal_notes: client?.internal_notes || '',
});

interface ClientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    clientToEdit?: Client; // Obiekt do edycji
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({ isOpen, onClose, onSuccess, clientToEdit }): ReactElement => {
    const [formData, setFormData] = useState<ClientFormData>(getInitialFormData(clientToEdit));
    const [loading, setLoading] = useState<boolean>(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);

    const isEditing = !!clientToEdit;
    const modalTitle = isEditing ? "Edytuj Klienta" : "Dodaj Nowego Klienta";

    // 🚨 Resetowanie formularza przy zmianie trybu / otwarciu
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData(clientToEdit));
            setSubmissionError(null);
        }
    }, [isOpen, clientToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox'
                ? (e.target as HTMLInputElement).checked
                : value,
        }));
    };

    const validateForm = useCallback((): boolean => {
        setSubmissionError(null);
        const { first_name, last_name, phone } = formData;

        if (first_name.trim().length < 2) {
            setSubmissionError('Imię musi mieć co najmniej 2 znaki.');
            return false;
        }
        if (last_name.trim().length < 2) {
            setSubmissionError('Nazwisko musi mieć co najmniej 2 znaki.');
            return false;
        }
        if (phone && phone.replace(/\D/g, '').length < 9) {
            setSubmissionError('Numer telefonu musi mieć co najmniej 9 cyfr.');
            return false;
        }

        // Możesz dodać walidację unikalności emaila, jeśli jest wymagana dla nowych klientów

        return true;
    }, [formData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setSubmissionError(null);

        // Przygotowanie danych (usunięcie pustych pól)
        const dataToSend: Partial<ClientCreateUpdateData> = { ...formData };
        if (!dataToSend.email) dataToSend.email = null;
        if (!dataToSend.phone) dataToSend.phone = null;
        if (!dataToSend.internal_notes) delete dataToSend.internal_notes;


        try {
            if (isEditing) {
                // 🚨 LOGIKA EDYCJI (UPDATE)
                const clientId = clientToEdit!.id;
                await clientsAPI.update(clientId, dataToSend);

            } else {
                // LOGIKA TWORZENIA (CREATE)
                await clientsAPI.create(dataToSend as ClientCreateUpdateData);
            }

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Błąd z API:', error.response?.data);
            // ... (tutaj powinna być Twoja logika parsowania błędów DRF)
            setSubmissionError("Nie udało się zapisać klienta. Sprawdź, czy email/telefon nie są już używane.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title={modalTitle} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="employee-form"> {/* Użyj tych samych stylów */}

                {/* DANE KLIENTA */}
                <h4 className="form-section-title">Dane Podstawowe</h4>
                <input type="text" name="first_name" placeholder="Imię" value={formData.first_name} onChange={handleChange} required />
                <input type="text" name="last_name" placeholder="Nazwisko" value={formData.last_name} onChange={handleChange} required />
                <input type="email" name="email" placeholder="Email" value={formData.email || ''} onChange={handleChange} />
                <input type="tel" name="phone" placeholder="Telefon" value={formData.phone || ''} onChange={handleChange} />

                {/* Preferencje i Notatki */}
                <h4 className="form-section-title">Komunikacja i Notatki</h4>
                <select name="preferred_contact" value={formData.preferred_contact} onChange={handleChange}>
                    <option value="email">Preferowany kontakt: Email</option>
                    <option value="sms">Preferowany kontakt: SMS</option>
                    <option value="phone">Preferowany kontakt: Telefon</option>
                    <option value="none">Brak kontaktu</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
                    <input
                        type="checkbox"
                        name="marketing_consent"
                        checked={formData.marketing_consent}
                        onChange={handleChange}
                    />
                    Zgoda marketingowa
                </label>

                <textarea
                    name="internal_notes"
                    placeholder="Wewnętrzne notatki o kliencie (widoczne tylko dla personelu)"
                    value={formData.internal_notes || ''}
                    onChange={handleChange}
                    rows={3}
                    style={{ marginTop: '10px' }}
                />

                {submissionError && <p className="submission-error">{submissionError}</p>}

                <button type="submit" disabled={loading} style={{ marginTop: '20px' }}>
                    {loading ? 'Zapisywanie...' : (isEditing ? 'Zapisz Zmiany' : 'Dodaj Klienta')}
                </button>
            </form>
        </Modal>
    );
};