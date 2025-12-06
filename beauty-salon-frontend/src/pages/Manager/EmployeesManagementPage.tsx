// src/pages/Manager/EmployeesManagementPage.tsx

import React, { useState, useEffect, useMemo, type ReactElement } from 'react';
import { employeesAPI } from '../../api/employees';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import type { Employee, PaginatedResponse } from '../../types';

import '../../components/UI/Table/Table.css'; // Wymagany CSS dla tabeli

export const EmployeesManagementPage: React.FC = (): ReactElement => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const response = await employeesAPI.list();
        const data = response.data as PaginatedResponse<Employee> | Employee[];

        // Obsługa Paginacji DRF
        if ('results' in data && Array.isArray(data.results)) {
            setEmployees(data.results);
        } else if (Array.isArray(data)) {
            setEmployees(data);
        } else {
            setEmployees([]);
        }

      } catch (err) {
        console.error("Błąd pobierania listy pracowników:", err);
        setError("Nie udało się załadować listy pracowników. Sprawdź backend i uprawnienia.");
      } finally {
        setLoading(false);
      }
    };
    void fetchEmployees();
  }, []);

  // Definicja kolumn dla tabeli Pracowników
  const columns: ColumnDefinition<Employee>[] = useMemo(() => [
    { header: 'ID', key: 'id', width: '5%' },
    {
      header: 'Imię i Nazwisko',
      key: 'first_name',
      render: (item) => `${item.first_name} ${item.last_name}`
    },
    { header: 'Numer', key: 'number', width: '10%' },
    { header: 'Telefon', key: 'phone' },
    { header: 'Status', key: 'is_active', render: (item) => item.is_active ? 'Aktywny' : 'Nieaktywny', width: '8%' },
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

  if (loading) {
    return <div>Ładowanie listy pracowników...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Błąd: {error}</div>;
  }

  return (
    <div className="employees-management-page">
      <h1>Zarządzanie Pracownikami</h1>
      <p>Lista wszystkich pracowników salonu. (Ilość: {employees.length})</p>

      <div style={{ marginTop: '20px' }}>
        <Table data={employees} columns={columns} emptyMessage="Brak pracowników do wyświetlenia." />
      </div>

    </div>
  );
};