import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { paymentsAPI } from '@/shared/api/payments';
import { Table, type ColumnDefinition } from '@/shared/ui/Table/Table';
import type { PaginatedResponse, Payment } from '@/shared/types';
import {
  beautyButtonDangerStyle,
  beautyButtonSecondaryStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
  beautySelectStyle,
} from '@/shared/utils/ui';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Msg = { type: 'success' | 'error'; text: string };

function extractErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;

    let details = '';
    if (typeof data === 'string') details = data;
    else if (data && typeof data === 'object') {
      try {
        details = JSON.stringify(data);
      } catch {
        details = '[Nie można zserializować treści błędu]';
      }
    } else details = err.message;

    return status ? `HTTP ${status}: ${details}` : `Błąd: ${details}`;
  }
  if (err instanceof Error) return err.message;
  return 'Nieznany błąd.';
}

type PaidFilter = 'all' | 'paid' | 'unpaid';

const PAGE_SIZE = 100;

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function PaymentsPage(): ReactElement {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // UX: filtry intuicyjne
  const [search, setSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [statusSelected, setStatusSelected] = useState<string>(''); // wartość = Payment.status
  const [statusServer, setStatusServer] = useState<string>(''); // serwerowy filtr statusu (opcjonalny)

  const [message, setMessage] = useState<Msg | null>(null);

  const [confirmPaidId, setConfirmPaidId] = useState<number | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const fetchPayments = async (serverStatus?: string): Promise<void> => {
    setLoading(true);
    setMessage(null);
    setConfirmPaidId(null);

    try {
      const res = await paymentsAPI.list({
        page: 1,
        page_size: PAGE_SIZE,
        status: serverStatus && serverStatus.trim().length ? serverStatus.trim() : undefined,
      });

      const data: PaginatedResponse<Payment> = res.data;

      // Bez zgadywania backend ordering -> sort client-side po ID rosnąco
      const sorted = [...data.results].sort((a, b) => a.id - b.id);

      setPayments(sorted);
      setTotalCount(data.count);
    } catch (e: unknown) {
      setPayments([]);
      setTotalCount(0);
      setMessage({ type: 'error', text: `Nie udało się pobrać płatności. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOptions = useMemo(() => {
    // Dropdown statusów z realnych danych (bez zgadywania)
    const uniq = new Map<string, string>(); // status -> label
    for (const p of payments) {
      const key = p.status;
      const label = p.status_display ?? p.status;
      if (!uniq.has(key)) uniq.set(key, label);
    }
    return Array.from(uniq.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pl-PL'));
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const q = normalize(search);

    return payments.filter((p) => {
      // Paid filter (intuicyjne)
      const isPaid = p.paid_at != null || p.status === 'paid';
      if (paidFilter === 'paid' && !isPaid) return false;
      if (paidFilter === 'unpaid' && isPaid) return false;

      // Status dropdown (client-side)
      if (statusSelected && p.status !== statusSelected) return false;

      // Search po polach widocznych w typach, które już wyświetlamy
      if (!q) return true;

      const haystack = [
        String(p.id),
        p.client_name ?? '',
        p.reference ?? '',
        p.method ?? '',
        p.type ?? '',
        String(p.appointment ?? ''),
        p.status_display ?? p.status,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [payments, paidFilter, search, statusSelected]);

  const requestMarkAsPaid = (id: number): void => {
    setMessage(null);
    setConfirmPaidId(id);
  };

  const cancelMarkAsPaid = (): void => {
    setConfirmPaidId(null);
  };

  const doMarkAsPaid = async (id: number): Promise<void> => {
    setMarkingId(id);
    setMessage(null);

    try {
      const res = await paymentsAPI.markAsPaid({ payment: id });
      const updated = res.data.payment;

      setPayments((prev) => {
        const next = prev.map((p) => (p.id === updated.id ? updated : p));
        return next.sort((a, b) => a.id - b.id);
      });

      setConfirmPaidId(null);
      setMessage({ type: 'success', text: res.data.detail || 'Płatność oznaczona jako opłacona.' });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: `Nie udało się oznaczyć jako opłacone. ${extractErrorMessage(e)}` });
    } finally {
      setMarkingId(null);
    }
  };

  const badge = (text: string, kind: 'ok' | 'warn'): ReactElement => (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: '1px solid',
        borderColor: kind === 'ok' ? '#9ad5b3' : '#f2a6b3',
        backgroundColor: kind === 'ok' ? '#e9fff1' : '#fff1f3',
        color: '#5a2a35',
      }}
    >
      {text}
    </span>
  );

  const columns: ColumnDefinition<Payment>[] = useMemo(
    () => [
      {
        header: 'ID',
        key: 'id',
        width: '70px',
        render: (p) => (
          <Link to={`/payments/${p.id}`} style={{ color: '#8b2c3b', textDecoration: 'underline' }}>
            {p.id}
          </Link>
        ),
      },
      {
        header: 'Klient',
        key: 'client_name',
        width: '240px',
        render: (p) => p.client_name ?? '—',
      },
      {
        header: 'Kwota',
        key: 'amount',
        width: '120px',
        render: (p) => `${p.amount} zł`,
      },
      {
        header: 'Status',
        key: 'status',
        width: '160px',
        render: (p) => p.status_display ?? p.status,
      },
      {
        header: 'Opłacono',
        key: 'paid_at',
        width: '170px',
        render: (p) => formatDateTime(p.paid_at),
      },
      {
        header: 'Wizyta start',
        key: 'appointment_start',
        width: '170px',
        render: (p) => formatDateTime(p.appointment_start),
      },
      {
        header: 'Akcje',
        key: 'actions',
        width: '420px',
        render: (p): ReactElement => {
          const isConfirming = confirmPaidId === p.id;
          const isMarking = markingId === p.id;
          const isPaid = p.paid_at != null || p.status === 'paid';

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link
                  to={`/payments/${p.id}`}
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(233, 30, 99, 0.25)',
                    background: '#fff',
                    color: '#2c3e50',
                    textDecoration: 'none',
                    fontWeight: 700,
                  }}
                >
                  Szczegóły
                </Link>

                {isPaid ? (
                  badge('Opłacone', 'ok')
                ) : (
                  <button
                    style={{ ...beautyButtonDangerStyle, padding: '8px 12px' }}
                    onClick={() => requestMarkAsPaid(p.id)}
                    disabled={loading || isMarking}
                  >
                    Oznacz jako opłacone
                  </button>
                )}
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
                  <div style={{ fontWeight: 800 }}>
                    Potwierdź oznaczenie jako opłacone (ID: {p.id})
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      style={{ ...beautyButtonSecondaryStyle, padding: '6px 12px' }}
                      onClick={cancelMarkAsPaid}
                      disabled={isMarking}
                    >
                      Wróć
                    </button>
                    <button
                      style={{ ...beautyButtonDangerStyle, padding: '6px 12px' }}
                      onClick={() => void doMarkAsPaid(p.id)}
                      disabled={isMarking}
                    >
                      {isMarking ? 'Zapisywanie…' : 'Tak, oznacz'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        },
      },
    ],
    [confirmPaidId, markingId, loading]
  );

  const applyServerFilter = async (): Promise<void> => {
    // Serwerowy filtr statusu tylko jeśli user chce (bardziej “twarde” filtrowanie)
    await fetchPayments(statusServer.trim().length ? statusServer.trim() : undefined);
  };

  const clearFilters = (): void => {
    setSearch('');
    setPaidFilter('all');
    setStatusSelected('');
    setStatusServer('');
    setMessage(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Płatności</h1>
          <p style={beautyMutedTextStyle}>
            Łącznie w systemie: {totalCount} • Na ekranie po filtrach: {filteredPayments.length}
          </p>

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
              <span style={{ wordBreak: 'break-word' }}>{message.text}</span>
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
          {/* Filtry - intuicyjne */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 220px 220px 220px',
              gap: 12,
              alignItems: 'end',
              marginBottom: 14,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Szukaj</span>
              <input
                style={beautyInputStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID, klient, referencja, metoda, typ, status..."
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Opłacenie</span>
              <select
                style={beautySelectStyle}
                value={paidFilter}
                onChange={(e) => setPaidFilter(e.target.value as PaidFilter)}
              >
                <option value="all">Wszystkie</option>
                <option value="unpaid">Tylko nieopłacone</option>
                <option value="paid">Tylko opłacone</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Status (z danych)</span>
              <select
                style={beautySelectStyle}
                value={statusSelected}
                onChange={(e) => setStatusSelected(e.target.value)}
              >
                <option value="">Wszystkie</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Status (serwer)</span>
              <input
                style={beautyInputStyle}
                value={statusServer}
                onChange={(e) => setStatusServer(e.target.value)}
                placeholder="np. paid / pending…"
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <button style={beautyButtonSecondaryStyle} onClick={() => void applyServerFilter()} disabled={loading}>
              Odśwież z serwera
            </button>
            <button style={beautyButtonSecondaryStyle} onClick={clearFilters} disabled={loading}>
              Wyczyść filtry
            </button>
            <span style={beautyMutedTextStyle}>
              Tip: „Status (z danych)” jest najwygodniejszy. „Status (serwer)” użyj, gdy chcesz pobrać tylko jeden status.
            </span>
          </div>

          <Table<Payment> data={filteredPayments} columns={columns} loading={loading} emptyMessage="Brak płatności" />
        </div>
      </div>
    </div>
  );
}
