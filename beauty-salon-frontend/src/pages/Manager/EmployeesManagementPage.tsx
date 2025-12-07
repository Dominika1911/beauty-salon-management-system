import React, { useState, useEffect, useMemo, useCallback, type ReactElement } from 'react';
import { employeesAPI } from '../../api/employees';
import { servicesAPI } from '../../api/services';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import { EmployeeFormModal } from '../../components/Manager/EmployeeFormModal';
import { usePagination } from '../../hooks/usePagination';
import type { Employee, PaginatedResponse, Service } from '../../types';

import '../../components/UI/Table/Table.css';
import { useAuth } from '../../hooks/useAuth';

const EMPLOYEES_PAGE_SIZE: number = 20;

export const EmployeesManagementPage: React.FC = (): ReactElement => {
  const { user } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
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

  const isManager: boolean = user?.role === 'manager';

  const fetchEmployees = useCallback(async (page: number, size: number): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await employeesAPI.list({
        page: page,
        page_size: size,
      });

      const data: PaginatedResponse<Employee> = response.data as PaginatedResponse<Employee>;

      setEmployees(data.results);
      setTotalCount(data.count);

    } catch (err) {
      console.error('Błąd pobierania listy pracowników:', err);
      setError('Nie udało się załadować listy pracowników. Sprawdź backend i uprawnienia.');
    } finally {
      setLoading(false);
    }
  }, [setTotalCount]);

  const fetchServices = useCallback(async (): Promise<void> => {
      try {
          const response = await servicesAPI.list({ page_size: 100 });
          setAvailableServices(response.data.results);
      } catch (err) {
          console.error("Błąd ładowania usług:", err);
      }
  }, []);

  const handleCreationSuccess = useCallback((): void => {
      setEmployeeToEdit(undefined);
      setCurrentPage(1);
      void fetchEmployees(1, pageSize);
      setIsModalOpen(false);
  }, [fetchEmployees, pageSize, setCurrentPage]);

  const handleDeactivate = useCallback(async (employeeId: number, currentStatus: boolean): Promise<void> => {
      const newStatus: boolean = !currentStatus;
      const confirmMessage: string = newStatus
          ? "Czy na pewno chcesz aktywować konto tego pracownika?"
          : "Czy na pewno chcesz dezaktywować konto tego pracownika? Nie będzie mógł się zalogować.";

      if (!window.confirm(confirmMessage)) {
          return;
      }

      try {
          await employeesAPI.update(employeeId, { is_active: newStatus });
          void fetchEmployees(currentPage, pageSize);
      } catch (err) {
          console.error("Błąd podczas dezaktywacji pracownika:", err);
          setError("Nie udało się zmienić statusu pracownika.");
      }
  }, [currentPage, pageSize, fetchEmployees]);

  useEffect(() => {
    void fetchEmployees(currentPage, pageSize);
  }, [currentPage, pageSize, fetchEmployees]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const columns: ColumnDefinition<Employee>[] = useMemo(() => [
    { header: 'ID', key: 'id', width: '5%' },
    {
      header: 'Imię i Nazwisko',
      key: 'first_name',
      render: (item: Employee) => `${item.first_name ?? ''} ${item.last_name ?? ''}`
    },
    { header: 'Numer', key: 'number', width: '10%' },
    { header: 'Telefon', key: 'phone' },
    {
      header: 'Status',
      key: 'is_active',
      render: (item: Employee) => (
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
      render: (item: Employee) => (
          <>
            <button
              onClick={() => {
                  setEmployeeToEdit(item);
                  setIsModalOpen(true);
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
  ], [handleDeactivate]);

  if (loading && employees.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Zarządzanie Pracownikami</h1>
        <p>Ładowanie listy pracowników...</p>
      </div>
    );
  }

  return (
    <div className="employees-management-page" style={{ padding: 20 }}>
      <h1>Zarządzanie Pracownikami</h1>

      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          border: '1px solid #ef5350'
        }}>
          <strong>Błąd:</strong> {error}
        </div>
      )}

      {isManager && (
        <div style={{ marginBottom: 20, textAlign: 'right' }}>
          <button
            onClick={() => {
                setEmployeeToEdit(undefined);
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

      {isManager && (
        <EmployeeFormModal
          isOpen={isModalOpen}
          onClose={() => {
              setIsModalOpen(false);
              setEmployeeToEdit(undefined);
          }}
          onSuccess={handleCreationSuccess}
          availableServices={availableServices}
          employeeToEdit={employeeToEdit}
        />
      )}
    </div>
  );
};