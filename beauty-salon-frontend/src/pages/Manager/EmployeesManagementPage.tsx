import React, { useState, useEffect, useMemo, type ReactElement } from 'react';
import { employeesAPI } from '../../api/employees';
import { servicesAPI } from '../../api/services';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { EmployeeFormModal } from '../../components/Manager/EmployeeFormModal';
import { usePagination } from '../../hooks/usePagination';
import type { Employee, PaginatedResponse, Service } from '../../types';

import '../../components/UI/Table/Table.css';

import { useAuth } from '../../hooks/useAuth';

const EMPLOYEES_PAGE_SIZE = 20;

export const EmployeesManagementPage: React.FC = (): ReactElement => {
  // POBIERANIE DANYCH UŻYTKOWNIKA
  const { user } = useAuth(); // Zmień na swój hook (useUser lub inny)

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const {
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    setTotalCount,
    setCurrentPage,
    handlePreviousPage,
    handleNextPage,
  } = usePagination(EMPLOYEES_PAGE_SIZE);

  //  WARUNEK: Tylko Manager ma widzieć przycisk i modal
  const isManager = user?.role === 'manager'; // Zmień 'manager' na właściwą wartość roli

  // Funkcje pobierające dane (fetchEmployees, fetchServices, handleCreationSuccess - bez zmian)
  const fetchEmployees = async (page: number, size: number) => {
    // ... (Logika pobierania listy pracowników) ...
    try {
      setLoading(true);
      setError(null);

      const response = await employeesAPI.list({
        page: page,
        page_size: size,
      });

      const data = response.data as PaginatedResponse<Employee>;

      setEmployees(data.results);
      setTotalCount(data.count);

    } catch (err) {
      console.error('Błąd pobierania listy pracowników:', err);
      setError('Nie udało się załadować listy pracowników. Sprawdź backend i uprawnienia.');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
      try {
          const response = await servicesAPI.list({ page_size: 100 });
          setAvailableServices(response.data.results);
      } catch (err) {
          console.error("Błąd ładowania usług:", err);
      }
  };

  useEffect(() => {
    void fetchEmployees(currentPage, pageSize);
  }, [currentPage]);

  useEffect(() => {
    void fetchServices();
  }, []);

const handleCreationSuccess = () => {
    // Ustawiamy na stronę 1, bo lista mogła się zmienić
    setCurrentPage(1);

    // Po chwili pobieramy aktualną listę
    void fetchEmployees(1, pageSize);

    // Zamykamy modal
    setIsModalOpen(false);
};


  // Definicja kolumn (bez zmian)
  const columns: ColumnDefinition<Employee>[] = useMemo(() => [
    { header: 'ID', key: 'id', width: '5%' },
    {
      header: 'Imię i Nazwisko',
      key: 'first_name',
      render: (item) => `${item.first_name ?? ''} ${item.last_name ?? ''}`
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

      {/*  WARUNKOWE RENDEROWANIE PRZYCISKU (TYLKO DLA MANAGERA) */}
      {isManager && (
        <div style={{ marginBottom: 20, textAlign: 'right' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
             Dodaj Nowego Pracownika
          </button>
        </div>
      )}

      <p>Lista wszystkich pracowników salonu. (Łącznie: {totalCount})</p>

      <div style={{ marginTop: 20 }}>
        <Table
          data={employees}
          columns={columns}
          loading={loading}
          emptyMessage="Brak pracowników do wyświetlenia."
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

      {/*  WARUNKOWE RENDEROWANIE MODALA (TYLKO DLA MANAGERA) */}
      {isManager && (
        <EmployeeFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleCreationSuccess}
          availableServices={availableServices}
        />
      )}
    </div>
  );
};