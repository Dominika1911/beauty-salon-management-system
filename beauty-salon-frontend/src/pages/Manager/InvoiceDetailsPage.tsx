import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { invoicesAPI } from '@/shared/api/invoices';
import type { Invoice } from '@/shared/types';
import {
  beautyCardStyle,
  beautyCardHeaderStyle,
  beautyCardBodyStyle,
  beautyPageTitleStyle,
  beautyButtonSecondaryStyle,
  beautyMutedTextStyle,
} from '@/shared/utils/ui';

type Msg = { type: 'success' | 'error'; text: string };

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

export function InvoiceDetailsPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoiceId = Number(id);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Msg | null>(null);

  const fetchInvoice = async (): Promise<void> => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await invoicesAPI.detail(invoiceId);
      setInvoice(res.data);
    } catch (e: unknown) {
      setInvoice(null);
      setMessage({ type: 'error', text: `Nie udało się pobrać faktury. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      navigate('/invoices', { replace: true });
      return;
    }
    void fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const paidBox = useMemo(() => {
    const ok = invoice?.is_paid ?? false;
    return {
      ok,
      bg: ok ? '#e9fff1' : '#fff1f3',
      border: ok ? '#9ad5b3' : '#f2a6b3',
      text: ok ? 'Opłacona' : 'Nieopłacona',
    };
  }, [invoice]);

  if (loading) return <div style={{ padding: 30 }}>Ładowanie…</div>;

  if (!invoice) {
    return (
      <div style={{ padding: 30 }}>
        <div style={beautyCardStyle}>
          <div style={beautyCardHeaderStyle}>
            <h1 style={beautyPageTitleStyle}>Faktura</h1>
          </div>
          <div style={beautyCardBodyStyle}>
            <div style={beautyMutedTextStyle}>{message?.text ?? 'Brak danych.'}</div>
            <button style={{ ...beautyButtonSecondaryStyle, marginTop: 12 }} onClick={() => navigate('/invoices')}>
              Wróć do listy
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 30, maxWidth: 920, margin: '0 auto' }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Faktura {invoice.number}</h1>
          <p style={beautyMutedTextStyle}>
            Utworzono: {formatDateTime(invoice.created_at)} • Zaktualizowano: {formatDateTime(invoice.updated_at)}
          </p>
        </div>

        <div style={beautyCardBodyStyle}>
          {message ? (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                border: '1px solid',
                borderColor: message.type === 'success' ? '#9ad5b3' : '#f2a6b3',
                backgroundColor: message.type === 'success' ? '#e9fff1' : '#fff1f3',
              }}
            >
              {message.text}
            </div>
          ) : null}

          {/* TOP BOX: opłacenie + kwota brutto */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderRadius: 14,
              background: paidBox.bg,
              border: `1px solid ${paidBox.border}`,
              marginBottom: 18,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Status opłacenia</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{paidBox.text}</div>
              <div style={{ marginTop: 6, ...beautyMutedTextStyle }}>
                Opłacono: {formatDateTime(invoice.paid_date)}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Kwota brutto</div>
              <div style={{ fontSize: 26, fontWeight: 900 }}>{invoice.gross_amount} zł</div>
              <div style={{ marginTop: 6, ...beautyMutedTextStyle }}>
                Netto: {invoice.net_amount} zł • VAT: {invoice.vat_amount} zł ({invoice.vat_rate})
              </div>
            </div>
          </div>

          {/* SZCZEGÓŁY */}
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', rowGap: 10, columnGap: 14 }}>
            <strong>ID</strong>
            <span>{invoice.id}</span>

            <strong>Klient</strong>
            <span>{invoice.client_name}</span>

            <strong>Klient (ID)</strong>
            <span>{invoice.client}</span>

            <strong>Wizyta (ID)</strong>
            <span>{invoice.appointment ?? '—'}</span>

            <strong>Data wystawienia</strong>
            <span>{formatDateTime(invoice.issue_date)}</span>

            <strong>Data sprzedaży</strong>
            <span>{formatDateTime(invoice.sale_date)}</span>

            <strong>Termin płatności</strong>
            <span>{formatDateTime(invoice.due_date)}</span>

            <strong>PDF</strong>
            <span>{invoice.pdf_file ? 'Dostępny' : 'Brak'}</span>
          </div>

          {/* AKCJE */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={beautyButtonSecondaryStyle} onClick={() => navigate('/invoices')}>
              Wróć do listy
            </button>

            <button style={beautyButtonSecondaryStyle} onClick={() => void fetchInvoice()}>
              Odśwież
            </button>

            {invoice.pdf_file ? (
              <a
                href={invoice.pdf_file}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...beautyButtonSecondaryStyle,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Otwórz PDF
              </a>
            ) : (
              <span style={beautyMutedTextStyle}>Brak pliku PDF</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
