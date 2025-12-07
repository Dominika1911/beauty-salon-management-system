// src/pages/Manager/EmployeesManagementPage.tsx (Uproszczona wersja z usePagination)

import React, { useState, useEffect, useMemo, type ReactElement } from 'react';
import { employeesAPI } from '../../api/employees';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { usePagination } from '../../hooks/usePagination'; // 🚨 NOWY IMPORT HOOKA
import type { Employee, PaginatedResponse } from '../../types';

import '../../components/UI/Table/Table.css';

// Używamy tego samego rozmiaru strony co w oryginalnym kodzie
const EMPLOYEES_PAGE_SIZE = 20;

export const EmployeesManagementPage: React.FC = (): ReactElement => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 🚨 ZASTĄPIENIE CAŁEJ LOGIKI PAGINACJI JEDNYM HOOKIEM
  const {
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    setTotalCount,
    handlePreviousPage,
    handleNextPage,
  } = usePagination(EMPLOYEES_PAGE_SIZE); // Wywołanie hooka

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await employeesAPI.list({
          page: currentPage,
          page_size: pageSize,
        });

        const data = response.data as PaginatedResponse<Employee>; // Użycie rzutowania dla bezpieczeństwa

        setEmployees(data.results);
        setTotalCount(data.count); // Aktualizuje hooka i totalPages

        console.log(`Załadowano ${data.results.length} pracowników (strona ${currentPage}/${totalPages})`);
      } catch (err) {
        console.error('Błąd pobierania listy pracowników:', err);
        setError('Nie udało się załadować listy pracowników. Sprawdź backend i uprawnienia.');
      } finally {
        setLoading(false);
      }
    };
    // Zależność tylko od currentPage (logika jest w hooku)
    void fetchEmployees();
  }, [currentPage, pageSize, setTotalCount, totalPages]);

  // Definicja kolumn (bez zmian)
  const columns: ColumnDefinition<Employee>[] = useMemo(() => [
    { header: 'ID', key: 'id', width: '5%' },
    {
      header: 'Imię i Nazwisko',
      key: 'first_name',
      render: (item) => `${item.first_name ?? ''} ${item.last_name ?? ''}` // Zabezpieczenie przed null
    },
    { header: 'Numer', key: 'number', width: '10%' },
    { header: 'Telefon', key: 'phone' },
    {
      header: 'Status',
      key: 'is_active',
      render: (item) => item.is_active ? 'Aktywny' : 'Nieaktywny',
      width: '8%'
    },
    { header: 'Wizyt', key: 'appointments_count', width: '8%' },
    { header: 'Ocena Śr.', key: 'average_rating', width: '8%' },
    {
      header: 'Akcje',
      key: 'actions',
      width: '15%',
      render: (item) => (
        <button onClick={() => console.log('Edycja', item.id)}>Edytuj</button>
      ),
    },
  ], []);

  if (loading && employees.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Zarządzanie Pracownikami</h1>
        <p>Ładowanie listy pracowników...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h1>Zarządzanie Pracownikami</h1>
        <p>Błąd: {error}</p>
      </div>
    );
  }

  return (
    <div className="employees-management-page" style={{ padding: 20 }}>
      <h1>Zarządzanie Pracownikami</h1>
      <p>Lista wszystkich pracowników salonu. (Łącznie: {totalCount})</p>

      <div style={{ marginTop: 20 }}>
        <Table
          data={employees}
          columns={columns}
          loading={loading}
          emptyMessage="Brak pracowników do wyświetlenia."
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