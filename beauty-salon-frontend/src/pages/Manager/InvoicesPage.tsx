import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { invoicesAPI } from '@/shared/api/invoices';
import type { Invoice, PaginatedResponse } from '@/shared/types';
import {
  beautyCardStyle,
  beautyCardHeaderStyle,
  beautyCardBodyStyle,
  beautyPageTitleStyle,
  beautyButtonSecondaryStyle,
  beautyInputStyle,
  beautyMutedTextStyle,
  beautySelectStyle,
} from '@/shared/utils/ui';

type Msg = { type: 'success' | 'error'; text: string };
type PaidFilter = 'all' | 'paid' | 'unpaid';


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

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

const PAGE_SIZE = 100;

export function InvoicesPage(): ReactElement {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Msg | null>(null);

  // UX filtry
  const [search, setSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');

  // server fetch
  const fetchInvoices = async (paid: PaidFilter): Promise<void> => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await invoicesAPI.list({
        page: 1,
        page_size: PAGE_SIZE,
        is_paid: paid === 'all' ? undefined : paid === 'paid',
        ordering: 'id',
      });

      const data = res.data as PaginatedResponse<Invoice>;
      const sorted = [...data.results].sort((a, b) => a.id - b.id);

      setInvoices(sorted);
    } catch (e: unknown) {
      setInvoices([]);
      setMessage({ type: 'error', text: `Nie udało się pobrać faktur. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInvoices(paidFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return invoices;

    return invoices.filter((inv) => {
      const hay = [
        String(inv.id),
        inv.number,
        inv.client_name,
        inv.gross_amount,
        inv.net_amount,
        inv.vat_amount,
        inv.vat_rate,
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  }, [invoices, search]);

  const badge = (text: string, kind: 'ok' | 'warn'): ReactElement => (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        border: '1px solid',
        borderColor: kind === 'ok' ? '#9ad5b3' : '#f2a6b3',
        backgroundColor: kind === 'ok' ? '#e9fff1' : '#fff1f3',
        color: '#5a2a35',
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ padding: 30 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Faktury</h1>
          <p style={beautyMutedTextStyle}>
            Na ekranie: {filtered.length} • (pobrane: {invoices.length})
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
          {/* FILTRY */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 240px 220px',
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
                placeholder="ID, numer, klient, kwoty…"
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
                <option value="unpaid">Nieopłacone</option>
                <option value="paid">Opłacone</option>
              </select>
            </label>

            <button
              style={beautyButtonSecondaryStyle}
              onClick={() => void fetchInvoices(paidFilter)}
              disabled={loading}
            >
              Odśwież z serwera
            </button>
          </div>

          {/* TABELA */}
          {loading ? (
            <p>Ładowanie…</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>ID</th>
                  <th style={{ padding: '10px 8px' }}>Numer</th>
                  <th style={{ padding: '10px 8px' }}>Klient</th>
                  <th style={{ padding: '10px 8px' }}>Brutto</th>
                  <th style={{ padding: '10px 8px' }}>Opłacenie</th>
                  <th style={{ padding: '10px 8px' }}>PDF</th>
                  <th style={{ padding: '10px 8px' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} style={{ borderTop: '1px solid #f1c6d0' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <Link to={`/invoices/${inv.id}`} style={{ color: '#8b2c3b', textDecoration: 'underline' }}>
                        {inv.id}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{inv.number}</td>
                    <td style={{ padding: '10px 8px' }}>{inv.client_name}</td>
                    <td style={{ padding: '10px 8px' }}>{inv.gross_amount} zł</td>
                    <td style={{ padding: '10px 8px' }}>
                      {inv.is_paid ? badge('Opłacona', 'ok') : badge('Nieopłacona', 'warn')}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {inv.pdf_file ? badge('Jest', 'ok') : badge('Brak', 'warn')}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <Link
                        to={`/invoices/${inv.id}`}
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
                        Podgląd
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 10, ...beautyMutedTextStyle }}>
            Pokazujemy kwoty i daty zgodnie z typami: <b>gross/net/vat</b>, <b>issue/due/paid</b>.
          </div>
        </div>
      </div>
    </div>
  );
}
