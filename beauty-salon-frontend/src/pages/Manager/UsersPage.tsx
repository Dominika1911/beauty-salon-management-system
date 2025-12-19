import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { isAxiosError } from 'axios';

import { usersAPI } from '@/shared/api/users';
import { Table, type ColumnDefinition } from '@/shared/ui/Table/Table';
import type { PaginatedResponse, UserListItem, UserRole } from '@/shared/types';
import {
  beautyButtonDangerStyle,
  beautyButtonSecondaryStyle,
  beautyButtonStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
  beautySelectStyle,
} from '@/shared/utils/ui';

const USERS_PAGE_SIZE = 50;

function formatDateTime(value: string): string {
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

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
  if (!/[A-Za-z]/.test(password)) return 'Hasło musi zawierać przynajmniej jedną literę.';
  if (!/[0-9]/.test(password)) return 'Hasło musi zawierać przynajmniej jedną cyfrę.';
  return null;
}

function extractErrorMessage(err: unknown): { status: number | null; message: string } {
  if (!isAxiosError(err)) {
    return { status: null, message: 'Wystąpił nieoczekiwany błąd.' };
  }

  const status = typeof err.response?.status === 'number' ? err.response.status : null;
  const data = err.response?.data as unknown;

  if (typeof data === 'object' && data !== null) {
    const maybeDetail = (data as { detail?: unknown }).detail;
    if (typeof maybeDetail === 'string' && maybeDetail.trim()) {
      return { status, message: maybeDetail };
    }

    // 400: zwykle { field: ["msg"] } lub { field: "msg" }
    const fieldEntries = Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          const first = v.find((x) => typeof x === 'string') as string | undefined;
          return first ? `${k}: ${first}` : null;
        }
        if (typeof v === 'string') return `${k}: ${v}`;
        return null;
      })
      .filter((x): x is string => Boolean(x));

    if (fieldEntries.length > 0) {
      return { status, message: fieldEntries[0] ?? 'Nie udało się wykonać operacji.' };
    }
  }

  return { status, message: 'Nie udało się wykonać operacji.' };
}

const roleOptions: Array<{ value: 'all' | UserRole; label: string }> = [
  { value: 'all', label: 'Wszystkie role' },
  { value: 'manager', label: 'Administrator' },
  { value: 'employee', label: 'Pracownik' },
  { value: 'client', label: 'Klient' },
];

export function UsersPage(): ReactElement {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await usersAPI.list({
        page: 1,
        page_size: USERS_PAGE_SIZE,
        role: roleFilter === 'all' ? undefined : roleFilter,
      });
      const data: PaginatedResponse<UserListItem> = res.data;
      const sorted = [...data.results].sort((a, b) => a.id - b.id);
      setUsers(sorted);
      setTotalCount(data.count);
    } catch (err: unknown) {
      const { status, message } = extractErrorMessage(err);
      if (status === 403) {
        window.alert('Brak uprawnień');
      } else if (status === 400) {
        window.alert(message);
      } else {
        window.alert('Nie udało się pobrać listy użytkowników.');
      }
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const onToggleActive = async (u: UserListItem): Promise<void> => {
    const next = !u.is_active;
    const ok = window.confirm(
      `${next ? 'Aktywować' : 'Dezaktywować'} użytkownika ${u.email}?\n\n` +
        `Rola: ${u.role_display ?? u.role}`
    );
    if (!ok) return;

    try {
      await usersAPI.update(u.id, { is_active: next });
      window.alert(`Zapisano: ${u.email} → ${next ? 'AKTYWNY' : 'NIEAKTYWNY'}`);
      await fetchUsers();
    } catch (err: unknown) {
      const { status, message } = extractErrorMessage(err);
      if (status === 403) window.alert('Brak uprawnień');
      else if (status === 400) window.alert(message);
      else window.alert('Nie udało się zmienić statusu użytkownika.');
    }
  };

  const onResetPassword = async (u: UserListItem): Promise<void> => {
    const pass1 = window.prompt(
      `Reset hasła dla: ${u.email}\n\nWymagania: min. 8 znaków, co najmniej jedna litera i jedna cyfra.\n\nPodaj nowe hasło:`
    );
    if (pass1 == null) return;

    const err1 = validatePassword(pass1);
    if (err1) {
      window.alert(err1);
      return;
    }

    const pass2 = window.prompt('Powtórz nowe hasło:');
    if (pass2 == null) return;

    if (pass1 !== pass2) {
      window.alert('Hasła nie są identyczne.');
      return;
    }

    const ok = window.confirm(`Czy na pewno zresetować hasło dla: ${u.email}?`);
    if (!ok) return;

    try {
      const res = await usersAPI.resetPassword(u.id, { new_password: pass1 });
      window.alert(res.data.detail || 'Hasło zostało zresetowane.');
    } catch (e: unknown) {
      const { status, message } = extractErrorMessage(e);
      if (status === 403) window.alert('Brak uprawnień');
      else if (status === 400) window.alert(message);
      else window.alert('Nie udało się zresetować hasła.');
    }
  };

  const columns: ColumnDefinition<UserListItem>[] = useMemo(
    () => [
      { header: 'ID', key: 'id', width: '70px' },
      {
        header: 'Email',
        key: 'email',
        width: '260px',
        render: (u) => (
          <a href={`/users/${u.id}`} style={{ color: '#8b2c3b', textDecoration: 'underline' }}>
            {u.email}
          </a>
        ),
      },

      {
        header: 'Aktywny',
        key: 'is_active',
        width: '90px',
        render: (u) => (u.is_active ? 'TAK' : 'NIE'),
      },
      { header: 'Status konta', key: 'account_status', width: '140px' },
      {
        header: 'Utworzono',
        key: 'created_at',
        width: '170px',
        render: (u) => formatDateTime(u.created_at),
      },
      {
        header: 'Akcje',
        key: 'actions',
        width: '280px',
        render: (u) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              style={beautyButtonSecondaryStyle}
              onClick={() => void onToggleActive(u)}
              disabled={loading}
              title={u.is_active ? 'Dezaktywuj użytkownika' : 'Aktywuj użytkownika'}
            >
              {u.is_active ? 'Dezaktywuj' : 'Aktywuj'}
            </button>
            <button
              style={beautyButtonDangerStyle}
              onClick={() => void onResetPassword(u)}
              disabled={loading}
            >
              Reset hasła
            </button>
          </div>
        ),
      },
    ],
    [loading]
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 style={beautyPageTitleStyle}>Użytkownicy</h1>
            <p style={beautyMutedTextStyle}>Łącznie: {totalCount}</p>
          </div>
        </div>

        <div style={beautyCardBodyStyle}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <select
              style={{ ...beautySelectStyle, width: 220 }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              disabled={loading}
            >
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <button style={beautyButtonStyle} onClick={() => void fetchUsers()} disabled={loading}>
              Odśwież
            </button>
          </div>

          <Table<UserListItem> data={users} columns={columns} loading={loading} emptyMessage="Brak wyników" />
        </div>
      </div>
    </div>
  );
}
