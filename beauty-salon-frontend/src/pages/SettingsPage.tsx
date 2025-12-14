import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import './SettingsPage.css';

import { getSystemSettings, patchSystemSettings, type SystemSettings } from '../api/systemSettings';
import { usersAPI } from '../api';
import { notify } from '../utils/notificationService';

import {
  settingsToFormState,
  formStateToPatchPayload,
  type SettingsFormState,
} from '../utils/settingsMappers';

export default function SettingsPage(): ReactElement {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const data = await getSystemSettings();
        if (cancelled) return;
        setSettings(data);
        setForm(settingsToFormState(data));
      } catch {
        notify('Nie udało się pobrać ustawień.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onText =
    (key: keyof SettingsFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      if (!form) return;
      setForm({ ...form, [key]: e.target.value });
    };

  const onSave = async (): Promise<void> => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = formStateToPatchPayload(form);
      const updated = await patchSystemSettings(payload);
      setSettings(updated);
      setForm(settingsToFormState(updated));
      notify('Ustawienia zapisane.', 'success');
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (): Promise<void> => {
    setChangingPassword(true);
    try {
      await usersAPI.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      notify('Hasło zmienione.', 'success');
      setOldPassword('');
      setNewPassword('');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !form || !settings) {
    return <div style={{ padding: 20 }}>Ładowanie ustawień…</div>;
  }

  return (
    <div className="settings-page">
      <h1>Ustawienia systemu</h1>

      <section className="s-card">
        <h3>Dane salonu</h3>
        <input value={form.salon_name} onChange={onText('salon_name')} />
        <input value={form.contact_email} onChange={onText('contact_email')} />
        <input value={form.phone} onChange={onText('phone')} />
        <textarea value={form.address} onChange={onText('address')} />
      </section>

      <button disabled={saving} onClick={onSave}>
        Zapisz
      </button>

      <section className="s-card">
        <h3>Zmiana hasła</h3>
        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <button onClick={onChangePassword} disabled={changingPassword}>
          Zmień hasło
        </button>
      </section>
    </div>
  );
}
