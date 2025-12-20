import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import styles from './SettingsPage.module.css';

import { getSystemSettings, patchSystemSettings, type SystemSettings } from '@/api/systemSettings.ts';
import { usersAPI } from "@/api";
import { notify } from '@/utils/notificationService.ts';

import {
  settingsToFormState,
  formStateToPatchPayload,
  validateSettingsForm,
  fingerprintForm,
  WEEKDAYS,
  WEEKDAY_LABEL_PL,
  type SettingsFormState,
  type OpeningHoursDay,
} from '@/utils/settingsMappers.ts';

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

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

    const load = async () => {
      try {
        setLoading(true);
        const s = await getSystemSettings();
        if (cancelled) return;

        setSettings(s);
        const f = settingsToFormState(s);
        setForm(f);
      } catch {
        notify('Nie udało się pobrać ustawień systemu.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const fp = useMemo(() => (form ? fingerprintForm(form) : ''), [form]);

  const initialFp = useMemo(() => {
    if (!settings) return '';
    return fingerprintForm(settingsToFormState(settings));
  }, [settings]);

  const hasChanges = useMemo(() => {
    if (!form) return false;
    return fp !== initialFp;
  }, [fp, initialFp, form]);

  const onText = (key: keyof SettingsFormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!form) return;
    setForm({ ...form, [key]: e.target.value } as SettingsFormState);
  };

  const onBool = (key: keyof SettingsFormState) => (e: ChangeEvent<HTMLInputElement>) => {
    if (!form) return;
    setForm({ ...form, [key]: e.target.checked } as SettingsFormState);
  };

  const setOpeningHour = (day: (typeof WEEKDAYS)[number], value: OpeningHoursDay) => {
    if (!form) return;
    setForm({
      ...form,
      opening_hours: {
        ...form.opening_hours,
        [day]: value,
      },
    });
  };

  const saveSettings = async () => {
    if (!form) return;

    const errors = validateSettingsForm(form);
    setSubmitErrors(errors);

    if (Object.keys(errors).length > 0) {
      notify('Popraw błędy w formularzu.', 'info');
      return;
    }

    try {
      setSaving(true);
      const payload = formStateToPatchPayload(form);
      const updated = await patchSystemSettings(payload);

      setSettings(updated);
      setForm(settingsToFormState(updated));
      notify('Zapisano ustawienia.', 'success');
    } catch {
      notify('Nie udało się zapisać ustawień.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    try {
      setChangingPassword(true);
      await usersAPI.changePassword({ old_password: oldPassword, new_password: newPassword });
      setOldPassword('');
      setNewPassword('');
      notify('Hasło zostało zmienione.', 'success');
    } catch {
      notify('Nie udało się zmienić hasła.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !form) {
    return (
      <div className={styles.settingsPage}>
        <div className={styles.sCard}>
          <div className={styles.sCardHeader}>
            <div className={styles.sCardTitle}>Ustawienia</div>
          </div>
          <div className={styles.sCardContent}>Ładowanie…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsPage}>
      <div className={styles.settingsHeader}>
        <div>
          <h1 className={styles.settingsTitle}>Ustawienia systemowe</h1>
          <p className={styles.settingsSubtitle}>Konfiguracja globalnych parametrów salonu</p>
        </div>

        <div className={styles.settingsMeta}>
          <div>{hasChanges ? 'Masz niezapisane zmiany' : 'Brak zmian'}</div>
        </div>
      </div>

      <div className={styles.settingsGrid}>
        {/* Salon */}
        <div className={styles.sCard}>
          <div className={styles.sCardHeader}>
            <div className={styles.sCardTitle}>Dane salonu</div>
          </div>

          <div className={styles.sCardContent}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Nazwa salonu</label>
                <input className={styles.input} value={form.salon_name} onChange={onText('salon_name')} />
                {submitErrors.salon_name ? <div className={styles.fieldError}>{submitErrors.salon_name}</div> : null}
              </div>

              <div className={styles.field}>
                <label>Adres</label>
                <input className={styles.input} value={form.address} onChange={onText('address')} />
              </div>

              <div className={styles.field}>
                <label>Telefon</label>
                <input className={styles.input} value={form.phone} onChange={onText('phone')} />
                {submitErrors.phone ? <div className={styles.fieldError}>{submitErrors.phone}</div> : null}
              </div>

              <div className={styles.field}>
                <label>Email kontaktowy</label>
                <input className={styles.input} value={form.contact_email} onChange={onText('contact_email')} />
                {submitErrors.contact_email ? (
                  <div className={styles.fieldError}>{submitErrors.contact_email}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Rezerwacje */}
        <div className={styles.sCard}>
          <div className={styles.sCardHeader}>
            <div className={styles.sCardTitle}>Rezerwacje</div>
          </div>

          <div className={styles.sCardContent}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Długość slotu (min)</label>
                <input className={styles.input} value={form.slot_minutes} onChange={onText('slot_minutes')} />
                {submitErrors.slot_minutes ? (
                  <div className={styles.fieldError}>{submitErrors.slot_minutes}</div>
                ) : null}
              </div>

              <div className={styles.field}>
                <label>Bufor między wizytami (min)</label>
                <input className={styles.input} value={form.buffer_minutes} onChange={onText('buffer_minutes')} />
                {submitErrors.buffer_minutes ? (
                  <div className={styles.fieldError}>{submitErrors.buffer_minutes}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Podatki */}
        <div className={styles.sCard}>
          <div className={styles.sCardHeader}>
            <div className={styles.sCardTitle}>Podatki</div>
          </div>

          <div className={styles.sCardContent}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Domyślny VAT (%)</label>
                <input className={styles.input} value={form.default_vat_rate} onChange={onText('default_vat_rate')} />
                {submitErrors.default_vat_rate ? (
                  <div className={styles.fieldError}>{submitErrors.default_vat_rate}</div>
                ) : null}
                <p className={styles.hint}>Backend oczekuje stringa np. „23.00”.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Konserwacja */}
        <div className={styles.sCard}>
          <div className={styles.sCardHeader}>
            <div className={styles.sCardTitle}>Konserwacja</div>
          </div>

          <div className={styles.sCardContent}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Tryb konserwacji</label>
                <div className={styles.switchRow}>
                  <input
                    id="maintenance_mode"
                    type="checkbox"
                    checked={form.maintenance_mode}
                    onChange={onBool('maintenance_mode')}
                  />
                  <label htmlFor="maintenance_mode">Włącz</label>
                </div>
              </div>

              <div className={styles.field}>
                <label>Komunikat konserwacji</label>
                <textarea
                  className={styles.textarea}
                  value={form.maintenance_message}
                  onChange={onText('maintenance_message')}
                  rows={3}
                />
                {submitErrors.maintenance_message ? (
                  <div className={styles.fieldError}>{submitErrors.maintenance_message}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Godziny otwarcia */}
        <div className={styles.sCard}>
          <div className={styles.sCardHeader}>
            <div className={styles.sCardTitle}>Godziny otwarcia</div>
          </div>

          <div className={styles.sCardContent}>
            <div className={styles.openingGrid}>
              {WEEKDAYS.map((day) => {
                const v = form.opening_hours[day];
                const isClosed = v === null;

                return (
                  <div key={day} className={styles.openingRow}>
                    <div className={styles.dayName}>{WEEKDAY_LABEL_PL[day]}</div>

                    <div className={styles.timePair}>
                      <input
                        className={styles.input}
                        type="time"
                        value={v?.open ?? '08:00'}
                        disabled={isClosed}
                        onChange={(e) => setOpeningHour(day, { open: e.target.value, close: v?.close ?? '16:00' })}
                      />
                      <span>–</span>
                      <input
                        className={styles.input}
                        type="time"
                        value={v?.close ?? '16:00'}
                        disabled={isClosed}
                        onChange={(e) => setOpeningHour(day, { open: v?.open ?? '08:00', close: e.target.value })}
                      />
                    </div>

                    <div className={styles.closedToggle}>
                      <label>
                        <input
                          type="checkbox"
                          checked={isClosed}
                          onChange={(e) => setOpeningHour(day, e.target.checked ? null : { open: '08:00', close: '16:00' })}
                        />
                        Zamknięte
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {submitErrors.opening_hours ? <div className={styles.fieldError}>{submitErrors.opening_hours}</div> : null}
          </div>
        </div>

        {/* Zmiana hasła */}
        <div className={styles.sCard}>
          <div className={styles.sCardHeader}>
            <div className={styles.sCardTitle}>Zmiana hasła</div>
          </div>

          <div className={styles.sCardContent}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Stare hasło</label>
                <input
                  className={styles.input}
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>Nowe hasło</label>
                <input
                  className={styles.input}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.actionsBar}>
              <div className={styles.actionsSpacer} />
              <button
                type="button"
                className={cx(styles.btn, styles.btnPrimary)}
                disabled={changingPassword || !oldPassword || !newPassword}
                onClick={() => void changePassword()}
              >
                {changingPassword ? 'Zmieniam…' : 'Zmień hasło'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actionsBar}>
        <div className={styles.actionsSpacer} />
        <button
          type="button"
          className={cx(styles.btn, styles.btnGhost)}
          disabled={!hasChanges || saving}
          onClick={() => {
            if (!settings) return;
            setForm(settingsToFormState(settings));
            setSubmitErrors({});
          }}
        >
          Cofnij zmiany
        </button>

        <button
          type="button"
          className={cx(styles.btn, styles.btnPrimary)}
          disabled={!hasChanges || saving}
          onClick={() => void saveSettings()}
        >
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </div>
    </div>
  );
}
