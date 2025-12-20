import { useEffect, useMemo, useState, type ReactElement, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { clientsAPI } from '@/api/clients.ts';
import type { Client, ClientCreateUpdateData } from '@/types';
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

function extractErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    try {
      return status ? `HTTP ${status}: ${JSON.stringify(data)}` : `Błąd: ${JSON.stringify(data)}`;
    } catch {
      return status ? `HTTP ${status}: [Błąd]` : 'Błąd';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Nieznany błąd.';
}

type Msg = { type: 'success' | 'error'; text: string };

export function ClientDetailsPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const clientId = Number(id);

  const [client, setClient] = useState<Client | null>(null);
  const [edit, setEdit] = useState<ClientCreateUpdateData | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Msg | null>(null);

  const [confirmSoftDelete, setConfirmSoftDelete] = useState(false);

  const textareaStyle: CSSProperties = {
    ...beautyInputStyle,
    resize: 'vertical',
    minHeight: 110,
    paddingTop: 10,
    paddingBottom: 10,
  };

  const fetchClient = async (): Promise<void> => {
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
      setMessage({ type: 'error', text: `Nie udało się pobrać klienta. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isInteger(clientId)) {
      navigate('/clients', { replace: true });
      return;
    }
    void fetchClient();
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
      const payload: Partial<ClientCreateUpdateData> = { ...edit };

      if (payload.email !== undefined && (payload.email === '' || payload.email === null)) payload.email = null;
      if (payload.phone !== undefined && (payload.phone === '' || payload.phone === null)) payload.phone = null;

      if (payload.internal_notes !== undefined && payload.internal_notes.trim().length === 0) {
        delete payload.internal_notes;
      }

      payload.first_name = edit.first_name.trim();
      payload.last_name = edit.last_name.trim();

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

  const confirmSoftDeleteNow = async (): Promise<void> => {
    if (!client) return;
    setConfirmSoftDelete(false);

    try {
      await clientsAPI.softDelete(client.id);
      setMessage({ type: 'success', text: 'Klient został oznaczony jako usunięty.' });
      void fetchClient();
    } catch (e: unknown) {
      setMessage({ type: 'error', text: `Nie udało się usunąć klienta. ${extractErrorMessage(e)}` });
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Ładowanie…</div>;
  if (!client || !edit) return <div style={{ padding: 20 }}>Brak danych klienta.</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1000 }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/clients" style={{ color: '#a12b45', fontWeight: 700, textDecoration: 'none' }}>
          ← Wróć do listy klientów
        </Link>
      </div>

      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>
            Klient: {client.first_name} {client.last_name}
          </h1>
          <p style={beautyMutedTextStyle}>Numer: {client.number ?? '—'}</p>
        </div>

        <div style={beautyCardBodyStyle}>
          {message ? (
            <div
              style={{
                marginBottom: 14,
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

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', rowGap: 10, columnGap: 12 }}>
            <strong>Imię</strong>
            <input
              style={beautyInputStyle}
              value={edit.first_name}
              onChange={(e) => setEdit({ ...edit, first_name: e.target.value })}
            />

            <strong>Nazwisko</strong>
            <input
              style={beautyInputStyle}
              value={edit.last_name}
              onChange={(e) => setEdit({ ...edit, last_name: e.target.value })}
            />

            <strong>Email</strong>
            <input
              style={beautyInputStyle}
              value={edit.email ?? ''}
              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
            />

            <strong>Telefon</strong>
            <input
              style={beautyInputStyle}
              value={edit.phone ?? ''}
              onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
            />

            <strong>Notatki</strong>
            <textarea
              style={textareaStyle}
              rows={4}
              value={edit.internal_notes ?? ''}
              onChange={(e) => setEdit({ ...edit, internal_notes: e.target.value })}
            />
          </div>

          <hr style={{ margin: '18px 0' }} />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={beautyButtonStyle} onClick={() => void handleSave()} disabled={!canSave || saving}>
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>

            <button style={beautyButtonSecondaryStyle} onClick={() => void fetchClient()} disabled={saving}>
              Odśwież
            </button>

            <button style={beautyButtonDangerStyle} onClick={requestSoftDelete} disabled={saving}>
              Usuń (soft-delete)
            </button>
          </div>

          {confirmSoftDelete ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid #f2a6b3', background: '#fff1f3' }}>
              <p style={{ marginTop: 0 }}>
                Potwierdź usunięcie klienta: <strong>{client.first_name} {client.last_name}</strong>
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={beautyButtonDangerStyle} onClick={() => void confirmSoftDeleteNow()}>
                  Potwierdź
                </button>
                <button style={beautyButtonSecondaryStyle} onClick={cancelSoftDelete}>
                  Anuluj
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
