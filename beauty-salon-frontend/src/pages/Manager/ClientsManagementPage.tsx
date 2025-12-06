import React, {
  useState,
  useEffect,
  useMemo,
  type ReactElement,
} from 'react';
import { clientsAPI } from '../../api/clients';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import type { Client, PaginatedResponse } from '../../types';

import '../../components/UI/Table/Table.css';

export const ClientsManagementPage: React.FC = (): ReactElement => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllClients = async (): Promise<void> => {
      console.log('Pobieram klientów z API...');

      try {
        setLoading(true);
        setError(null);

        const allClients: Client[] = [];

        let response: PaginatedResponse<Client> =
          await clientsAPI.getClients();
        console.log('Pierwsza odpowiedź z API:', response);

        allClients.push(...response.results);
        let nextUrl: string | null = response.next;

        while (nextUrl) {
          const nextResponse = await clientsAPI.getClients(nextUrl);
          console.log('Kolejna strona z API:', nextResponse);
          allClients.push(...nextResponse.results);
          nextUrl = nextResponse.next;
        }

        console.log('Łącznie klientów:', allClients.length);
        setClients(allClients);
      } catch (err) {
        console.error('Błąd pobierania klientów:', err);
        setError('Nie udało się pobrać listy klientów.');
      } finally {
        setLoading(false);
      }
    };

    void fetchAllClients();
  }, []);

  const columns: ColumnDefinition<Client>[] = useMemo(
    () => [
      {
        header: 'ID',
        key: 'id',
        width: '5%',
        render: (client) => client.id,
      },
      {
        header: 'Numer',
        key: 'number',
        width: '10%',
        render: (client) => client.number ?? '-',
      },
      {
        header: 'Imię i nazwisko',
        key: 'first_name',
        render: (client) =>
          `${client.first_name} ${client.last_name}`.trim(),
      },
      {
        header: 'Email',
        key: 'email',
        render: (client) => client.email ?? '—',
      },
      {
        header: 'Telefon',
        key: 'phone',
        render: (client) => client.phone ?? '—',
      },
      {
        header: 'Wizyt',
        key: 'visits_count',
        width: '8%',
        render: (client) => client.visits_count ?? 0,
      },
      {
        header: 'Wydano [PLN]',
        key: 'total_spent_amount',
        width: '10%',
        render: (client) =>
          `${client.total_spent_amount ?? '0.00'} PLN`,
      },
      {
        header: 'Preferowany kontakt',
        key: 'preferred_contact',
        width: '12%',
        render: (client) => client.preferred_contact,
      },
      {
        header: 'Akcje',
        key: 'actions',
        width: '15%',
        render: (client) => (
          <button
            type="button"
            onClick={() => console.log('Edycja klienta', client.id)}
          >
            Edytuj
          </button>
        ),
      },
    ],
    [],
  );

  if (loading) {
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
      <p>Lista wszystkich klientów. (Ilość: {clients.length})</p>

      <div style={{ marginTop: 20 }}>
        <Table
          data={clients}
          columns={columns}
          loading={loading}
          emptyMessage="Brak klientów w bazie danych."
        />
      </div>
    </div>
  );
};
