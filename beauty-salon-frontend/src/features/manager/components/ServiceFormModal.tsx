// src/components/Manager/ServiceFormModal.tsx

import React, { useState, useEffect, useCallback, type ReactElement } from 'react';
import type { Service, ServiceCreateUpdateData } from '@/shared/types';
import { servicesAPI } from '@/shared/api/services';
import { Modal } from "@/shared/ui/Modal";


import '@/styles/components/EmployeeForm.css';

// Interfejs dla danych promocji
interface PromotionFormData {
    active: boolean;
    discount_percent: number;
    start_date?: string;
    end_date?: string;
    description?: string;
}

// Funkcja konwertująca obiekt promocji na formularz
const parsePromotion = (promotion: Record<string, any> | string | undefined): PromotionFormData => {
    if (!promotion) {
        return { active: false, discount_percent: 0 };
    }

    let promoObj: Record<string, any>;

    if (typeof promotion === 'string') {
        try {
            promoObj = JSON.parse(promotion);
        } catch {
            return { active: false, discount_percent: 0 };
        }
    } else {
        promoObj = promotion;
    }

    return {
        active: promoObj.active || false,
        discount_percent: promoObj.discount_percent || 0,
        start_date: promoObj.start_date || '',
        end_date: promoObj.end_date || '',
        description: promoObj.description || '',
    };
};

// Ustalanie domyślnych danych na podstawie obiektu Service
const getInitialFormData = (service?: Service): ServiceCreateUpdateData & { promotionData: PromotionFormData } => ({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price ? parseFloat(service.price) : 0,
    duration: service?.duration || '00:30:00',
    category: service?.category || 'Ogólne',
    is_published: service?.is_published ?? true,
    promotion: service?.promotion || {},
    promotionData: parsePromotion(service?.promotion),
});

interface ServiceFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    serviceToEdit?: Service;
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ isOpen, onClose, onSuccess, serviceToEdit }): ReactElement => {

    const [formData, setFormData] = useState<ServiceCreateUpdateData & { promotionData: PromotionFormData }>(getInitialFormData(serviceToEdit));
    const [loading, setLoading] = useState<boolean>(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);

    const isEditing = !!serviceToEdit;
    const modalTitle = isEditing ? "Edytuj Usługę" : "Dodaj Nową Usługę";

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData(serviceToEdit));
            setSubmissionError(null);
        }
    }, [isOpen, serviceToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
        const { name, value, type } = e.target;

        let processedValue: string | number | boolean = value;
        if (type === 'checkbox') {
            processedValue = (e.target as HTMLInputElement).checked;
        } else if (name === 'price') {
            processedValue = parseFloat(value);
        }

        setFormData((prev) => ({
            ...prev,
            [name]: processedValue,
        }));
    };

    // Obsługa zmian w polach promocji
    const handlePromotionChange = (field: keyof PromotionFormData, value: string | number | boolean): void => {
        setFormData((prev) => ({
            ...prev,
            promotionData: {
                ...prev.promotionData,
                [field]: value,
            },
        }));
    };

    const validateForm = useCallback((): boolean => {
        setSubmissionError(null);
        const { name, price, duration, promotionData } = formData;

        if (name.trim().length < 3) {
            setSubmissionError('Nazwa usługi musi mieć co najmniej 3 znaki.');
            return false;
        }
        if (price <= 0 || isNaN(price)) {
            setSubmissionError('Cena musi być większa od zera.');
            return false;
        }
        if (duration === '00:00:00') {
            setSubmissionError('Czas trwania musi być dodatni.');
            return false;
        }

        // Walidacja promocji
        if (promotionData.active) {
            if (promotionData.discount_percent <= 0 || promotionData.discount_percent > 100) {
                setSubmissionError('Zniżka musi być między 1% a 100%.');
                return false;
            }
            if (promotionData.start_date && promotionData.end_date) {
                if (new Date(promotionData.start_date) >= new Date(promotionData.end_date)) {
                    setSubmissionError('Data zakończenia musi być późniejsza niż data rozpoczęcia.');
                    return false;
                }
            }
        }

        return true;
    }, [formData]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setSubmissionError(null);

        try {
            // Konwersja danych promocji do obiektu JSON
            const promotionObj = formData.promotionData.active ? {
                active: formData.promotionData.active,
                discount_percent: formData.promotionData.discount_percent,
                ...(formData.promotionData.start_date && { start_date: formData.promotionData.start_date }),
                ...(formData.promotionData.end_date && { end_date: formData.promotionData.end_date }),
                ...(formData.promotionData.description && { description: formData.promotionData.description }),
            } : {};

            const dataToSend: Partial<ServiceCreateUpdateData> = {
                name: formData.name,
                description: formData.description || undefined,
                price: formData.price,
                duration: formData.duration,
                category: formData.category,
                is_published: formData.is_published,
                promotion: promotionObj,
            };

            if (isEditing) {
                const serviceId: number = serviceToEdit!.id;
                await servicesAPI.update(serviceId, dataToSend);
            } else {
                await servicesAPI.create(dataToSend as ServiceCreateUpdateData);
            }

            onSuccess();
            onClose();

        } catch (error: unknown) {
            const err = error as { response?: { data?: unknown } };
            console.error('Błąd z API:', err.response?.data);
            setSubmissionError("Nie udało się zapisać usługi. Sprawdź poprawność danych.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title={modalTitle} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="employee-form">

                <h4 className="form-section-title">Dane Usługi</h4>
                <input
                    type="text"
                    name="name"
                    placeholder="Nazwa usługi"
                    value={formData.name}
                    onChange={handleChange}
                    required
                />
                <input
                    type="text"
                    name="category"
                    placeholder="Kategoria (np. Fryzjerstwo)"
                    value={formData.category || ''}
                    onChange={handleChange}
                />

                <h4 className="form-section-title">Cena i Czas</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="number"
                        name="price"
                        placeholder="Cena (PLN)"
                        value={formData.price}
                        onChange={handleChange}
                        required
                        step="0.01"
                        min="0"
                        style={{ flex: 1 }}
                    />
                    <input
                        type="text"
                        name="duration"
                        placeholder="Czas trwania (HH:MM:SS)"
                        value={formData.duration}
                        onChange={handleChange}
                        required
                        style={{ flex: 1 }}
                    />
                </div>

                <h4 className="form-section-title">Status</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <input
                        type="checkbox"
                        name="is_published"
                        checked={formData.is_published}
                        onChange={handleChange}
                    />
                    Opublikowana (widoczna dla klientów w rezerwacji online)
                </label>

                <h4 className="form-section-title">Opis</h4>
                <textarea
                    name="description"
                    placeholder="Krótki opis usługi"
                    value={formData.description || ''}
                    onChange={handleChange}
                    rows={3}
                    style={{ marginTop: '10px' }}
                />

                {/* SEKCJA PROMOCJI - USER FRIENDLY */}
                <h4 className="form-section-title">📢 Promocja</h4>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <input
                        type="checkbox"
                        checked={formData.promotionData.active}
                        onChange={(e) => handlePromotionChange('active', e.target.checked)}
                    />
                    <strong>Aktywuj promocję dla tej usługi</strong>
                </label>

                {formData.promotionData.active && (
                    <div style={{
                        padding: '15px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        marginBottom: '15px'
                    }}>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Zniżka (%)
                            </label>
                            <input
                                type="number"
                                placeholder="np. 10, 20, 50"
                                value={formData.promotionData.discount_percent}
                                onChange={(e) => handlePromotionChange('discount_percent', parseFloat(e.target.value) || 0)}
                                min="0"
                                max="100"
                                step="1"
                                style={{ width: '100%' }}
                            />
                            <small style={{ color: '#666', fontSize: '12px' }}>
                                Klient zapłaci: {(formData.price * (1 - formData.promotionData.discount_percent / 100)).toFixed(2)} PLN
                            </small>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Data rozpoczęcia (opcjonalnie)
                            </label>
                            <input
                                type="date"
                                value={formData.promotionData.start_date || ''}
                                onChange={(e) => handlePromotionChange('start_date', e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Data zakończenia (opcjonalnie)
                            </label>
                            <input
                                type="date"
                                value={formData.promotionData.end_date || ''}
                                onChange={(e) => handlePromotionChange('end_date', e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Opis promocji (opcjonalnie)
                            </label>
                            <textarea
                                placeholder="np. Promocja świąteczna, Rabat dla nowych klientów"
                                value={formData.promotionData.description || ''}
                                onChange={(e) => handlePromotionChange('description', e.target.value)}
                                rows={2}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                )}

                {submissionError && <p className="submission-error">{submissionError}</p>}

                <button type="submit" disabled={loading} style={{ marginTop: '20px' }}>
                    {loading ? 'Zapisywanie...' : (isEditing ? 'Zapisz Zmiany Usługi' : 'Dodaj Usługę')}
                </button>
            </form>
        </Modal>
    );
};