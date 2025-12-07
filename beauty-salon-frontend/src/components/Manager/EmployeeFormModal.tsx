// src/components/Manager/EmployeeFormModal.tsx

import React, { useState, type ReactElement } from 'react';
import type { EmployeeCreateData, Service } from '../../../types';
import { employeesAPI } from '../../api/employees';
import { Modal } from '../UI/Modal';

import './EmployeeForm.css'; // 🚨 IMPORTUJEMY STYLE FORMULARZA

// Dane początkowe formularza (Bez zmian)
const initialFormData: EmployeeCreateData = {
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    skill_ids: [],
};

interface EmployeeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    availableServices: Service[];
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({ isOpen, onClose, onSuccess, availableServices }): ReactElement => {
    const [formData, setFormData] = useState<EmployeeCreateData>(initialFormData);
    const [loading, setLoading] = useState<boolean>(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleSkillsChange = (serviceId: number, isChecked: boolean) => {
        setFormData(prev => ({
            ...prev,
            skill_ids: isChecked
                ? [...prev.skill_ids, serviceId]
                : prev.skill_ids.filter(id => id !== serviceId),
        }));
    };

  const validateForm = (): boolean => {
    setSubmissionError(null);

    const { email, password, first_name, last_name, phone, skill_ids } = formData;

    // WALIDACJA DŁUGOŚCI (MIN. 3 ZNAKI)
    if (first_name.trim().length < 3) {
        setSubmissionError('Imię musi mieć co najmniej 3 znaki.');
        return false;
    }
    if (last_name.trim().length < 3) {
        setSubmissionError('Nazwisko musi mieć co najmniej 3 znaki.');
        return false;
    }

    // WALIDACJA FORMATU E-MAIL
    if (email && (email.indexOf('@') === -1 || email.indexOf('.') === -1)) {
        setSubmissionError('Adres e-mail musi zawierać symbol "@" i kropkę "."');
        return false;
    }

    // WALIDACJA TELEFONU (MIN. 9 CYFR)
    if (phone && phone.replace(/\D/g, '').length < 9) {
        setSubmissionError('Numer telefonu musi mieć co najmniej 9 cyfr.');
        return false;
    }

    // WALIDACJA SKILL_IDS – min. 1 usługa
    if (skill_ids.length === 0) {
        setSubmissionError('Musisz wybrać przynajmniej jedną usługę, którą pracownik wykonuje.');
        return false;
    }

    return true;
};


  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setLoading(true);

            // 🚨 JEDNOKROKOWA WYSYŁKA - DZIĘKI NAPRAWIE BACKENDU
            await employeesAPI.create(formData);

            setLoading(false);
            setFormData(initialFormData);
            onSuccess();
            onClose();

        } catch (error: any) {
            setLoading(false);

            console.error('Pełna odpowiedź błędu z API:', error.response?.data);

            let errorMessage = 'Wystąpił nieznany błąd podczas tworzenia pracownika.';

            const errorData = error.response?.data;

            // Obsługa typowego formatu błędów walidacji DRF
            if (typeof errorData === 'object' && errorData !== null) {
                const keys = Object.keys(errorData);

                if (keys.length > 0) {
                    const firstKey = keys[0];
                    let errorMsg = errorData[firstKey];

                    if (Array.isArray(errorMsg)) {
                        errorMsg = errorMsg[0];
                    }

                    if (firstKey !== 'detail' && firstKey !== 'non_field_errors') {
                         errorMessage = `Błąd w polu "${firstKey.toUpperCase()}": ${errorMsg}`;
                    } else {
                         errorMessage = errorMsg;
                    }
                } else if (errorData.detail) {
                    errorMessage = errorData.detail;
                }
            }

            setSubmissionError(errorMessage);
        }
    };
    // ... (Koniec funkcji) ...

    return (
        <Modal title="Dodaj Nowego Pracownika" isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="employee-form">

                {/* DANE KONTA */}
                <h4 className="form-section-title">Dane Konta</h4>
                <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
                <input type="password" name="password" placeholder="Hasło (min. 8 znaków)" value={formData.password} onChange={handleChange} required />

                {/* DANE PRACOWNIKA */}
                <h4 className="form-section-title">Dane Pracownika</h4>
                <input type="text" name="first_name" placeholder="Imię" value={formData.first_name} onChange={handleChange} required />
                <input type="text" name="last_name" placeholder="Nazwisko" value={formData.last_name} onChange={handleChange} required />
                <input type="tel" name="phone" placeholder="Telefon" value={formData.phone} onChange={handleChange} />

                {/* UMIEJĘTNOŚCI (Skills) */}
                <h4 className="form-section-title">Usługi, które wykonuje</h4>
                <div className="skills-container">
                    {availableServices.map(service => (
                        <label key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                checked={formData.skill_ids.includes(service.id)}
                                onChange={(e) => handleSkillsChange(service.id, e.target.checked)}
                            />
                            {service.name}
                        </label>
                    ))}
                </div>

                {submissionError && <p className="submission-error">{submissionError}</p>}

                <button type="submit" disabled={loading}>
                    {loading ? 'Zapisywanie...' : 'Dodaj Pracownika'}
                </button>
            </form>
        </Modal>
    );
};