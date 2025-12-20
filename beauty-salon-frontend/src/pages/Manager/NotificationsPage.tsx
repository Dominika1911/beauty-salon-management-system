import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { notificationsAPI } from '@/api/notifications.ts';
import type { Notification, NotificationCreateData, PaginatedResponse } from '@/types';
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
} from '@/utils/ui.ts';

const TYPE_LABELS: Record<string, string> = {
  reminder: 'Przypomnienie',
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'E-mail',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Oczekujące',
  sent: 'Wysłane',
  failed: 'Błąd wysyłki',
};

function labelFromMap(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

type Msg = { type: 'success' | 'error'; text: string };

type StatusFilter = 'all' | string;
type ChannelFilter = 'all' | string;
type TypeFilter = 'all' | string;

const PAGE_SIZE = 100;

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 10,
  border: '1px solid rgba(233, 30, 99, 0.20)',
  background: '#fff',
  outline: 'none',
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

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
    } else {
      details = err.message;
    }

    return status ? `HTTP ${status}: ${details}` : `Błąd: ${details}`;
  }
  if (err instanceof Error) return err.message;
  return 'Nieznany błąd.';
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function isValidDatetimeLocalMinute(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed);
}

export function NotificationsPage(): ReactElement {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Msg | null>(null);

  const [items, setItems] = useState<Notification[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filtry
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // UI: expand wiersza
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createClient, setCreateClient] = useState<string>('');
  const [createAppointment, setCreateAppointment] = useState<string>('');
  const [createType, setCreateType] = useState<string>('');
  const [createChannel, setCreateChannel] = useState<string>('');

  // FIX: zamiast datetime-local robimy date + time (bez sekund), a potem składamy do YYYY-MM-DDTHH:mm
  const [createScheduledDate, setCreateScheduledDate] = useState<string>(''); // YYYY-MM-DD
  const [createScheduledTime, setCreateScheduledTime] = useState<string>(''); // HH:mm (bez sekund)

  const [createSubject, setCreateSubject] = useState<string>('');
  const [createContent, setCreateContent] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchList = async (): Promise<void> => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await notificationsAPI.list({
        page: 1,
        page_size: PAGE_SIZE,
        ordering: 'id',
      });

      const data: PaginatedResponse<Notification> = res.data;
      const sorted = [...data.results].sort((a, b) => a.id - b.id);

      setItems(sorted);
      setTotalCount(data.count);
    } catch (e: unknown) {
      setItems([]);
      setTotalCount(0);
      setMessage({ type: 'error', text: `Nie udało się pobrać powiadomień. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchList();
  }, []);

  const statusOptions = useMemo(() => {
    const uniq = new Set<string>();
    items.forEach((n) => uniq.add(n.status));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'pl-PL'));
  }, [items]);

  const channelOptions = useMemo(() => {
    const uniq = new Set<string>();
    items.forEach((n) => uniq.add(n.channel));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'pl-PL'));
  }, [items]);

  const typeOptions = useMemo(() => {
    const uniq = new Set<string>();
    items.forEach((n) => uniq.add(n.type));
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'pl-PL'));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = normalize(search);

    return items.filter((n) => {
      if (statusFilter !== 'all' && n.status !== statusFilter) return false;
      if (channelFilter !== 'all' && n.channel !== channelFilter) return false;
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;

      if (!q) return true;

      const hay = [
        String(n.id),
        String(n.client ?? ''),
        n.client_name ?? '',
        String(n.appointment ?? ''),
        n.type,
        n.channel,
        n.status,
        n.subject,
        n.content,
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, search, statusFilter, channelFilter, typeFilter]);

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

  const buildScheduledAt = (): string => {
    const d = createScheduledDate.trim();
    const t = createScheduledTime.trim();
    if (!d || !t) return '';
    return `${d}T${t}`;
  };

  const resetCreateForm = (): void => {
    setCreateClient('');
    setCreateAppointment('');
    setCreateType('');
    setCreateChannel('');
    setCreateScheduledDate('');
    setCreateScheduledTime('');
    setCreateSubject('');
    setCreateContent('');
    setCreateError(null);
  };

  const validateCreate = (): string | null => {
    if (!createType.trim()) return 'Pole „Rodzaj powiadomienia” jest wymagane.';
    if (!createChannel.trim()) return 'Pole „Sposób wysyłki” jest wymagane.';

    const scheduledAt = buildScheduledAt();
    if (!scheduledAt) return 'Wybierz datę i godzinę wysyłki.';
    if (!isValidDatetimeLocalMinute(scheduledAt)) return 'Data/godzina musi być w formacie RRRR-MM-DDTHH:mm (bez sekund).';

    if (!createSubject.trim()) return 'Pole „Temat” jest wymagane.';
    if (!createContent.trim()) return 'Pole „Treść wiadomości” jest wymagane.';
    return null;
  };

  const submitCreate = async (): Promise<void> => {
    const err = validateCreate();
    if (err) {
      setCreateError(err);
      return;
    }

    setCreateError(null);

    const scheduledAt = buildScheduledAt();

    const payload: NotificationCreateData = {
      client: parseOptionalInt(createClient),
      appointment: parseOptionalInt(createAppointment),
      type: createType.trim(),
      channel: createChannel.trim(),
      scheduled_at: scheduledAt,
      subject: createSubject.trim(),
      content: createContent.trim(),
    };

    setLoading(true);
    setMessage(null);

    try {
      const res = await notificationsAPI.create(payload);
      const created = res.data;

      setItems((prev) => [...prev, created].sort((a, b) => a.id - b.id));
      setMessage({ type: 'success', text: `Utworzono powiadomienie (ID: ${created.id}).` });
      setShowCreate(false);
      resetCreateForm();
    } catch (e: unknown) {
      setMessage({ type: 'error', text: `Nie udało się utworzyć powiadomienia. ${extractErrorMessage(e)}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 30 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Powiadomienia</h1>
          <p style={beautyMutedTextStyle}>
            Łącznie w systemie: {totalCount} • Na ekranie po filtrach: {filteredItems.length}
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
          {/* CREATE */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <button style={beautyButtonSecondaryStyle} onClick={() => setShowCreate((v) => !v)} disabled={loading}>
              {showCreate ? 'Zamknij tworzenie' : 'Nowe powiadomienie'}
            </button>

            <button style={beautyButtonSecondaryStyle} onClick={() => void fetchList()} disabled={loading}>
              Odśwież
            </button>
          </div>

          {showCreate ? (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                border: '1px solid rgba(233, 30, 99, 0.20)',
                background: '#fff5fa',
                marginBottom: 18,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Utwórz powiadomienie</div>

              {createError ? (
                <div
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid #f2a6b3',
                    backgroundColor: '#fff1f3',
                    color: '#5a2a35',
                    fontWeight: 800,
                  }}
                >
                  {createError}
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Klient (ID) — opcjonalnie</span>
                  <input
                    style={beautyInputStyle}
                    value={createClient}
                    onChange={(e) => setCreateClient(e.target.value)}
                    placeholder="np. 12"
                    inputMode="numeric"
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Wizyta (ID) — opcjonalnie</span>
                  <input
                    style={beautyInputStyle}
                    value={createAppointment}
                    onChange={(e) => setCreateAppointment(e.target.value)}
                    placeholder="np. 86"
                    inputMode="numeric"
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Rodzaj powiadomienia *</span>
                  <input
                    style={beautyInputStyle}
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                    list="notification-type-suggestions"
                    placeholder="np. reminder"
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Sposób wysyłki *</span>
                  <input
                    style={beautyInputStyle}
                    value={createChannel}
                    onChange={(e) => setCreateChannel(e.target.value)}
                    list="notification-channel-suggestions"
                    placeholder="np. sms"
                  />
                </label>

                {/* FIX: date + time */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Data wysyłki *</span>
                  <input
                    style={beautyInputStyle}
                    type="date"
                    value={createScheduledDate}
                    onChange={(e) => setCreateScheduledDate(e.target.value)}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Godzina wysyłki (bez sekund) *</span>
                  <input
                    style={beautyInputStyle}
                    type="time"
                    step={60}
                    value={createScheduledTime}
                    onChange={(e) => setCreateScheduledTime(e.target.value)}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                  <span style={{ ...beautyMutedTextStyle, marginTop: -4 }}>
                    Wysyłamy jako: <strong>{buildScheduledAt() || '—'}</strong>
                  </span>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Temat *</span>
                  <input
                    style={beautyInputStyle}
                    value={createSubject}
                    onChange={(e) => setCreateSubject(e.target.value)}
                    placeholder="Temat powiadomienia"
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                  <span style={{ fontWeight: 800 }}>Treść wiadomości *</span>
                  <textarea
                    style={{ ...textareaStyle, minHeight: 120 }}
                    value={createContent}
                    onChange={(e) => setCreateContent(e.target.value)}
                    placeholder="Treść powiadomienia"
                  />
                </label>
              </div>

              <datalist id="notification-type-suggestions">
                {typeOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <datalist id="notification-channel-suggestions">
                {channelOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  style={beautyButtonSecondaryStyle}
                  onClick={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                  disabled={loading}
                >
                  Anuluj
                </button>
                <button style={beautyButtonDangerStyle} onClick={() => void submitCreate()} disabled={loading}>
                  Utwórz
                </button>
              </div>

              <div style={{ marginTop: 10, ...beautyMutedTextStyle }}>
                Tip: „Rodzaj powiadomienia” i „Sposób wysyłki” możesz wpisać ręcznie — podpowiedzi biorą się z istniejących
                rekordów.
              </div>
            </div>
          ) : null}

          {/* FILTRY */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 220px 220px 220px',
              gap: 12,
              alignItems: 'end',
              marginBottom: 12,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Szukaj</span>
              <input
                style={beautyInputStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID, klient, status, temat, treść..."
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Status</span>
              <select style={beautySelectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {labelFromMap(STATUS_LABELS, s)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Sposób wysyłki</span>
              <select style={beautySelectStyle} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                {channelOptions.map((c) => (
                  <option key={c} value={c}>
                    {labelFromMap(CHANNEL_LABELS, c)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Rodzaj</span>
              <select style={beautySelectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Wszystkie</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {labelFromMap(TYPE_LABELS, t)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* LISTA */}
          {loading ? (
            <p>Ładowanie…</p>
          ) : filteredItems.length === 0 ? (
            <p style={beautyMutedTextStyle}>Brak powiadomień do wyświetlenia.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>ID</th>
                  <th style={{ padding: '10px 8px' }}>Klient</th>
                  <th style={{ padding: '10px 8px' }}>Rodzaj / Sposób wysyłki</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Data wysyłki</th>
                  <th style={{ padding: '10px 8px' }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((n) => {
                  const isExpanded = expandedId === n.id;
                  const statusKind: 'ok' | 'warn' = n.status === 'sent' ? 'ok' : 'warn';

                  return (
                    <tr key={n.id} style={{ borderTop: '1px solid rgba(233, 30, 99, 0.15)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 900 }}>{n.id}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 800 }}>{n.client_name ?? '—'}</div>
                        <div style={beautyMutedTextStyle}>ID: {n.client ?? '—'}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 800 }}>{labelFromMap(TYPE_LABELS, n.type)}</div>
                        <div style={beautyMutedTextStyle}>{labelFromMap(CHANNEL_LABELS, n.channel)}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>{badge(labelFromMap(STATUS_LABELS, n.status), statusKind)}</td>
                      <td style={{ padding: '10px 8px' }}>{formatDateTime(n.scheduled_at)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <button
                          style={{ ...beautyButtonSecondaryStyle, padding: '8px 12px' }}
                          onClick={() => setExpandedId((prev) => (prev === n.id ? null : n.id))}
                        >
                          {isExpanded ? 'Zwiń podgląd' : 'Podgląd'}
                        </button>

                        {isExpanded ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 12,
                              borderRadius: 10,
                              border: '1px solid #e6a1ad',
                              backgroundColor: '#fff1f3',
                            }}
                          >
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>{n.subject}</div>
                            <div style={{ whiteSpace: 'pre-wrap', marginBottom: 10 }}>{n.content}</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 6 }}>
                              <strong>Data wysłania</strong>
                              <span>{formatDateTime(n.sent_at)}</span>

                              <strong>Liczba prób</strong>
                              <span>{n.attempts_count}</span>

                              <strong>Ostatni błąd</strong>
                              <span>{n.error_message ?? '—'}</span>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
