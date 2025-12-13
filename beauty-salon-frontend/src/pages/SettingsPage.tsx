import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import "./SettingsPage.css";

import { getSystemSettings, patchSystemSettings, type SystemSettings } from "../api/systemSettings";
import { notify } from "../utils/notificationService";

import {
  WEEKDAYS,
  WEEKDAY_LABEL_PL,
  settingsToFormState,
  formStateToPatchPayload,
  validateSettingsForm,
  fingerprintForm,
  type SettingsFormErrors,
  type SettingsFormState,
  type Weekday,
} from "../utils/settingsMappers";

export default function SettingsPage(): ReactElement {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [errors, setErrors] = useState<SettingsFormErrors>({});
  const [baselineFingerprint, setBaselineFingerprint] = useState<string>("");

  useEffect((): (() => void) => {
    let cancelled: boolean = false;

    const run = async (): Promise<void> => {
      try {
        const data = await getSystemSettings();
        if (cancelled) return;

        const nextForm = settingsToFormState(data);
        setSettings(data);
        setForm(nextForm);

        const fp = fingerprintForm(nextForm);
        setBaselineFingerprint(fp);
        setErrors(validateSettingsForm(nextForm));
      } catch {
        notify("Nie udało się pobrać ustawień systemu.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return (): void => {
      cancelled = true;
    };
  }, []);

  const currentFingerprint = useMemo<string>(() => (form ? fingerprintForm(form) : ""), [form]);

  const isDirty = useMemo<boolean>(() => {
    if (!form) return false;
    if (!baselineFingerprint) return false;
    return currentFingerprint !== baselineFingerprint;
  }, [baselineFingerprint, currentFingerprint, form]);

  const hasErrors = useMemo<boolean>(() => Object.keys(errors).length > 0, [errors]);

  const setAndValidate = (updater: (prev: SettingsFormState) => SettingsFormState): void => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setErrors(validateSettingsForm(next));
      return next;
    });
  };

  const onText =
    (key: keyof SettingsFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const v = e.target.value;
      setAndValidate((prev) => ({ ...prev, [key]: v }));
    };

  const onCheckbox =
    (key: keyof SettingsFormState) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      const v = e.target.checked;
      setAndValidate((prev) => ({ ...prev, [key]: v }));
    };

  const onDepositNumber =
    (key: keyof SettingsFormState["deposit_policy"]) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      const raw = e.target.value;
      const n = raw === "" ? 0 : Number(raw);
      setAndValidate((prev) => ({
        ...prev,
        deposit_policy: {
          ...prev.deposit_policy,
          [key]: Number.isFinite(n) ? n : 0,
        },
      }));
    };

  const onDepositCheckbox =
    (key: keyof SettingsFormState["deposit_policy"]) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      const v = e.target.checked;
      setAndValidate((prev) => ({
        ...prev,
        deposit_policy: {
          ...prev.deposit_policy,
          [key]: v,
        },
      }));
    };

  const setDayClosed = (day: Weekday, closed: boolean): void => {
    setAndValidate((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: closed ? null : prev.opening_hours[day] ?? { open: "09:00", close: "17:00" },
      },
    }));
  };

  const setDayTime = (day: Weekday, field: "open" | "close", value: string): void => {
    setAndValidate((prev) => {
      const curr = prev.opening_hours[day];
      const nextDay = curr ?? { open: "09:00", close: "17:00" };

      return {
        ...prev,
        opening_hours: {
          ...prev.opening_hours,
          [day]: { ...nextDay, [field]: value },
        },
      };
    });
  };

  const onReset = (): void => {
    if (!settings) return;
    const next = settingsToFormState(settings);
    setForm(next);
    setErrors(validateSettingsForm(next));
    setBaselineFingerprint(fingerprintForm(next));
    notify("Przywrócono dane z backendu.", "info");
  };

  const onSave = async (): Promise<void> => {
    if (!form) return;

    const nextErrors = validateSettingsForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      notify("Popraw błędy w formularzu przed zapisem.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = formStateToPatchPayload(form);
      const updated = await patchSystemSettings(payload);

      setSettings(updated);

      const nextForm = settingsToFormState(updated);
      setForm(nextForm);

      const fp = fingerprintForm(nextForm);
      setBaselineFingerprint(fp);
      setErrors(validateSettingsForm(nextForm));

      notify("Ustawienia zapisane.", "success");
    } catch {
      notify("Nie udało się zapisać ustawień.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Ładowanie ustawień…</p>
      </div>
    );
  }

  if (!form || !settings) {
    return (
      <div className="settings-page">
        <div className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Ustawienia systemu</h3>
          </div>
          <div className="s-card__content">
            <div className="field-error">Brak danych ustawień (spróbuj odświeżyć).</div>
          </div>
        </div>
      </div>
    );
  }

  const lastBy = (settings as unknown as { last_modified_by_email?: string | null }).last_modified_by_email ?? "—";

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Ustawienia systemu</h1>
          <p className="settings-subtitle">
            Dostęp: <strong>manager</strong> • Endpoint: <strong>/api/settings/</strong>
          </p>
        </div>

        <div className="settings-meta">
          Ostatnia modyfikacja: {lastBy}
          <br />
          {new Date(settings.updated_at).toLocaleString()}
        </div>
      </div>

      <div className="settings-grid">
        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Dane salonu</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field">
                <label>Nazwa salonu</label>
                <input className="input" value={form.salon_name} onChange={onText("salon_name")} />
                {errors.salon_name ? <div className="field-error">{errors.salon_name}</div> : null}
              </div>

              <div className="field">
                <label>Email kontaktowy</label>
                <input className="input" value={form.contact_email} onChange={onText("contact_email")} />
                {errors.contact_email ? <div className="field-error">{errors.contact_email}</div> : null}
              </div>

              <div className="field row">
                <label>Adres</label>
                <input className="input" value={form.address} onChange={onText("address")} />
              </div>

              <div className="field">
                <label>Telefon</label>
                <input className="input" value={form.phone} onChange={onText("phone")} />
                {errors.phone ? <div className="field-error">{errors.phone}</div> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="s-card">
          <div className="s-card__header">
            <h3 className="s-card__title">Rezerwacje, podatki i konserwacja</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field">
                <label>Minimalny slot (min)</label>
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={form.slot_minutes}
                  onChange={(e) => setAndValidate((p) => ({ ...p, slot_minutes: e.target.value }))}
                />
                {errors.slot_minutes ? <div className="field-error">{errors.slot_minutes}</div> : null}
              </div>

              <div className="field">
                <label>Bufor między wizytami (min)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={240}
                  step={5}
                  value={form.buffer_minutes}
                  onChange={(e) => setAndValidate((p) => ({ ...p, buffer_minutes: e.target.value }))}
                />
                {errors.buffer_minutes ? <div className="field-error">{errors.buffer_minutes}</div> : null}
              </div>

              <div className="field">
                <label>Domyślna stawka VAT (%)</label>
                <input className="input" value={form.default_vat_rate} onChange={onText("default_vat_rate")} />
                {errors.default_vat_rate ? <div className="field-error">{errors.default_vat_rate}</div> : null}
              </div>

              <div className="field">
                <label>&nbsp;</label>
                <div className="switch-row">
                  <input type="checkbox" checked={form.maintenance_mode} onChange={onCheckbox("maintenance_mode")} />
                  <span>Tryb konserwacji</span>
                </div>
              </div>

              <div className="field row">
                <label>Komunikat konserwacji</label>
                <textarea className="textarea" value={form.maintenance_message} onChange={onText("maintenance_message")} />
              </div>
            </div>
          </div>
        </section>

        <section className="s-card" style={{ gridColumn: "1 / -1" }}>
          <div className="s-card__header">
            <h3 className="s-card__title">Polityka zaliczek</h3>
          </div>
          <div className="s-card__content">
            <div className="form-grid">
              <div className="field row">
                <div className="switch-row">
                  <input
                    type="checkbox"
                    checked={form.deposit_policy.require_deposit}
                    onChange={onDepositCheckbox("require_deposit")}
                  />
                  <span>Wymagaj zaliczki</span>
                </div>
              </div>

              <div className="field">
                <label>Domyślna zaliczka (%)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.deposit_policy.default_deposit_percent}
                  onChange={onDepositNumber("default_deposit_percent")}
                />
                {errors["deposit_policy.default_deposit_percent"] ? (
                  <div className="field-error">{errors["deposit_policy.default_deposit_percent"]}</div>
                ) : null}
              </div>

              <div className="field">
                <label>Darmowa anulacja do (godz.)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={720}
                  step={1}
                  value={form.deposit_policy.free_cancellation_hours}
                  onChange={onDepositNumber("free_cancellation_hours")}
                />
                {errors["deposit_policy.free_cancellation_hours"] ? (
                  <div className="field-error">{errors["deposit_policy.free_cancellation_hours"]}</div>
                ) : null}
              </div>

              <div className="field row">
                <div className="switch-row">
                  <input
                    type="checkbox"
                    checked={form.deposit_policy.forfeit_deposit_on_cancellation}
                    onChange={onDepositCheckbox("forfeit_deposit_on_cancellation")}
                  />
                  <span>Utrata zaliczki przy anulacji / no-show (włącz logikę kar)</span>
                </div>
              </div>

              <div className="field">
                <label>No-show: procent utraty zaliczki (%)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.deposit_policy.no_show_deposit_forfeit_percent}
                  onChange={onDepositNumber("no_show_deposit_forfeit_percent")}
                />
                {errors["deposit_policy.no_show_deposit_forfeit_percent"] ? (
                  <div className="field-error">{errors["deposit_policy.no_show_deposit_forfeit_percent"]}</div>
                ) : null}
              </div>

              <div className="field">
                <label>Późna anulacja: procent utraty zaliczki (%)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.deposit_policy.late_cancellation_deposit_forfeit_percent}
                  onChange={onDepositNumber("late_cancellation_deposit_forfeit_percent")}
                />
                {errors["deposit_policy.late_cancellation_deposit_forfeit_percent"] ? (
                  <div className="field-error">{errors["deposit_policy.late_cancellation_deposit_forfeit_percent"]}</div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="s-card" style={{ gridColumn: "1 / -1" }}>
          <div className="s-card__header">
            <h3 className="s-card__title">Godziny otwarcia</h3>
          </div>
          <div className="s-card__content">
            <div className="hint">Format backendu: {"{ Day: { open, close } | null }"}</div>
            {errors.opening_hours ? <div className="field-error">{errors.opening_hours}</div> : null}

            <div className="opening-grid" style={{ marginTop: 12 }}>
              {WEEKDAYS.map((day) => {
                const v = form.opening_hours[day];
                const closed = v === null;

                return (
                  <div className="opening-row" key={day}>
                    <div className="day-name">{WEEKDAY_LABEL_PL[day]}</div>

                    <label className="closed-toggle">
                      <input type="checkbox" checked={closed} onChange={(e) => setDayClosed(day, e.target.checked)} />
                      Zamknięte
                    </label>

                    <div className="time-pair">
                      <small>Otwarcie</small>
                      <input
                        className="input"
                        type="time"
                        value={closed ? "" : v?.open ?? ""}
                        disabled={closed}
                        onChange={(e) => setDayTime(day, "open", e.target.value)}
                      />
                    </div>

                    <div className="time-pair">
                      <small>Zamknięcie</small>
                      <input
                        className="input"
                        type="time"
                        value={closed ? "" : v?.close ?? ""}
                        disabled={closed}
                        onChange={(e) => setDayTime(day, "close", e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="actions-bar">
              <button className="btn btn-primary" onClick={() => void onSave()} disabled={saving || !isDirty || hasErrors}>
                {saving ? "Zapisywanie..." : "Zapisz"}
              </button>

              <button className="btn btn-ghost" onClick={onReset} disabled={saving || !isDirty}>
                Przywróć
              </button>

              <div className="actions-spacer" />

              <div className="hint">
                {hasErrors ? "Popraw błędy, aby zapisać." : isDirty ? "Masz niezapisane zmiany." : "Brak zmian."}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
