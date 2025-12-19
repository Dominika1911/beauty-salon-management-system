import { useEffect, useMemo, useState, type ReactElement, type CSSProperties } from 'react';
import { isAxiosError } from 'axios';

import { Modal } from '@/shared/ui/Modal';
import { appointmentsAPI } from '@/shared/api/appointments';
import { useAuth } from '@/shared/hooks/useAuth';
import type { AppointmentDetail, AppointmentStatus } from '@/shared/types';
import {
  beautyButtonSecondaryStyle,
  beautyButtonStyle,
  beautyColors,
  beautyInputStyle,
  beautyMutedTextStyle,
} from '@/shared/utils/ui';

type Props = {
  isOpen: boolean;
  appointmentId: number | null;
  onClose: () => void;
  /**
   * Callback, który parent może wykorzystać do odświeżenia list.
   * Wywołujemy po udanej akcji.
   */
  onUpdated?: () => Promise<void> | void;
  /**
   * Opcjonalnie: rozpocznij flow zmiany terminu (obsługiwany w parent).
   */
  onReschedule?: (appointmentId: number) => void;
};

const formatDT = (iso: string): string =>
  new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

function extractError(err: unknown): string {
  if (!isAxiosError(err)) return 'Nieznany błąd';
  const data = err.response?.data as unknown;

  if (typeof data === 'object' && data !== null) {
    const d = (data as { detail?: unknown }).detail;
    if (typeof d === 'string' && d.trim()) return d;

    const entries = Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          const first = v.find((x) => typeof x === 'string') as string | undefined;
          return first ? `${k}: ${first}` : null;
        }
        if (typeof v === 'string') return `${k}: ${v}`;
        return null;
      })
      .filter((x): x is string => Boolean(x));

    if (entries.length) return entries.join('\n');
  }

  return 'Błąd zapytania do API';
}

const statusBadgeStyle = (status: AppointmentStatus): CSSProperties => {
  const common: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    border: `1px solid ${beautyColors.border}`,
    background: '#fff',
    color: beautyColors.text,
  };

  if (status === 'pending') return { ...common, background: 'rgba(255, 193, 7, 0.15)' };
  if (status === 'confirmed') return { ...common, background: 'rgba(76, 175, 80, 0.12)' };
  if (status === 'in_progress') return { ...common, background: 'rgba(33, 150, 243, 0.12)' };
  if (status === 'completed') return { ...common, background: 'rgba(96, 125, 139, 0.12)' };
  if (status === 'cancelled') return { ...common, background: 'rgba(244, 67, 54, 0.10)' };
  if (status === 'no_show') return { ...common, background: 'rgba(156, 39, 176, 0.10)' };
  return common;
};

export function AppointmentDetailsModal(props: Props): ReactElement | null {
  const { isOpen, appointmentId, onClose, onUpdated, onReschedule } = props;
  const { isClient, isEmployee, isManager } = useAuth();

  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppointmentDetail | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !appointmentId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    appointmentsAPI
      .detail(appointmentId)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setCancelReason('');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(extractError(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, appointmentId]);

  const title = useMemo(() => {
    if (!appointmentId) return 'Szczegóły wizyty';
    return `Wizyta #${appointmentId}`;
  }, [appointmentId]);

  const canClientCancel = useMemo(() => {
    if (!isClient || !data) return false;
    return data.status === 'pending' || data.status === 'confirmed';
  }, [isClient, data]);

  const canEmployeeAccept = useMemo(() => isEmployee && data?.status === 'pending', [isEmployee, data]);
  const canEmployeeStart = useMemo(() => isEmployee && data?.status === 'confirmed', [isEmployee, data]);
  const canEmployeeFinish = useMemo(() => isEmployee && data?.status === 'in_progress', [isEmployee, data]);
  const canEmployeeNoShow = useMemo(
    () => isEmployee && (data?.status === 'confirmed' || data?.status === 'in_progress'),
    [isEmployee, data]
  );

  const canReschedule = useMemo(() => {
    if (!isEmployee || !data) return false;
    const startDate = new Date(data.start);
    const now = new Date();
    return startDate > now && (data.status === 'pending' || data.status === 'confirmed');
  }, [isEmployee, data]);

  const doUpdated = async (): Promise<void> => {
    try {
      await onUpdated?.();
    } catch (e) {
      console.error(e);
    }
  };

  const changeStatus = async (status: AppointmentStatus): Promise<void> => {
    if (!appointmentId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await appointmentsAPI.changeStatus(appointmentId, { status });
      setData(res.data);
      await doUpdated();
    } catch (e: unknown) {
      setError(extractError(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelMy = async (): Promise<void> => {
    if (!appointmentId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await appointmentsAPI.cancelMy(appointmentId, cancelReason.trim());
      setData(res.data);
      await doUpdated();
    } catch (e: unknown) {
      setError(extractError(e));
    } finally {
      setBusy(false);
    }
  };

  const content = (() => {
    if (!appointmentId) return <div style={beautyMutedTextStyle}>Brak wybranej wizyty.</div>;
    if (loading) return <div style={beautyMutedTextStyle}>Ładowanie szczegółów…</div>;
    if (error) return <div style={{ ...beautyMutedTextStyle, color: beautyColors.dangerDark }}>{error}</div>;
    if (!data) return <div style={beautyMutedTextStyle}>Brak danych.</div>;

    const statusText = data.status_display ?? data.status;
    const clientName = data.client ? `${data.client.first_name} ${data.client.last_name}` : '—';

// Fallbacki: employee.full_name -> employee.first/last -> data.employee_name
const employeeObj = data.employee as any;
const employeeName =
  employeeObj?.full_name ||
  [employeeObj?.first_name, employeeObj?.last_name].filter(Boolean).join(' ') ||
  (data as any).employee_name ||
  '—';

// Fallbacki: service.name -> data.service_name
const serviceObj = data.service as any;
const serviceName = serviceObj?.name || (data as any).service_name || '—';


    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={statusBadgeStyle(data.status)}>{statusText}</span>
          <div style={beautyMutedTextStyle}>
            {formatDT(data.start)} – {formatTime(data.end)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ ...beautyMutedTextStyle, marginBottom: 4 }}>Usługa</div>
            <div style={{ fontWeight: 800 }}>{serviceName}</div>
          </div>
          <div>
            <div style={{ ...beautyMutedTextStyle, marginBottom: 4 }}>Pracownik</div>
            <div style={{ fontWeight: 800 }}>{employeeName}</div>
          </div>
          <div>
            <div style={{ ...beautyMutedTextStyle, marginBottom: 4 }}>Klient</div>
            <div style={{ fontWeight: 800 }}>{clientName}</div>
          </div>
          <div>
            <div style={{ ...beautyMutedTextStyle, marginBottom: 4 }}>Kanał rezerwacji</div>
            <div style={{ fontWeight: 800 }}>{data.booking_channel || '—'}</div>
          </div>
        </div>

        {data.client_notes ? (
          <div>
            <div style={{ ...beautyMutedTextStyle, marginBottom: 4 }}>Notatka klienta</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{data.client_notes}</div>
          </div>
        ) : null}

        {(isEmployee || isManager) && data.internal_notes ? (
          <div>
            <div style={{ ...beautyMutedTextStyle, marginBottom: 4 }}>Notatki wewnętrzne</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{data.internal_notes}</div>
          </div>
        ) : null}

        {data.status === 'cancelled' && data.cancelled_at ? (
          <div style={{ borderTop: `1px solid ${beautyColors.border}`, paddingTop: 10 }}>
            <div style={{ ...beautyMutedTextStyle, marginBottom: 4 }}>Anulowano</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <span style={beautyMutedTextStyle}>Kiedy: </span>
                <strong>{formatDT(data.cancelled_at)}</strong>
              </div>
              {data.cancellation_reason ? (
                <div>
                  <span style={beautyMutedTextStyle}>Powód: </span>
                  <strong style={{ whiteSpace: 'pre-wrap' }}>{data.cancellation_reason}</strong>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={{ borderTop: `1px solid ${beautyColors.border}`, paddingTop: 12 }}>
          <div style={{ ...beautyMutedTextStyle, marginBottom: 8 }}>Akcje</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canEmployeeAccept ? (
              <button type="button" style={beautyButtonStyle} disabled={busy} onClick={() => void changeStatus('confirmed')}>
                {busy ? '…' : 'Akceptuj'}
              </button>
            ) : null}
            {canEmployeeStart ? (
              <button type="button" style={beautyButtonStyle} disabled={busy} onClick={() => void changeStatus('in_progress')}>
                {busy ? '…' : 'Rozpocznij'}
              </button>
            ) : null}
            {canEmployeeFinish ? (
              <button type="button" style={beautyButtonStyle} disabled={busy} onClick={() => void changeStatus('completed')}>
                {busy ? '…' : 'Zakończ'}
              </button>
            ) : null}
            {canEmployeeNoShow ? (
              <button type="button" style={beautyButtonSecondaryStyle} disabled={busy} onClick={() => void changeStatus('no_show')}>
                {busy ? '…' : 'Nieobecność'}
              </button>
            ) : null}

            {canReschedule && onReschedule ? (
              <button type="button" style={beautyButtonSecondaryStyle} disabled={busy} onClick={() => onReschedule(appointmentId)}>
                Zmień termin
              </button>
            ) : null}
          </div>

          {canClientCancel ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...beautyMutedTextStyle, marginBottom: 6 }}>Anulowanie (opcjonalny powód)</div>
              <input
                style={beautyInputStyle}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Powód anulowania (może być pusty)"
                disabled={busy}
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={beautyButtonSecondaryStyle} disabled={busy} onClick={() => void cancelMy()}>
                  {busy ? '…' : 'Anuluj wizytę'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {content}
    </Modal>
  );
}
