import React, { useState, useEffect, useMemo, useCallback, type ReactElement } from 'react';
import { clientsAPI } from '../../api/clients';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { ClientFormModal } from '../../components/Manager/ClientFormModal';
import { usePagination } from '../../hooks/usePagination';
import type { Client, PaginatedResponse } from '../../types';

import '../../components/UI/Table/Table.css';
import { useAuth } from '../../hooks/useAuth';

const CLIENTS_PAGE_SIZE: number = 20;

export const ClientsManagementPage: React.FC = (): ReactElement => {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    //  STAN DLA EDYCJI KLIENTA
    const [clientToEdit, setClientToEdit] = useState<Client | undefined>(undefined);

    const {
        currentPage,
        totalPages,
        totalCount,
        pageSize,
        setTotalCount,
        setCurrentPage,
        handlePreviousPage,
        handleNextPage,
    } = usePagination(CLIENTS_PAGE_SIZE);

    const isManager: boolean = user?.role === 'manager';

    const fetchClients = async (page: number, size: number): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const response = await clientsAPI.list({
                page: page,
                page_size: size,
            });

            const data: PaginatedResponse<Client> = response.data as PaginatedResponse<Client>;

            setClients(data.results);
            setTotalCount(data.count);

        } catch (err) {
            console.error('Błąd pobierania listy klientów:', err, user);
            setError('Nie udało się załadować listy klientów. Sprawdź backend i uprawnienia.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreationSuccess = (): void => {
        //  CZYŚCI STANY PO ZAPISIE
        setClientToEdit(undefined);
        setCurrentPage(1);
        void fetchClients(1, pageSize);
        setIsModalOpen(false);
    };

    // FUNKCJA USUWANIA (SOFT DELETE)
    const handleSoftDelete = useCallback(async (clientId: number): Promise<void> => {

        if (!window.confirm("UWAGA GDPR: Czy na pewno chcesz usunąć tego klienta? Spowoduje to Soft Delete w bazie danych.")) {
            return;
        }

        try {
            // Soft Delete klienta za pomocą metody DELETE z API
            await clientsAPI.delete(clientId);

            // Po sukcesie odświeżamy bieżącą stronę
            void fetchClients(currentPage, pageSize);

        } catch (err) {
            console.error("Błąd podczas usuwania klienta:", err);
            setError("Nie udało się usunąć klienta.");
        }
    }, [currentPage, pageSize]);


    useEffect(() => {
        void fetchClients(currentPage, pageSize);
    }, [currentPage]);

    // DEFINICJA KOLUMN Z EDYCJĄ I SOFT DELETE
    const columns: ColumnDefinition<Client>[] = useMemo(() => [
        { header: 'ID', key: 'id', width: '5%' },
        {
            header: 'Klient',
            key: 'first_name',
            render: (item: Client) => `${item.first_name} ${item.last_name}`
        },
        { header: 'Email', key: 'email', render: (item: Client) => item.email ?? '-' },
        { header: 'Telefon', key: 'phone', render: (item: Client) => item.phone ?? '-' },
        { header: 'Wizyt', key: 'visits_count', width: '8%' },
        { header: 'Wydano', key: 'total_spent_amount', width: '10%' },
        {
            header: 'Status',
            key: 'deleted_at',
            render: (item: Client) => (
                <span style={{ color: item.deleted_at ? 'red' : 'green' }}>
                    {item.deleted_at ? 'Usunięty (GDPR)' : 'Aktywny'}
                </span>
            ),
            width: '15%'
        },
        {
            header: 'Akcje',
            key: 'actions',
            width: '15%',
            render: (item: Client) => (
                <>
                    <button
                      onClick={() => {
                          setClientToEdit(item); // 🚨 Ustaw klienta do edycji
                          setIsModalOpen(true);    // Otwórz modal
                      }}
                      style={{ marginRight: '5px' }}
                      disabled={!!item.deleted_at} // Nie edytuj usuniętego
                    >
                      Edytuj
                    </button>
                    {' | '}
                    <button
                        onClick={() => void handleSoftDelete(item.id)}
                        style={{ color: 'red' }}
                        disabled={!!item.deleted_at} // Nie usuwaj już usuniętego
                    >
                      Usuń (GDPR)
                    </button>
                </>
            ),
        },
    ], [handleSoftDelete]);
  const sortedClients: Client[] = useMemo(() => [...clients].sort((a, b) => a.id - b.id), [clients]);

  if (loading && clients.length === 0) {
    return (
            <div style={{ padding: 20 }}>
                <h1>Zarządzanie Klientami</h1>
                <p>Ładowanie listy klientów...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 20, color: 'red' }}>
                <h1>Zarządzanie Klientami</h1>
                <p>Błąd: {error}</p>
            </div>
        );
    }

    return (
        <div className="clients-management-page" style={{ padding: 20 }}>
            <h1>Zarządzanie Klientami</h1>

            {isManager && (
                <div style={{ marginBottom: 20, textAlign: 'right' }}>
                    <button
                        onClick={() => {
                            setClientToEdit(undefined); // W trybie tworzenia, upewnij się, że stan edycji jest pusty
                            setIsModalOpen(true);
                        }}
                        style={{ padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        Dodaj Nowego Klienta
                    </button>
                </div>
            )}

            <p>Lista wszystkich klientów salonu. (Łącznie: {totalCount})</p>

            <div style={{ marginTop: 20 }}>
                <Table
                    data={sortedClients}
                    columns={columns}
                    loading={loading}
                    emptyMessage="Brak klientów do wyświetlenia."
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

            {/* RENDEROWANIE MODALA KLIENTA */}
            {isManager && (
                <ClientFormModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setClientToEdit(undefined);
                    }}
                    onSuccess={handleCreationSuccess}
                    clientToEdit={clientToEdit} // PRZEKAZYWANIE OBIEKTU DO EDYCJI
                />
            )}
        </div>
    );
};