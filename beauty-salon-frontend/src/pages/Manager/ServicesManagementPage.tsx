// src/pages/Manager/ServicesManagementPage.tsx

import React, { useState, useEffect, useMemo, useCallback, type ReactElement } from 'react';
import { servicesAPI } from '../../api/services';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { ServiceFormModal } from '../../components/Manager/ServiceFormModal';
import { usePagination } from '../../hooks/usePagination';
import type { Service, PaginatedResponse } from '../../types';

import '../../components/UI/Table/Table.css';
import { useAuth } from '../../hooks/useAuth';

const SERVICES_PAGE_SIZE = 20;

export const ServicesManagementPage: React.FC = (): ReactElement => {
    // 🚨 ZMIENIONO: Dodano isManager do destruktyryzacji
    const { user, isManager } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [serviceToEdit, setServiceToEdit] = useState<Service | undefined>(undefined);

    const {
        currentPage,
        totalPages,
        totalCount,
        pageSize,
        setTotalCount,
        setCurrentPage,
        handlePreviousPage,
        handleNextPage,
    } = usePagination(SERVICES_PAGE_SIZE);

    // ----------------------------------------------------
    // API CALLS
    // ----------------------------------------------------
    const fetchServices = async (page: number, size: number) => {
        try {
            setLoading(true);
            setError(null);

            const response = await servicesAPI.list({
                page: page,
                page_size: size,
            });

            const data = response.data as PaginatedResponse<Service>;

            setServices(data.results);
            setTotalCount(data.count);

        } catch (err) {
            console.error('Błąd pobierania listy usług:', err, user);
            setError('Nie udało się załadować listy usług. Sprawdź backend i uprawnienia.');
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = () => {
        setServiceToEdit(undefined);
        setCurrentPage(1);
        void fetchServices(1, pageSize);
        setIsModalOpen(false);
    };

    // ----------------------------------------------------
    // ZARZĄDZANIE STATUSEM (OPUBLIKUJ / WYCOFAJ)
    // ----------------------------------------------------
    const handleTogglePublish = useCallback(async (serviceId: number, currentStatus: boolean) => {

        const newStatus = !currentStatus;
        const action = newStatus ? 'Opublikować' : 'Wycofać z publikacji';

        if (!window.confirm(`Czy na pewno chcesz ${action} tę usługę?`)) {
            return;
        }

        try {
            await servicesAPI.update(serviceId, { is_published: newStatus });
            void fetchServices(currentPage, pageSize);

        } catch (err) {
            console.error("Błąd podczas zmiany statusu usługi:", err);
            setError("Nie udało się zmienić statusu publikacji.");
        }
    }, [currentPage, pageSize]);

    // 🚨 DODANO: Funkcja do usunięcia (dla managera)
    const handleDelete = useCallback(async (id: number) => {
        if (!window.confirm('Czy na pewno chcesz usunąć tę usługę? Ta operacja jest nieodwracalna!')) {
            return;
        }
        try {
            await servicesAPI.delete(id);
            void fetchServices(currentPage, pageSize);
        } catch (err) {
            console.error('Błąd usuwania usługi:', err);
            setError("Nie udało się usunąć usługi.");
        }
    }, [currentPage, pageSize]);


    // ----------------------------------------------------
    // LIFECYCLE
    // ----------------------------------------------------
    useEffect(() => {
        void fetchServices(currentPage, pageSize);
    }, [currentPage]);


    // ----------------------------------------------------
    // DEFINICJA KOLUMN
    // ----------------------------------------------------
    // 🚨 ZMIENIONO: Kolumny są teraz warunkowo budowane na podstawie isManager
    const columns: ColumnDefinition<Service>[] = useMemo(() => {
        const baseColumns: ColumnDefinition<Service>[] = [
            { header: 'ID', key: 'id', width: '5%' },
            {
                header: 'Nazwa Usługi',
                key: 'name',
                render: (item) => <strong>{item.name}</strong>,
                width: isManager ? '25%' : '35%' // Szerokość dostosowana
            },
            { header: 'Kategoria', key: 'category', width: '15%' },
            { header: 'Cena', key: 'price', render: (item) => `${parseFloat(item.price).toFixed(2)} PLN`, width: '10%' },
            { header: 'Czas', key: 'duration', render: (item) => item.duration.substring(0, 5), width: '10%' },
            {
                header: 'Status',
                key: 'is_published',
                render: (item) => (
                    <span style={{ color: item.is_published ? 'green' : 'red' }}>
                        {item.is_published ? 'Opublikowana' : 'Wycofana'}
                    </span>
                ),
                width: '12%'
            },
        ];

        if (isManager) {
            baseColumns.push({
                header: 'Akcje',
                key: 'actions',
                width: '13%',
                render: (item) => (
                    <>
                        <button
                          onClick={() => {
                              setServiceToEdit(item);
                              setIsModalOpen(true);
                          }}
                          style={{ marginRight: '5px' }}
                        >
                          Edytuj
                        </button>
                        {' | '}
                        <button
                            onClick={() => void handleTogglePublish(item.id, item.is_published)}
                            style={{ color: item.is_published ? 'red' : 'green' }}
                        >
                          {item.is_published ? 'Wycofaj' : 'Opublikuj'}
                        </button>
                        {' | '}
                        <button
                            onClick={() => void handleDelete(item.id)}
                            style={{ color: 'red' }}
                        >
                          Usuń
                        </button>
                    </>
                ),
            });
        }

        return baseColumns;

    }, [isManager, handleTogglePublish, handleDelete]); // 🚨 DODANO zależności

    // ----------------------------------------------------
    // RENDEROWANIE
    // ----------------------------------------------------
    if (loading && services.length === 0) {
        return (
            <div style={{ padding: 20 }}>
                <h1>Zarządzanie Usługami</h1>
                <p>Ładowanie listy usług...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 20, color: 'red' }}>
                <h1>Zarządzanie Usługami</h1>
                <p>Błąd: {error}</p>
            </div>
        );
    }

    return (
        <div className="services-management-page" style={{ padding: 20 }}>
            <h1>Katalog Usług</h1>

            {/* 🚨 ZMIENIONO: Przycisk widoczny tylko dla Managera */}
            {isManager && (
                <div style={{ marginBottom: 20, textAlign: 'right' }}>
                    <button
                        onClick={() => {
                            setServiceToEdit(undefined);
                            setIsModalOpen(true);
                        }}
                        style={{ padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        Dodaj Nową Usługę
                    </button>
                </div>
            )}

            <p>Lista wszystkich usług. (Łącznie: {totalCount})</p>

            <div style={{ marginTop: 20 }}>
                <Table
                    data={services}
                    columns={columns} // Kolumny są teraz warunkowe
                    loading={loading}
                    emptyMessage="Brak usług do wyświetlenia."
                />
            </div>

            {/* Paginacja */}
            {totalPages > 1 && (
                <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                        style={{ padding: '8px 16px' }}
                    >
                        Poprzednia
                    </button>
                    <span>
                        Strona {currentPage} z {totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        style={{ padding: '8px 16px' }}
                    >
                        Następna
                    </button>
                </div>
            )}

            {/* RENDEROWANIE MODALA USŁUGI (Widoczne tylko dla Managera) */}
            {isManager && (
                <ServiceFormModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setServiceToEdit(undefined);
                    }}
                    onSuccess={handleSuccess}
                    serviceToEdit={serviceToEdit}
                />
            )}
        </div>
    );
};