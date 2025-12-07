import React, { useState, useEffect, useMemo, useCallback, type ReactElement } from 'react';
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
  const { user } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  // STAN DLA EDYCJI
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | undefined>(undefined);

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

  const isManager = user?.role === 'manager';

  const fetchEmployees = async (page: number, size: number) => {
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

  const handleCreationSuccess = () => {
      // CZYŚCI STANY PO ZAPISIE
      setEmployeeToEdit(undefined);
      setCurrentPage(1);
      void fetchEmployees(1, pageSize);
      setIsModalOpen(false);
  };

  // FUNKCJA DEZAKTYWACJI (USUWANIA)
  const handleDeactivate = useCallback(async (employeeId: number, currentStatus: boolean) => {

      const newStatus = !currentStatus;
      const confirmMessage = newStatus
          ? "Czy na pewno chcesz aktywować konto tego pracownika?"
          : "Czy na pewno chcesz dezaktywować konto tego pracownika? Nie będzie mógł się zalogować.";

      if (!window.confirm(confirmMessage)) {
          return;
      }

      try {
          // Używamy metody update do zmiany statusu is_active
          await employeesAPI.update(employeeId, { is_active: newStatus });
          // Po sukcesie odświeżamy bieżącą stronę
          void fetchEmployees(currentPage, pageSize);

      } catch (err) {
          console.error("Błąd podczas dezaktywacji pracownika:", err);
          setError("Nie udało się zmienić statusu pracownika.");
      }
  }, [currentPage, pageSize]);


  useEffect(() => {
    void fetchEmployees(currentPage, pageSize);
  }, [currentPage]);

  useEffect(() => {
    void fetchServices();
  }, []);

  // AKTUALIZACJA KOLUMN O EDYCJĘ I DEZAKTYWACJĘ
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
      render: (item) => (
        <span style={{ color: item.is_active ? 'green' : 'red' }}>
           {item.is_active ? 'Aktywny' : 'Nieaktywny'}
        </span>
      ),
      width: '8%'
    },
    { header: 'Wizyt', key: 'appointments_count', width: '8%' },
    { header: 'Ocena Śr.', key: 'average_rating', width: '8%' },
    {
      header: 'Akcje',
      key: 'actions',
      width: '15%',
      render: (item) => (
          <>
            <button
              onClick={() => {
                  setEmployeeToEdit(item); // Ustaw pracownika do edycji
                  setIsModalOpen(true);    // Otwórz modal
              }}
              style={{ marginRight: '5px' }}
            >
              Edytuj
            </button>
            {' | '}
            <button
                onClick={() => void handleDeactivate(item.id, item.is_active)}
                style={{ color: item.is_active ? 'red' : 'green' }}
            >
              {item.is_active ? 'Dezaktywuj' : 'Aktywuj'}
            </button>
          </>
      ),
    },
  ], [handleDeactivate]); // Dodanie handleDeactivate jako zależności

  // ... (reszta kodu bez zmian) ...

  // ... (Kod JSX) ...

  return (
    <div className="employees-management-page" style={{ padding: 20 }}>
      <h1>Zarządzanie Pracownikami</h1>

      {/* WARUNKOWE RENDEROWANIE PRZYCISKU (TYLKO DLA MANAGERA) */}
      {isManager && (
        <div style={{ marginBottom: 20, textAlign: 'right' }}>
          <button
            onClick={() => {
                setEmployeeToEdit(undefined); //W trybie tworzenia upewnij się, że stan edycji jest pusty
                setIsModalOpen(true);
            }}
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

      {/* WARUNKOWE RENDEROWANIE MODALA (TYLKO DLA MANAGERA) */}
      {isManager && (
        <EmployeeFormModal
          isOpen={isModalOpen}
          // W trybie edycji, zamykanie modala musi resetować stan edycji
          onClose={() => {
              setIsModalOpen(false);
              setEmployeeToEdit(undefined);
          }}
          onSuccess={handleCreationSuccess}
          availableServices={availableServices}
          employeeToEdit={employeeToEdit} // PRZEKAZYWANIE OBIEKTU DO EDYCJI
        />
      )}
    </div>
  );
};