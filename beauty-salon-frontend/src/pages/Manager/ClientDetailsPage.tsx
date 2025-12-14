import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { clientsAPI } from '../../api/clients';
import { appointmentsAPI } from '../../api/appointments';
import { Table, type ColumnDefinition } from '../../components/UI/Table/Table';
import type {
  AppointmentListItem,
  Client,
  ClientCreateUpdateData,
  PaginatedResponse,
} from '../../types';
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
  beautySelectStyle,
} from '../../utils/ui';

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
  // Nie zgadujemy backendu — pokazujemy to co przyszło w response
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;

    let details = '';
    if (typeof data === 'string') {
      details = data;
    } else if (data && typeof data === 'object') {
      try {
        details = JSON.stringify(data);
      } catch {
        details = '[Nie można zserializować treści błędu]';
      }
    } else if (data == null) {
      details = err.message;
    } else {
      details = String(data);
    }

    if (status) return `HTTP ${status}: ${details}`;
    return `Błąd: ${details}`;
  }

  if (err instanceof Error) return err.message;
  return 'Nieznany błąd.';
}

const APPTS_PAGE_SIZE = 50;

export function ClientDetailsPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const clientId = Number(id);

  const [client, setClient] = useState<Client | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);

  const [message, setMessage] = useState<Msg | null>(null);

  const [edit, setEdit] = useState<ClientCreateUpdateData | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmSoftDelete, setConfirmSoftDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const fetchClient = async (): Promise<void> => {
    setLoadingClient(true);
    setMessage(null);
    try {
      const res = await clientsAPI.detail(clientId);
      setClient(res.data);
      setEdit({
        first_name: res.data.first_name,
        last_name: res.data.last_name,
        email: res.data.email,
        phone: res.data.phone,
        marketing_consent: res.data.marketing_consent,
        preferred_contact: res.data.preferred_contact,
        internal_notes: res.data.internal_notes,
      });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: `Nie udało się pobrać szczegółów klienta. ${extractErrorMessage(e)}` });
      setClient(null);
      setEdit(null);
    } finally {
      setLoadingClient(false);
    }
  };

  const fetchAppointments = async (): Promise<void> => {
    setLoadingAppointments(true);
    try {
      const res = await appointmentsAPI.list({
        client: clientId,
        page: 1,
        page_size: APPTS_PAGE_SIZE,
      });
      const data: PaginatedResponse<AppointmentListItem> = res.data;

      // Bez zgadywania ordering backendu — sort client-side po starcie malejąco
      const sorted = [...data.results].sort((a, b) => {
        const ta = new Date(a.start).getTime();
        const tb = new Date(b.start).getTime();
        return tb - ta;
      });

      setAppointments(sorted);
    } catch (e: unknown) {
      setAppointments([]);
      setMessage((prev) =>
        prev ?? { type: 'error', text: `Nie udało się pobrać historii wizyt. ${extractErrorMessage(e)}` }
      );
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    if (!Number.isInteger(clientId) || clientId <= 0) {
      navigate('/clients', { replace: true });
      return;
    }
    void fetchClient();
    void fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const canSave = useMemo(() => {
    if (!edit) return false;
    return edit.first_name.trim().length > 0 && edit.last_name.trim().length > 0;
  }, [edit]);

  const handleSave = async (): Promise<void> => {
    if (!edit) return;
    setMessage(null);

    if (!canSave) {
      setMessage({ type: 'error', text: 'Imię i nazwisko są wymagane.' });
      return;
    }

    setSaving(true);
    try {
      // Trzymamy się dokładnie ClientCreateUpdateData
      const payload: Partial<ClientCreateUpdateData> = { ...edit };

      // tak jak w ClientFormModal — puste stringi -> null
      if (payload.email !== undefined && (payload.email === '' || payload.email === null)) payload.email = null;
      if (payload.phone !== undefined && (payload.phone === '' || payload.phone === null)) payload.phone = null;

      // jeśli internal_notes puste -> usuń z payload (jak w istniejącym module)
      if (payload.internal_notes !== undefined && payload.internal_notes.trim().length === 0) {
        delete payload.internal_notes;
      }

      // trim imię/nazwisko
      payload.first_name = payload.first_name.trim();
      payload.last_name = payload.last_name.trim();

      const res = await clientsAPI.update(clientId, payload);
      setClient(res.data);
      setEdit({
        first_name: res.data.first_name,
        last_name: res.data.last_name,
        email: res.data.email,
        phone: res.data.phone,
        marketing_consent: res.data.marketing_consent,
        preferred_contact: res.data.preferred_contact,
        internal_notes: res.data.internal_notes,
      });
      setMessage({ type: 'success', text: 'Zapisano zmiany klienta.' });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: `Nie udało się zapisać zmian. ${extractErrorMessage(e)}` });
    } finally {
      setSaving(false);
    }
  };

  const requestSoftDelete = (): void => {
    setConfirmSoftDelete(true);
    setMessage(null);
  };

  const cancelSoftDelete = (): void => {
    setConfirmSoftDelete(false);
  };

  const doSoftDelete = async (): Promise<void> => {
    if (!client) return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await clientsAPI.softDelete(client.id);
      setMessage({ type: 'success', text: res.data.detail || 'Klient został oznaczony jako usunięty (soft delete).' });
      setConfirmSoftDelete(false);
      await fetchClient();
    } catch (e: unknown) {
      setMessage({ type: 'error', text: `Nie udało się usunąć klienta (soft delete). ${extractErrorMessage(e)}` });
    } finally {
      setDeleting(false);
    }
  };

  const apptColumns: ColumnDefinition<AppointmentListItem>[] = useMemo(
    () => [
      { header: 'ID', key: 'id', width: '60px' },
      { header: 'Start', key: 'start', width: '170px', render: (a) => formatDateTime(a.start) },
      { header: 'Koniec', key: 'end', width: '170px', render: (a) => formatDateTime(a.end) },
      { header: 'Usługa', key: 'service_name', width: '220px' },
      { header: 'Pracownik', key: 'employee_name', width: '200px' },
      { header: 'Status', key: 'status', width: '140px', render: (a) => a.status_display ?? a.status },
    ],
    []
  );

  if (loadingClient) return <div style={{ padding: 20 }}>Ładowanie…</div>;

  if (!client || !edit) {
    return (
      <div style={{ padding: 20 }}>
        <div style={beautyCardStyle}>
          <div style={beautyCardHeaderStyle}>
            <h1 style={beautyPageTitleStyle}>Klient</h1>
          </div>
          <div style={beautyCardBodyStyle}>
            <div style={beautyMutedTextStyle}>Brak danych klienta.</div>
            <div style={{ marginTop: 12 }}>
              <button style={beautyButtonStyle} onClick={() => navigate('/clients')}>
                Wróć do listy
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={beautyCardStyle}>
          <div style={beautyCardHeaderStyle}>
            <h1 style={beautyPageTitleStyle}>
              Klient: {client.first_name} {client.last_name}
            </h1>
            <p style={beautyMutedTextStyle}>
              ID: {client.id} • Status: {client.deleted_at ? 'Usunięty' : 'Aktywny'} • Utworzono: {formatDateTime(client.created_at)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Imię *</span>
                <input
                  style={beautyInputStyle}
                  value={edit.first_name}
                  onChange={(e) => setEdit({ ...edit, first_name: e.target.value })}
                  disabled={saving || deleting}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Nazwisko *</span>
                <input
                  style={beautyInputStyle}
                  value={edit.last_name}
                  onChange={(e) => setEdit({ ...edit, last_name: e.target.value })}
                  disabled={saving || deleting}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Email</span>
                <input
                  style={beautyInputStyle}
                  value={edit.email ?? ''}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value.length ? e.target.value : null })}
                  disabled={saving || deleting}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Telefon</span>
                <input
                  style={beautyInputStyle}
                  value={edit.phone ?? ''}
                  onChange={(e) => setEdit({ ...edit, phone: e.target.value.length ? e.target.value : null })}
                  disabled={saving || deleting}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Preferowany kontakt</span>
                <select
                  style={beautySelectStyle}
                  value={edit.preferred_contact ?? 'none'}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      preferred_contact: e.target.value as ClientCreateUpdateData['preferred_contact'],
                    })
                  }
                  disabled={saving || deleting}
                >
                  <option value="none">Brak</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="phone">Telefon</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Zgoda marketingowa</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(edit.marketing_consent)}
                    onChange={(e) => setEdit({ ...edit, marketing_consent: e.target.checked })}
                    disabled={saving || deleting}
                  />
                  <span>{edit.marketing_consent ? 'TAK' : 'NIE'}</span>
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                <span style={{ fontWeight: 700 }}>Notatki wewnętrzne</span>
                <textarea
                  style={{ ...beautyInputStyle, minHeight: 90 }}
                  value={edit.internal_notes ?? ''}
                  onChange={(e) => setEdit({ ...edit, internal_notes: e.target.value })}
                  disabled={saving || deleting}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
              <button
                style={beautyButtonStyle}
                onClick={() => void handleSave()}
                disabled={!canSave || saving || deleting}
              >
                {saving ? 'Zapisywanie…' : 'Zapisz'}
              </button>

              <button
                style={beautyButtonSecondaryStyle}
                onClick={() => navigate('/clients')}
                disabled={saving || deleting}
              >
                Wróć do listy
              </button>

              {!client.deleted_at ? (
                <button
                  style={beautyButtonDangerStyle}
                  onClick={requestSoftDelete}
                  disabled={saving || deleting}
                >
                  Usuń (soft delete)
                </button>
              ) : null}
            </div>

            {confirmSoftDelete ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #e6a1ad',
                  backgroundColor: '#ffe6ec',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <strong>
                  Potwierdź soft delete klienta: {client.first_name} {client.last_name}
                </strong>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={beautyButtonSecondaryStyle} onClick={cancelSoftDelete} disabled={deleting}>
                    Wróć
                  </button>
                  <button style={beautyButtonDangerStyle} onClick={() => void doSoftDelete()} disabled={deleting}>
                    {deleting ? 'Usuwanie…' : 'Tak, usuń'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={beautyCardStyle}>
          <div style={beautyCardHeaderStyle}>
            <h2 style={{ margin: 0, color: '#880E4F' }}>Historia wizyt</h2>
            <p style={beautyMutedTextStyle}>Ostatnie (max {APPTS_PAGE_SIZE}) wizyt klienta</p>
          </div>
          <div style={beautyCardBodyStyle}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button
                style={beautyButtonSecondaryStyle}
                onClick={() => void fetchAppointments()}
                disabled={loadingAppointments}
              >
                Odśwież wizyty
              </button>
            </div>

            <Table<AppointmentListItem>
              data={appointments}
              columns={apptColumns}
              loading={loadingAppointments}
              emptyMessage="Brak wizyt"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
