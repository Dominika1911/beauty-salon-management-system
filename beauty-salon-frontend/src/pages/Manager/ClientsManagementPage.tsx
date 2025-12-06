// src/pages/Manager/ClientsManagementPage.tsx
// To jest plik, który musi zostać utworzony.

import React, { useState, useEffect, useMemo, type ReactElement } from 'react';
import { clientsAPI } from '../../api/clients'; // Używa zdefiniowanego API
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table'; // Używa uniwersalnej Tabeli
import type { Client } from '../../types'; // Używa typu Client z index.ts

export const ClientsManagementPage: React.FC = (): ReactElement => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        // Pobieranie listy klientów
        const response = await clientsAPI.list();

        // Zwracamy pole data, które zawiera listę klientów
        setClients(response.data);
      } catch (err) {
        console.error("Błąd pobierania listy klientów:", err);
        setError("Nie udało się załadować listy klientów.");
      } finally {
        setLoading(false);
      }
    };
    void fetchClients();
  }, []);

  // Definicja kolumn dla tabeli
  const columns: ColumnDefinition<Client>[] = useMemo(() => [
    { header: 'ID', key: 'id', width: '5%' },
    { header: 'Imię i Nazwisko', key: 'full_name' },
    { header: 'Email', key: 'email' },
    { header: 'Telefon', key: 'phone' },
    { header: 'Wizyt', key: 'visits_count', width: '8%' },
    { header: 'Wydano', key: 'total_spent_amount', render: (item) => `${item.total_spent_amount} PLN` },
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
    return <div>Ładowanie listy klientów...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Błąd: {error}</div>;
  }

  return (
    <div className="clients-management-page">
      <h1>Zarządzanie Klientami</h1>
      <p>Lista wszystkich zarejestrowanych klientów salonu. (Ilość: {clients.length})</p>

      <div style={{ marginTop: '20px' }}>
        <Table data={clients} columns={columns} />
      </div>

    </div>
  );
};