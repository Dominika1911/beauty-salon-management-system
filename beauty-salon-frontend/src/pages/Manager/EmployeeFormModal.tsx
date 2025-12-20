import React, { useState, useEffect, useCallback, type ReactElement } from 'react';
import type { EmployeeCreateData, Service, Employee } from '@/types';
import { employeesAPI } from '@/api/employees.ts';
import { Modal } from "@/components/Modal.tsx";




// Typ formularza: Obejmuje pola do tworzenia i edycji
interface EmployeeFormData {
    // Pola konta (tylko w trybie tworzenia, stąd opcjonalne)
    email?: string;
    password?: string;

    // Pola pracownika
    first_name: string;
    last_name: string;
    phone: string;
    is_active: boolean;
    hired_at: string;
    skill_ids: number[];
}

// UZUPEŁNIONY INTERFEJS PROPSÓW
interface EmployeeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    availableServices: Service[];
    employeeToEdit?: Employee; // Obiekt do edycji
}

// Ustalanie domyślnych danych
const getInitialFormData = (employee?: Employee): EmployeeFormData => ({
    email: '',
    password: '',
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    phone: employee?.phone || '',

    // Nowe pola dla edycji
    is_active: employee?.is_active ?? true,
    hired_at: employee?.hired_at ? employee.hired_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
    skill_ids: employee?.skills.map((s: Service) => s.id) || [],
});

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({ isOpen, onClose, onSuccess, availableServices, employeeToEdit }): ReactElement => {

    const [formData, setFormData] = useState<EmployeeFormData>(getInitialFormData(employeeToEdit));
    const [loading, setLoading] = useState<boolean>(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);

    // Tryb edycji jest aktywny, gdy obiekt jest przekazany
    const isEditing = !!employeeToEdit;

    // Resetowanie formularza przy zmianie trybu / otwarciu
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData(employeeToEdit));
            setSubmissionError(null); // Czyść błędy
        }
    }, [isOpen, employeeToEdit]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
        const { name, value, type } = e.target;
        setFormData((prev: EmployeeFormData) => ({
            ...prev,
            // Obsługa checkboxów i wartości
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleSkillsChange = (serviceId: number, isChecked: boolean): void => {
        setFormData((prev: EmployeeFormData) => ({
            ...prev,
            skill_ids: isChecked
                ? [...prev.skill_ids, serviceId]
                : prev.skill_ids.filter((id: number) => id !== serviceId),
        }));
    };

    // Używamy useCallback, by uniknąć wielokrotnego tworzenia funkcji
    const validateForm = useCallback((): boolean => {
        setSubmissionError(null);

        const { email, password, first_name, last_name, phone, skill_ids } = formData;

        // W trybie edycji email i hasło nie są wymagane (jeśli nie zmieniane)
        if (!isEditing && (!email || !password)) {
            setSubmissionError('W trybie tworzenia wymagany jest email i hasło.');
            return false;
        }

        // WALIDACJA DŁUGOŚCI (MIN. 3 ZNAKI)
        if (first_name.trim().length < 3) {
            setSubmissionError('Imię musi mieć co najmniej 3 znaki.');
            return false;
        }
        if (last_name.trim().length < 3) {
            setSubmissionError('Nazwisko musi mieć co najmniej 3 znaki.');
            return false;
        }

        // WALIDACJA SKILL_IDS – min. 1 usługa
        if (skill_ids.length === 0) {
            setSubmissionError('Musisz wybrać przynajmniej jedną usługę, którą pracownik wykonuje.');
            return false;
        }

        // ... (Pozostała walidacja (email, telefon) jest już poprawna) ...
        if (email && (email.indexOf('@') === -1 || email.indexOf('.') === -1)) {
            setSubmissionError('Adres e-mail musi zawierać symbol "@" i kropkę "."');
            return false;
        }
        if (phone && phone.replace(/\D/g, '').length < 9) {
            setSubmissionError('Numer telefonu musi mieć co najmniej 9 cyfr.');
            return false;
        }

        return true;
    }, [formData, isEditing]);


    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setSubmissionError(null);

        // Przygotowanie danych (usunięcie pustych pól, które mogłyby zepsuć walidację backendu)
        const dataToSend: Partial<EmployeeCreateData> = { ...formData };

        //  W trybie edycji usuwamy email/password, jeśli nie są podane,
        // ponieważ backend ich nie akceptuje w PATCH
        if (isEditing) {
            if (!dataToSend.email) delete dataToSend.email;
            if (!dataToSend.password) delete dataToSend.password;
        }

        try {
            if (isEditing) {
                // 🚨 LOGIKA EDYCJI (UPDATE)
                const employeeId: number = employeeToEdit!.id;

                // Wysłanie tylko tych pól, które są wymagane przez model Employee w PATCH
                const updateData = {
                    first_name: dataToSend.first_name,
                    last_name: dataToSend.last_name,
                    phone: dataToSend.phone,
                    skill_ids: dataToSend.skill_ids,
                    is_active: dataToSend.is_active,
                    hired_at: dataToSend.hired_at,
                    // Możesz też dodać email/password, jeśli API je akceptuje w PATCH
                } as Partial<Employee>;

                await employeesAPI.update(employeeId, updateData);

            } else {
                // LOGIKA TWORZENIA (CREATE)
                await employeesAPI.create(dataToSend as EmployeeCreateData);
            }

            onSuccess();
            onClose();

        } catch (error: unknown) {
            const err = error as { response?: { data?: Record<string, unknown> } };
            console.error('Błąd z API:', err.response?.data);

            let errorMessage = 'Wystąpił nieznany błąd podczas zapisywania pracownika.';

            // ... (logika parsowania błędów DRF, jak w oryginalnym pliku) ...
            const errorData = err.response?.data;
            if (typeof errorData === 'object' && errorData !== null) {
                const keys: string[] = Object.keys(errorData);
                if (keys.length > 0) {
                    const firstKey: string = keys[0];
                    let errorMsg: unknown = errorData[firstKey];
                    if (Array.isArray(errorMsg)) { errorMsg = errorMsg[0]; }

                    if (firstKey !== 'detail' && firstKey !== 'non_field_errors') {
                         errorMessage = `Błąd w polu "${firstKey.toUpperCase()}": ${errorMsg}`;
                    } else {
                         errorMessage = String(errorMsg);
                    }
                } else if (errorData.detail) {
                    errorMessage = String(errorData.detail);
                }
            }
            // ----------------------------------------------------

            setSubmissionError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title={isEditing ? "Edytuj Pracownika" : "Dodaj Nowego Pracownika"} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="employee-form">

                {/* DANE KONTA - WIDOCZNE TYLKO PRZY TWORZENIU */}
                {!isEditing && (
                    <>
                        <h4 className="form-section-title">Dane Konta</h4>
                        <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required={!isEditing} />
                        <input type="password" name="password" placeholder="Hasło (min. 8 znaków)" value={formData.password} onChange={handleChange} required={!isEditing} />
                    </>
                )}
                {isEditing && (
                    <p style={{marginBottom: 10, fontStyle: 'italic'}}>Edytujesz profil pracownika. Email/Hasło są zarządzane w osobnym widoku.</p>
                )}


                {/* DANE PRACOWNIKA */}
                <h4 className="form-section-title">Dane Pracownika</h4>
                <input type="text" name="first_name" placeholder="Imię" value={formData.first_name} onChange={handleChange} required />
                <input type="text" name="last_name" placeholder="Nazwisko" value={formData.last_name} onChange={handleChange} required />
                <input type="tel" name="phone" placeholder="Telefon" value={formData.phone} onChange={handleChange} />

                {isEditing && (
                    <>
                        <h4 className="form-section-title">Status Konta</h4>
                        <label style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={formData.is_active}
                                onChange={handleChange}
                            />
                            Konto aktywne / Zezwól na logowanie
                        </label>
                         {/* Możesz dodać pole hired_at, jeśli jest potrzebne w edycji */}
                    </>
                )}


                {/* UMIEJĘTNOŚCI (Skills) */}
                <h4 className="form-section-title">Usługi, które wykonuje</h4>
                <div className="skills-container">
                    {availableServices.map((service: Service) => (
                        <label key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                checked={formData.skill_ids.includes(service.id)}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSkillsChange(service.id, e.target.checked)}
                            />
                            {service.name}
                        </label>
                    ))}
                </div>

                {submissionError && <p className="submission-error">{submissionError}</p>}

                <button type="submit" disabled={loading}>
                    {loading ? 'Zapisywanie...' : (isEditing ? 'Zapisz Zmiany' : 'Dodaj Pracownika')}
                </button>
            </form>
        </Modal>
    );
};