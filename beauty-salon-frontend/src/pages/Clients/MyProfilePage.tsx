import React, { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { clientsAPI, usersAPI } from '@/api';
import { Modal } from '@/components/Modal.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import type { ClientMe, ClientMeUpdateData } from '@/types';

type PreferredContact = 'email' | 'sms' | 'phone' | 'none';

export const ClientMyProfilePage: React.FC = (): ReactElement => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ClientMe | null>(null);

  // tylko edytowalne pola
  const [form, setForm] = useState<ClientMeUpdateData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    marketing_consent: false,
    preferred_contact: 'none',
  });

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const loadMe = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const res = await clientsAPI.me();
      setProfile(res.data);

      setForm({
        first_name: res.data.first_name ?? '',
        last_name: res.data.last_name ?? '',
        email: res.data.email ?? '',
        phone: res.data.phone ?? '',
        marketing_consent: Boolean(res.data.marketing_consent),
        preferred_contact: (res.data.preferred_contact ?? 'none') as PreferredContact,
      });
    } catch (e) {
      console.error(e);
      setError('Nie udało się pobrać profilu klienta.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const onChange =
    (key: keyof ClientMeUpdateData) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      const value =
        e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value;

      setForm((prev) => ({ ...prev, [key]: value as never }));
    };

  const handleSave = async (): Promise<void> => {
    try {
      setError(null);

      const res = await clientsAPI.updateMe({
        first_name: form.first_name ?? '',
        last_name: form.last_name ?? '',
        email: form.email ?? null,
        phone: form.phone ?? null,
        marketing_consent: Boolean(form.marketing_consent),
        preferred_contact: (form.preferred_contact ?? 'none') as PreferredContact,
      });

      // updateMe zwraca ClientMe
      setProfile(res.data);
      setSuccessMsg('Zapisano zmiany profilu (RODO).');
    } catch (e) {
      console.error(e);
      setError('Nie udało się zapisać zmian profilu.');
    }
  };

  const handleChangePassword = async (): Promise<void> => {
    try {
      setError(null);

      if (!oldPassword || !newPassword1) {
        setError('Uzupełnij stare i nowe hasło.');
        return;
      }
      if (newPassword1 !== newPassword2) {
        setError('Nowe hasła nie są identyczne.');
        return;
      }

      await usersAPI.changePassword({
        old_password: oldPassword,
        new_password: newPassword1,
      });

      setOldPassword('');
      setNewPassword1('');
      setNewPassword2('');
      setSuccessMsg('Hasło zostało zmienione.');
    } catch (e) {
      console.error(e);
      setError('Nie udało się zmienić hasła.');
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    const confirmed = window.confirm(
      'Czy na pewno chcesz usunąć konto? Operacja jest nieodwracalna (RODO).'
    );
    if (!confirmed) return;

    try {
      setError(null);
      await clientsAPI.deleteMe();

      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      console.error(e);
      setError('Nie udało się usunąć konta.');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ładowanie profilu klienta...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Modal isOpen={Boolean(error)} onClose={() => setError(null)} title="Błąd">
        <p style={{ marginTop: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setError(null)}>
            OK
          </button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(successMsg)} onClose={() => setSuccessMsg(null)} title="Sukces">
        <p style={{ marginTop: 0 }}>{successMsg}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setSuccessMsg(null)}>
            OK
          </button>
        </div>
      </Modal>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Mój profil (RODO)</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>Edycja danych, zmiana hasła, usunięcie konta.</p>
        </div>

        <button type="button" onClick={() => void loadMe()}>
          Odśwież
        </button>
      </div>

      {!profile ? (
        <div style={{ marginTop: 16 }}>Brak danych profilu.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
          <section style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Dane klienta</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Imię
                <input value={form.first_name ?? ''} onChange={onChange('first_name')} />
              </label>

              <label>
                Nazwisko
                <input value={form.last_name ?? ''} onChange={onChange('last_name')} />
              </label>

              <label>
                Email
                <input value={(form.email ?? '') as string} onChange={onChange('email')} />
              </label>

              <label>
                Telefon
                <input value={(form.phone ?? '') as string} onChange={onChange('phone')} />
              </label>

              <label>
                Preferowany kontakt
                <select
                  value={(form.preferred_contact ?? 'none') as string}
                  onChange={onChange('preferred_contact')}
                >
                  <option value="none">Brak</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="phone">Telefon</option>
                </select>
              </label>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 22 }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.marketing_consent)}
                  onChange={onChange('marketing_consent')}
                />
                Zgoda marketingowa
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" onClick={() => void handleSave()}>
                Zapisz zmiany
              </button>
            </div>
          </section>

          <section style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Zmiana hasła</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxWidth: 420 }}>
              <label>
                Stare hasło
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
              </label>

              <label>
                Nowe hasło
                <input type="password" value={newPassword1} onChange={(e) => setNewPassword1(e.target.value)} />
              </label>

              <label>
                Powtórz nowe hasło
                <input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => void handleChangePassword()}>
                  Zmień hasło
                </button>
              </div>
            </div>
          </section>

          <section style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Usunięcie konta (RODO)</h3>
            <p style={{ opacity: 0.8 }}>
              Usunięcie konta powoduje soft delete profilu + anonimizację danych oraz dezaktywację konta użytkownika.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => void handleDeleteAccount()} style={{ border: '1px solid #c62828' }}>
                Usuń konto
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ClientMyProfilePage;
