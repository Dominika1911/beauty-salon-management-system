import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import './SettingsPage.css';

import { getSystemSettings, patchSystemSettings, type SystemSettings } from '../api/systemSettings';
import { usersAPI } from '../api';
import { notify } from '../utils/notificationService';

import {
  settingsToFormState,
  formStateToPatchPayload,
  validateSettingsForm,
  fingerprintForm,
  WEEKDAYS,
  WEEKDAY_LABEL_PL,
  type SettingsFormState,
  type OpeningHoursDay,
} from '../utils/settingsMappers';

type ErrorMap = Record<string, string>;

export default function SettingsPage(): ReactElement {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [submitErrors, setSubmitErrors] = useState<ErrorMap>({});

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

  const computedErrors: ErrorMap = useMemo(() => {
    if (!form) return {};
    return validateSettingsForm(form) as unknown as ErrorMap;
  }, [form]);

  const baselineFingerprint = useMemo(() => {
    if (!settings) return '';
    return fingerprintForm(settingsToFormState(settings));
  }, [settings]);

  const currentFingerprint = useMemo(() => {
    if (!form) return '';
    return fingerprintForm(form);
  }, [form]);

  const isDirty = baselineFingerprint !== '' && currentFingerprint !== '' && baselineFingerprint !== currentFingerprint;

  const onText =
    (key: keyof SettingsFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      if (!form) return;
      setForm({ ...form, [key]: e.target.value });
    };

  const onCheckbox =
    (key: keyof SettingsFormState) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (!form) return;
      setForm({ ...form, [key]: e.target.checked } as SettingsFormState);
    };

  const onDepositNumber =
    (
      key:
        | 'default_deposit_percent'
        | 'free_cancellation_hours'
        | 'no_show_deposit_forfeit_percent'
        | 'late_cancellation_deposit_forfeit_percent'
    ) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (!form) return;
      const value = Number(e.target.value);
      setForm({
        ...form,
        deposit_policy: {
          ...form.deposit_policy,
          [key]: Number.isFinite(value) ? value : 0,
        },
      });
    };

  const onDepositBool =
    (key: 'require_deposit' | 'forfeit_deposit_on_cancellation') =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (!form) return;
      setForm({
        ...form,
        deposit_policy: {
          ...form.deposit_policy,
          [key]: e.target.checked,
        },
      });
    };

  const onOpeningClosed =
    (day: (typeof WEEKDAYS)[number]) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (!form) return;
      const closed = e.target.checked;
      const next: OpeningHoursDay = closed ? null : { open: '09:00', close: '17:00' };
      setForm({
        ...form,
        opening_hours: {
          ...form.opening_hours,
          [day]: next,
        },
      });
    };

  const onOpeningTime =
    (day: (typeof WEEKDAYS)[number], which: 'open' | 'close') =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      if (!form) return;
      const current = form.opening_hours[day];
      if (current === null) return;
      setForm({
        ...form,
        opening_hours: {
          ...form.opening_hours,
          [day]: { ...current, [which]: e.target.value },
        },
      });
    };

  const onReset = (): void => {
    if (!settings) return;
    setForm(settingsToFormState(settings));
    setSubmitErrors({});
    notify('Przywrócono wartości z bazy.', 'success');
  };

  const onSave = async (): Promise<void> => {
    if (!form) return;

    const errs = validateSettingsForm(form) as unknown as ErrorMap;
    setSubmitErrors(errs);
    if (Object.keys(errs).length > 0) {
      notify('Popraw błędy w formularzu przed zapisaniem.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = formStateToPatchPayload(form);
      const updated = await patchSystemSettings(payload);
      setSettings(updated);
      setForm(settingsToFormState(updated));
      setSubmitErrors({});
      notify('Ustawienia zapisane.', 'success');
    } catch {
      notify('Nie udało się zapisać ustawień.', 'error');
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
    } catch {
      notify('Nie udało się zmienić hasła.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !form || !settings) {
    return <div style={{ padding: 20 }}>Ładowanie ustawień…</div>;
  }

  const showErr = (key: string): string | null => submitErrors[key] ?? computedErrors[key] ?? null;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Ustawienia systemu</h1>
          <p className="settings-subtitle">Konfiguracja salonu, rezerwacji, podatków i trybu konserwacji.</p>
        </div>
        <div className="settings-meta">
          <div>Ostatnia zmiana: {new Date(settings.updated_at).toLocaleString('pl-PL')}</div>
          {settings.last_modified_by_email ? <div>Przez: {settings.last_modified_by_email}</div> : null}
        </div>
      </div>

      <div className="settings-grid">
        {/* Dane salonu */}
        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Dane salonu</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field row">
                <label>Nazwa salonu</label>
                <input className="input" value={form.salon_name} onChange={onText('salon_name')} />
                {showErr('salon_name') ? <div className="field-error">{showErr('salon_name')}</div> : null}
              </div>

              <div className="field">
                <label>Email kontaktowy</label>
                <input className="input" value={form.contact_email} onChange={onText('contact_email')} />
                {showErr('contact_email') ? <div className="field-error">{showErr('contact_email')}</div> : null}
              </div>

              <div className="field">
                <label>Telefon</label>
                <input className="input" value={form.phone} onChange={onText('phone')} />
                {showErr('phone') ? <div className="field-error">{showErr('phone')}</div> : null}
              </div>

              <div className="field row">
                <label>Adres</label>
                <textarea className="textarea" value={form.address} onChange={onText('address')} />
              </div>
            </div>
          </div>
        </section>

        {/* Rezerwacje + VAT */}
        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Rezerwacje i podatki</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field">
                <label>Długość slotu (min)</label>
                <input className="input" value={form.slot_minutes} onChange={onText('slot_minutes')} />
                {showErr('slot_minutes') ? <div className="field-error">{showErr('slot_minutes')}</div> : null}
              </div>

              <div className="field">
                <label>Bufor między wizytami (min)</label>
                <input className="input" value={form.buffer_minutes} onChange={onText('buffer_minutes')} />
                {showErr('buffer_minutes') ? <div className="field-error">{showErr('buffer_minutes')}</div> : null}
              </div>

              <div className="field">
                <label>Domyślny VAT (%)</label>
                <input className="input" value={form.default_vat_rate} onChange={onText('default_vat_rate')} />
                {showErr('default_vat_rate') ? <div className="field-error">{showErr('default_vat_rate')}</div> : null}
              </div>
            </div>
          </div>
        </section>

        {/* Polityka zadatku */}
        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Polityka zadatku / anulowania</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field row">
                <label className="switch-row">
                  <input type="checkbox" checked={form.deposit_policy.require_deposit} onChange={onDepositBool('require_deposit')} />
                  <span>Wymagaj zadatku przy rezerwacji</span>
                </label>
              </div>

              <div className="field">
                <label>Domyślny zadatek (%)</label>
                <input className="input" value={String(form.deposit_policy.default_deposit_percent)} onChange={onDepositNumber('default_deposit_percent')} />
                {showErr('deposit_policy.default_deposit_percent') ? (
                  <div className="field-error">{showErr('deposit_policy.default_deposit_percent')}</div>
                ) : null}
              </div>

              <div className="field">
                <label>Darmowe anulowanie (godz.)</label>
                <input className="input" value={String(form.deposit_policy.free_cancellation_hours)} onChange={onDepositNumber('free_cancellation_hours')} />
                {showErr('deposit_policy.free_cancellation_hours') ? (
                  <div className="field-error">{showErr('deposit_policy.free_cancellation_hours')}</div>
                ) : null}
              </div>

              <div className="field row">
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={form.deposit_policy.forfeit_deposit_on_cancellation}
                    onChange={onDepositBool('forfeit_deposit_on_cancellation')}
                  />
                  <span>Przepadek zadatku przy anulowaniu po czasie</span>
                </label>
              </div>

              <div className="field">
                <label>No-show: przepadek (%)</label>
                <input className="input" value={String(form.deposit_policy.no_show_deposit_forfeit_percent)} onChange={onDepositNumber('no_show_deposit_forfeit_percent')} />
                {showErr('deposit_policy.no_show_deposit_forfeit_percent') ? (
                  <div className="field-error">{showErr('deposit_policy.no_show_deposit_forfeit_percent')}</div>
                ) : null}
              </div>

              <div className="field">
                <label>Późne anulowanie: przepadek (%)</label>
                <input
                  className="input"
                  value={String(form.deposit_policy.late_cancellation_deposit_forfeit_percent)}
                  onChange={onDepositNumber('late_cancellation_deposit_forfeit_percent')}
                />
                {showErr('deposit_policy.late_cancellation_deposit_forfeit_percent') ? (
                  <div className="field-error">{showErr('deposit_policy.late_cancellation_deposit_forfeit_percent')}</div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Godziny otwarcia */}
        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Godziny otwarcia</h3>
          </div>
          <div className="s-card__content">
            <div className="opening-grid">
              {WEEKDAYS.map((day) => {
                const v = form.opening_hours[day];
                const isClosed = v === null;
                return (
                  <div className="opening-row" key={day}>
                    <div className="day-name">{WEEKDAY_LABEL_PL[day]}</div>
                    <label className="closed-toggle">
                      <input type="checkbox" checked={isClosed} onChange={onOpeningClosed(day)} />
                      Zamknięte
                    </label>
                    <div className="time-pair">
                      <small>Otwarcie</small>
                      <input
                        className="input"
                        type="time"
                        value={v ? v.open : '09:00'}
                        onChange={onOpeningTime(day, 'open')}
                        disabled={isClosed}
                      />
                    </div>
                    <div className="time-pair">
                      <small>Zamknięcie</small>
                      <input
                        className="input"
                        type="time"
                        value={v ? v.close : '17:00'}
                        onChange={onOpeningTime(day, 'close')}
                        disabled={isClosed}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {showErr('opening_hours') ? <div className="field-error" style={{ marginTop: 8 }}>{showErr('opening_hours')}</div> : null}
          </div>
        </section>

        {/* Tryb konserwacji */}
        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Tryb konserwacji</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field row">
                <label className="switch-row">
                  <input type="checkbox" checked={form.maintenance_mode} onChange={onCheckbox('maintenance_mode')} />
                  <span>Włącz tryb konserwacji</span>
                </label>
              </div>
              <div className="field row">
                <label>Komunikat dla użytkowników</label>
                <textarea className="textarea" value={form.maintenance_message} onChange={onText('maintenance_message')} />
                {showErr('maintenance_message') ? <div className="field-error">{showErr('maintenance_message')}</div> : null}
              </div>
            </div>
          </div>
        </section>

        {/* Zmiana hasła */}
        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Zmiana hasła</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field">
                <label>Stare hasło</label>
                <input className="input" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
              </div>
              <div className="field">
                <label>Nowe hasło</label>
                <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => void onChangePassword()} disabled={changingPassword || !oldPassword || !newPassword}>
                Zmień hasło
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="actions-bar">
        <button className="btn btn-ghost" onClick={onReset} disabled={saving || !isDirty}>
          Cofnij zmiany
        </button>
        <div className="actions-spacer" />
        <div className="hint">
          {Object.keys(computedErrors).length > 0 ? 'Formularz zawiera błędy.' : isDirty ? 'Masz niezapisane zmiany.' : 'Brak zmian.'}
        </div>
        <button className="btn btn-primary" onClick={() => void onSave()} disabled={saving || !isDirty || Object.keys(computedErrors).length > 0}>
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </div>
    </div>
  );
}
