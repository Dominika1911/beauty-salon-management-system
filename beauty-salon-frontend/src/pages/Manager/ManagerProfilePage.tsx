import React, { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { usersAPI } from "@/api";
import { Modal } from '@/components/Modal.tsx';
import type { User } from '@/types';

export const ManagerProfilePage: React.FC = (): ReactElement => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async (opts?: { showSuccess?: boolean }) => {
    try {
      setLoading(true);
      setError(null);

      const res = await usersAPI.me(); // GET /users/me/
      setProfile(res.data);

      if (opts?.showSuccess) {
        setSuccessMsg('Dane profilu zostały pomyślnie odświeżone.');
      }
    } catch (e) {
      console.error('Błąd pobierania profilu', e);
      setError('Nie udało się pobrać danych profilu użytkownika.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ładowanie danych profilu...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* MODALE */}
      <Modal isOpen={Boolean(error)} onClose={() => setError(null)} title="Błąd systemu">
        <p style={{ marginTop: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setError(null)}>Zamknij</button>
          <button type="button" onClick={() => void loadProfile()}>Spróbuj ponownie</button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(successMsg)} onClose={() => setSuccessMsg(null)} title="Operacja zakończona">
        <p style={{ marginTop: 0 }}>{successMsg}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setSuccessMsg(null)}>OK</button>
        </div>
      </Modal>

      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Profil managera</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Informacje o koncie administracyjnym oraz powiązaniach systemowych
          </p>
        </div>

        <button type="button" onClick={() => void loadProfile({ showSuccess: true })}>
          Odśwież dane
        </button>
      </div>

      {/* KARTY */}
      {profile ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {/* KONTO */}
          <section
            style={{
              padding: 20,
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#ffffff',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Informacje o koncie</h3>
            <p><strong>Adres e-mail:</strong> {profile.email}</p>
            <p><strong>Rola w systemie:</strong> {profile.role_display ?? profile.role}</p>
            <p><strong>Status konta:</strong> {profile.is_active ? 'Aktywne' : 'Nieaktywne'}</p>
            <p><strong>Dostęp administracyjny (staff):</strong> {profile.is_staff ? 'Tak' : 'Nie'}</p>
          </section>

          {/* DANE OSOBOWE */}
          <section
            style={{
              padding: 20,
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#ffffff',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Dane użytkownika</h3>
            <p><strong>Imię:</strong> {profile.first_name || 'Nie podano'}</p>
            <p><strong>Nazwisko:</strong> {profile.last_name || 'Nie podano'}</p>
            <p>
              <strong>Data utworzenia konta:</strong>{' '}
              {profile.created_at
                ? new Date(profile.created_at).toLocaleString('pl-PL')
                : '—'}
            </p>
            <p>
              <strong>Ostatnia aktualizacja:</strong>{' '}
              {profile.updated_at
                ? new Date(profile.updated_at).toLocaleString('pl-PL')
                : '—'}
            </p>
          </section>

          {/* POWIĄZANIA */}
          <section
            style={{
              padding: 20,
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#ffffff',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Powiązania systemowe</h3>
            <p>
              <strong>ID pracownika:</strong>{' '}
              {profile.employee_id ?? 'Brak powiązania'}
            </p>
            <p>
              <strong>ID klienta:</strong>{' '}
              {profile.client_id ?? 'Brak powiązania'}
            </p>
            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
              Powiązania określają relację konta z modułami pracowników i klientów.
            </p>
          </section>
        </div>
      ) : (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: '1px dashed rgba(0,0,0,0.25)',
          }}
        >
          Brak danych profilu do wyświetlenia.
        </div>
      )}
    </div>
  );
};

export default ManagerProfilePage;
