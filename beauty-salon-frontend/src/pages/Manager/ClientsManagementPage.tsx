import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { clientsAPI } from '@/api/clients.ts';
import { Table, type ColumnDefinition } from '@/components/Table.tsx';
import { ClientFormModal } from '@/pages/Manager/ClientFormModal.tsx';
import type { Client, PaginatedResponse } from '@/types';
import { formatPhonePL } from '@/utils/formatters.ts';

import { useAuth } from '@/hooks/useAuth.ts';
import {
  beautyButtonDangerStyle,
  beautyButtonSecondaryStyle,
  beautyButtonStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
} from '@/utils/ui.ts';

const CLIENTS_PAGE_SIZE = 20;

type Msg = { type: 'success' | 'error'; text: string };

export function ClientsManagementPage(): ReactElement {
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | undefined>(undefined);

  const [message, setMessage] = useState<Msg | null>(null);

  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const fetchClients = async (): Promise<void> => {
    setLoading(true);
    setMessage(null);
    setConfirmDeleteId(null);

    try {
      if (showDeleted) {
        const res = await clientsAPI.softDeleted({
          search: search.trim().length ? search.trim() : undefined,
        });
        const sorted = [...res.data].sort((a, b) => a.id - b.id);
        setClients(sorted);
        setTotalCount(sorted.length);
      } else {
        const res = await clientsAPI.list({
          page: 1,
          page_size: CLIENTS_PAGE_SIZE,
          search: search.trim().length ? search.trim() : undefined,
        });
        const data: PaginatedResponse<Client> = res.data;
        const sorted = [...data.results].sort((a, b) => a.id - b.id);
        setClients(sorted);
        setTotalCount(data.count);
      }
    } catch {
      setClients([]);
      setTotalCount(0);
      setMessage({ type: 'error', text: 'Nie udało się pobrać listy klientów.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted]);

  const requestSoftDelete = (id: number): void => {
    setMessage(null);
    setConfirmDeleteId(id);
  };

  const cancelSoftDelete = (): void => {
    setConfirmDeleteId(null);
  };

  const doSoftDelete = async (id: number): Promise<void> => {
    setDeletingId(id);
    setMessage(null);
    try {
      await clientsAPI.softDelete(id);
      setMessage({ type: 'success', text: 'Klient został oznaczony jako usunięty (soft delete).' });
      setConfirmDeleteId(null);
      await fetchClients();
    } catch {
      setMessage({ type: 'error', text: 'Nie udało się usunąć klienta (soft delete).' });
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnDefinition<Client>[] = useMemo(
    () => [
      { header: 'ID', key: 'id', width: '60px' },
      {
        header: 'Imię',
        key: 'first_name',
        width: '140px',
        render: (c) => (
          <Link to={`/clients/${c.id}`} style={{ color: '#8b2c3b', textDecoration: 'underline' }}>
            {c.first_name}
          </Link>
        ),
      },
      {
        header: 'Nazwisko',
        key: 'last_name',
        width: '160px',
        render: (c) => (
          <Link to={`/clients/${c.id}`} style={{ color: '#8b2c3b', textDecoration: 'underline' }}>
            {c.last_name}
          </Link>
        ),
      },
      { header: 'Email', key: 'email', width: '260px' },
      {
        header: 'Telefon',
        key: 'phone',
        width: '160px',
        render: (c) => formatPhonePL(c.phone),
      },
      {
        header: 'Wizyty',
        key: 'visits_count',
        width: '80px',
        render: (c) => c.visits_count,
      },
      {
        header: 'Suma',
        key: 'total_spent_amount',
        width: '120px',
        render: (c) => `${c.total_spent_amount} zł`,
      },
      {
        header: 'Status',
        key: 'deleted_at',
        width: '110px',
        render: (c) => (c.deleted_at ? 'Usunięty' : 'Aktywny'),
      },
      {
        header: 'Akcje',
        key: 'actions',
        width: '360px',
        render: (c): ReactElement => {
          const isConfirming = confirmDeleteId === c.id;
          const isDeleting = deletingId === c.id;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, whiteSpace: 'nowrap', flexWrap: 'wrap' }}>
                <button
                  style={{ ...beautyButtonSecondaryStyle, padding: '6px 12px' }}
                  onClick={() => {
                    setClientToEdit(c);
                    setIsModalOpen(true);
                  }}
                  disabled={loading}
                >
                  Edytuj
                </button>

                <button
                  style={{ ...beautyButtonSecondaryStyle, padding: '6px 12px' }}
                  onClick={() => navigate(`/clients/${c.id}`)}
                  disabled={loading}
                >
                  Szczegóły
                </button>

                {!c.deleted_at ? (
                  <button
                    style={{ ...beautyButtonDangerStyle, padding: '6px 12px' }}
                    onClick={() => requestSoftDelete(c.id)}
                    disabled={loading || isDeleting}
                  >
                    Usuń
                  </button>
                ) : null}
              </div>

              {isConfirming ? (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid #e6a1ad',
                    backgroundColor: '#ffe6ec',
                    color: '#5a2a35',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    Potwierdź soft delete klienta: {c.first_name} {c.last_name}
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      style={{ ...beautyButtonSecondaryStyle, padding: '6px 12px' }}
                      onClick={cancelSoftDelete}
                      disabled={isDeleting}
                    >
                      Wróć
                    </button>
                    <button
                      style={{ ...beautyButtonDangerStyle, padding: '6px 12px' }}
                      onClick={() => void doSoftDelete(c.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Usuwanie…' : 'Tak, usuń'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        },
      },
    ],
    [confirmDeleteId, deletingId, loading, navigate]
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Klienci</h1>
          <p style={beautyMutedTextStyle}>Łącznie: {totalCount}</p>

          {message ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                border: '1px solid',
                borderColor: message.type === 'success' ? '#9ad5b3' : '#f2a6b3',
                backgroundColor: message.type === 'success' ? '#e9fff1' : '#fff1f3',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span>{message.text}</span>
              <button
                style={{ ...beautyButtonSecondaryStyle, padding: '6px 10px' }}
                onClick={() => setMessage(null)}
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>

        <div style={beautyCardBodyStyle}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <input
              style={{ ...beautyInputStyle, width: 320 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj (imię, nazwisko, email, tel...)"
            />

            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
              <span>Pokaż usuniętych</span>
            </label>

            <button style={beautyButtonSecondaryStyle} onClick={() => void fetchClients()} disabled={loading}>
              Szukaj / Odśwież
            </button>

            {isManager ? (
              <button
                style={beautyButtonStyle}
                onClick={() => {
                  setClientToEdit(undefined);
                  setIsModalOpen(true);
                }}
              >
                Dodaj klienta
              </button>
            ) : null}
          </div>

          <Table<Client> data={clients} columns={columns} loading={loading} emptyMessage="Brak klientów" />

          {isManager ? (
            <ClientFormModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSuccess={fetchClients}
              clientToEdit={clientToEdit}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
