import React, { useCallback, useEffect, useState, type ReactElement } from 'react';
import { employeesAPI } from '../../api/employees';
import type { Employee } from '../../types';
import { Modal } from '../../components/UI/Modal';
import { useNotification } from '../../components/UI/Notification';
import { useAuth } from '../../hooks/useAuth';

export const MyProfilePage: React.FC = (): ReactElement => {
  const { isEmployee } = useAuth();
  const { showNotification } = useNotification();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [errorModalOpen, setErrorModalOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await employeesAPI.me();
      setEmployee(res.data);
    } catch (e) {
      console.error(e);
      setErrorMessage('Nie udało się pobrać profilu pracownika.');
      setErrorModalOpen(true);
      showNotification('Nie udało się pobrać profilu.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    if (isEmployee) {
      void loadProfile();
    }
  }, [isEmployee, loadProfile]);

  if (!isEmployee) {
    return <div style={{ padding: 20 }}>Dostęp tylko dla pracownika.</div>;
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Ładowanie profilu…</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1>Mój profil</h1>

      {!employee ? (
        <div style={{ marginTop: 12 }}>
          <p>Brak danych profilu.</p>
          <button
            type="button"
            onClick={() => void loadProfile()}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #ccc',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Odśwież
          </button>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Imię i nazwisko</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {employee.first_name} {employee.last_name}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Email</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {employee.user_email ?? '—'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Telefon</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{employee.phone || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Numer pracownika</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{employee.number || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Zatrudniony od</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{employee.hired_at || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Status</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: employee.is_active ? 'green' : 'red' }}>
                {employee.is_active ? 'Aktywny' : 'Nieaktywny'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Usługi / Umiejętności</div>

            {employee.skills && employee.skills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {employee.skills.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: '1px solid #f3c4cc',
                      background: '#fff0f3',
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#5a2a35',
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontWeight: 600 }}>Brak przypisanych usług.</div>
            )}
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => void loadProfile()}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #ccc',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Odśwież
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} title="Wystąpił błąd">
        <div style={{ padding: 12 }}>
          <p style={{ marginTop: 0 }}>{errorMessage}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => {
                setErrorModalOpen(false);
                void loadProfile();
              }}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Spróbuj ponownie
            </button>
            <button
              type="button"
              onClick={() => setErrorModalOpen(false)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer' }}
            >
              Zamknij
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyProfilePage;
