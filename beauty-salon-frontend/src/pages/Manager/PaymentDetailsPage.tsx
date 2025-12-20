import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { paymentsAPI } from '@/api/payments.ts';
import type { Payment } from '@/types';
import {
  beautyButtonDangerStyle,
  beautyButtonSecondaryStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
} from '@/utils/ui.ts';

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
    return `HTTP ${status}: ${JSON.stringify(data)}`;
  }
  if (err instanceof Error) return err.message;
  return 'Nieznany błąd.';
}

export function PaymentDetailsPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const paymentId = Number(id);

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [marking, setMarking] = useState(false);
  const [message, setMessage] = useState<Msg | null>(null);

  const fetchPayment = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await paymentsAPI.detail(paymentId);
      setPayment(res.data);
    } catch (e) {
      setMessage({ type: 'error', text: extractErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!paymentId) {
      navigate('/payments', { replace: true });
      return;
    }
    void fetchPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const isPaid = useMemo(
    () => payment?.paid_at != null || payment?.status === 'paid',
    [payment]
  );

  const doMarkAsPaid = async (): Promise<void> => {
    if (!payment) return;
    setMarking(true);
    try {
      const res = await paymentsAPI.markAsPaid({ payment: payment.id });
      setPayment(res.data.payment);
      setConfirmPaid(false);
      setMessage({ type: 'success', text: res.data.detail });
    } catch (e) {
      setMessage({ type: 'error', text: extractErrorMessage(e) });
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <div style={{ padding: 30 }}>Ładowanie…</div>;
  if (!payment) return <div style={{ padding: 30 }}>Brak danych.</div>;

  return (
    <div style={{ padding: 30, maxWidth: 900, margin: '0 auto' }}>
      <div style={beautyCardStyle}>
        {/* HEADER */}
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Płatność #{payment.id}</h1>
          <p style={beautyMutedTextStyle}>
            Utworzono: {formatDateTime(payment.created_at)}
          </p>
        </div>

        <div style={beautyCardBodyStyle}>
          {/* STATUS + KWOTA */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              padding: 16,
              borderRadius: 14,
              background: isPaid ? '#e9fff1' : '#fff1f3',
              border: '1px solid',
              borderColor: isPaid ? '#9ad5b3' : '#f2a6b3',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                Status
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {payment.status_display ?? payment.status}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                Kwota
              </div>
              <div style={{ fontSize: 26, fontWeight: 900 }}>
                {payment.amount} zł
              </div>
            </div>
          </div>

          {/* DANE */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr',
              rowGap: 10,
              columnGap: 16,
            }}
          >
            <strong>Klient</strong>
            <span>{payment.client_name ?? '—'}</span>

            <strong>Wizyta (ID)</strong>
            <span>{payment.appointment}</span>

            <strong>Opłacono</strong>
            <span>{formatDateTime(payment.paid_at)}</span>

            <strong>Metoda</strong>
            <span>{payment.method}</span>

            <strong>Typ</strong>
            <span>{payment.type}</span>

            <strong>Referencja</strong>
            <span>{payment.reference}</span>

            <strong>Start wizyty</strong>
            <span>{formatDateTime(payment.appointment_start)}</span>

            <strong>Zaktualizowano</strong>
            <span>{formatDateTime(payment.updated_at)}</span>
          </div>

          {/* AKCJE */}
          <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button style={beautyButtonSecondaryStyle} onClick={() => navigate('/payments')}>
              Wróć do listy
            </button>

            <button style={beautyButtonSecondaryStyle} onClick={() => void fetchPayment()}>
              Odśwież
            </button>

            {!isPaid ? (
              <button
                style={beautyButtonDangerStyle}
                onClick={() => setConfirmPaid(true)}
              >
                Oznacz jako opłacone
              </button>
            ) : (
              <span style={{ ...beautyMutedTextStyle, fontWeight: 700 }}>
                ✓ Płatność została opłacona
              </span>
            )}
          </div>

          {/* POTWIERDZENIE */}
          {confirmPaid && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 12,
                background: '#ffe6ec',
                border: '1px solid #e6a1ad',
              }}
            >
              <strong>
                Czy na pewno oznaczyć płatność #{payment.id} jako opłaconą?
              </strong>

              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  style={beautyButtonSecondaryStyle}
                  onClick={() => setConfirmPaid(false)}
                >
                  Anuluj
                </button>
                <button
                  style={beautyButtonDangerStyle}
                  onClick={() => void doMarkAsPaid()}
                  disabled={marking}
                >
                  {marking ? 'Zapisywanie…' : 'Tak, oznacz'}
                </button>
              </div>
            </div>
          )}

          {/* KOMUNIKAT */}
          {message && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                background: message.type === 'success' ? '#e9fff1' : '#fff1f3',
                border: '1px solid',
                borderColor: message.type === 'success' ? '#9ad5b3' : '#f2a6b3',
              }}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
