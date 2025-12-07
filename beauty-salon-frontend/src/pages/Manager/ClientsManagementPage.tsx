// src/pages/Manager/ClientsManagementPage.tsx (Uproszczona wersja z usePagination)

import React, { useState, useEffect, useMemo, type ReactElement } from 'react';
import { clientsAPI } from '../../api/clients';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { usePagination } from '../../hooks/usePagination'; // 🚨 NOWY IMPORT HOOKA
import type { Client, PaginatedResponse } from '../../types';

import '../../components/UI/Table/Table.css';

// Używamy globalnego ustawienia lub ustalamy na 20, jak w poprzedniej wersji
const CLIENTS_PAGE_SIZE = 20;

export const ClientsManagementPage: React.FC = (): ReactElement => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 🚨 ZASTĄPIENIE CAŁEJ LOGIKI PAGINACJI JEDNYM HOOKIEM
  const {
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    setTotalCount, // Potrzebny do aktualizacji z API
    handlePreviousPage,
    handleNextPage,
  } = usePagination(CLIENTS_PAGE_SIZE);

  useEffect(() => {
    const fetchClients = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const response = await clientsAPI.list({
          page: currentPage,
          page_size: pageSize,
        });

        const data = response.data as PaginatedResponse<Client>;

        setClients(data.results);
        setTotalCount(data.count); // Aktualizuje hooka i triggeruje przeliczenie totalPages

        console.log(`Załadowano ${data.results.length} klientów (strona ${currentPage}/${totalPages})`);
      } catch (err) {
        console.error('Błąd pobierania klientów:', err);
        setError('Nie udało się pobrać listy klientów.');
      } finally {
        setLoading(false);
      }
    };

    void fetchClients();
  }, [currentPage, pageSize, setTotalCount, totalPages]); // totalPages i setTotalCount dodane dla czystości kodu

  // ... Definicja kolumn (pozostaje bez zmian) ...
  const columns: ColumnDefinition<Client>[] = useMemo(
    () => [
      { header: 'ID', key: 'id', width: '5%', render: (client) => client.id },
      { header: 'Numer', key: 'number', width: '10%', render: (client) => client.number ?? '-' },
      { header: 'Imię i nazwisko', key: 'first_name', render: (client) => `${client.first_name} ${client.last_name}`.trim() },
      { header: 'Email', key: 'email', render: (client) => client.email ?? '—' },
      { header: 'Telefon', key: 'phone', render: (client) => client.phone ?? '—' },
      { header: 'Wizyt', key: 'visits_count', width: '8%', render: (client) => client.visits_count ?? 0 },
      { header: 'Wydano [PLN]', key: 'total_spent_amount', width: '10%', render: (client) => `${client.total_spent_amount ?? '0.00'} PLN` },
      { header: 'Preferowany kontakt', key: 'preferred_contact', width: '12%', render: (client) => client.preferred_contact },
      { header: 'Akcje', key: 'actions', width: '15%', render: (client) => (
          <button type="button" onClick={() => console.log('Edycja klienta', client.id)}>Edytuj</button>
        ),
      },
    ],
    [],
  );
  // ... koniec definicji kolumn ...


  if (loading && clients.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Klienci</h1>
        <p>Ładowanie listy klientów…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Klienci</h1>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Klienci</h1>
      <p>Lista wszystkich klientów. (Łącznie: {totalCount})</p>

      <div style={{ marginTop: 20 }}>
        <Table
          data={clients}
          columns={columns}
          loading={loading}
          emptyMessage="Brak klientów w bazie danych."
        />
      </div>

      {/* Paginacja (używa wartości zwróconych z hooka) */}
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
    </div>
  );
};