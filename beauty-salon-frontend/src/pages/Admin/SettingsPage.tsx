import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";

import { systemSettingsApi } from "@/api/systemSettings";
import type { SystemSettings } from "@/types";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Poniedziałek" },
  { key: "tue", label: "Wtorek" },
  { key: "wed", label: "Środa" },
  { key: "thu", label: "Czwartek" },
  { key: "fri", label: "Piątek" },
  { key: "sat", label: "Sobota" },
  { key: "sun", label: "Niedziela" },
];

function ensureOpeningHours(
  oh: SystemSettings["opening_hours"] | undefined
): Record<DayKey, Array<{ start: string; end: string }>> {
  const base: Record<DayKey, Array<{ start: string; end: string }>> = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };

  if (!oh || typeof oh !== "object") return base;

  for (const day of Object.keys(base) as DayKey[]) {
    const arr = (oh as any)[day];
    if (Array.isArray(arr)) base[day] = arr;
  }

  return base;
}

function isValidTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function errMsg(e: any) {
  const d = e?.response?.data;
  if (typeof d?.detail === "string") return d.detail;
  if (d && typeof d === "object") {
    const k = Object.keys(d)[0];
    const v = d[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string") return v;
  }
  return e?.message || "Błąd";
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [openingHours, setOpeningHours] = useState<
    Record<DayKey, Array<{ start: string; end: string }>>
  >({
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      setMsg(null);
      setLoading(true);

      const data = await systemSettingsApi.get();
      setSettings(data);
      setOpeningHours(ensureOpeningHours(data.opening_hours));
    } catch (e: any) {
      setError(errMsg(e) || "Nie udało się pobrać ustawień systemowych.");
      setSettings(null);
      setOpeningHours({
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleBasicChange =
    (field: "salon_name" | "slot_minutes" | "buffer_minutes") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!settings) return;
      const raw = e.target.value;

      setSettings({
        ...settings,
        [field]: field === "salon_name" ? raw : Number(raw),
      } as SystemSettings);
    };

  const addSlot = (day: DayKey) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: [...prev[day], { start: "09:00", end: "17:00" }],
    }));
  };

  const removeSlot = (day: DayKey, idx: number) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== idx),
    }));
  };

  const updateSlot = (day: DayKey, idx: number, field: "start" | "end", value: string) => {
    setOpeningHours((prev) => {
      const next = { ...prev };
      next[day] = next[day].map((slot, i) => (i === idx ? { ...slot, [field]: value } : slot));
      return next;
    });
  };

  const validationMessage = useMemo(() => {
    if (settings) {
      if (Number.isNaN(Number(settings.slot_minutes)) || Number(settings.slot_minutes) < 5) {
        return "Długość slotu musi być liczbą >= 5.";
      }
      if (Number.isNaN(Number(settings.buffer_minutes)) || Number(settings.buffer_minutes) < 0) {
        return "Bufor musi być liczbą >= 0.";
      }
    }

    for (const day of Object.keys(openingHours) as DayKey[]) {
      for (const slot of openingHours[day]) {
        if (!isValidTime(slot.start) || !isValidTime(slot.end)) {
          return "Godziny muszą mieć format HH:MM (np. 09:00).";
        }
        if (timeToMinutes(slot.start) >= timeToMinutes(slot.end)) {
          return "Godzina rozpoczęcia musi być wcześniejsza niż zakończenia.";
        }
      }
    }
    return null;
  }, [openingHours, settings]);

  const canSave = !!settings && !validationMessage;

  const handleSave = async () => {
    if (!settings) return;

    try {
      setError(null);
      setMsg(null);
      setSaving(true);

      const payload = {
        salon_name: settings.salon_name,
        slot_minutes: settings.slot_minutes,
        buffer_minutes: settings.buffer_minutes,
        opening_hours: openingHours,
      };

      const saved = await systemSettingsApi.update(payload);

      setSettings(saved);
      setOpeningHours(ensureOpeningHours(saved.opening_hours));
      setMsg("Ustawienia zapisane.");
    } catch (e: any) {
      setError(errMsg(e) || "Błąd podczas zapisywania ustawień.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!settings) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Brak danych ustawień.</Alert>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => void load()}>
            Spróbuj ponownie
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Ustawienia systemowe
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {msg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      )}

      {validationMessage && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {validationMessage}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nazwa salonu"
                value={settings.salon_name ?? ""}
                onChange={handleBasicChange("salon_name")}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Długość slotu (min)"
                type="number"
                inputProps={{ min: 5, step: 5 }}
                value={settings.slot_minutes ?? 30}
                onChange={handleBasicChange("slot_minutes")}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Bufor między wizytami (min)"
                type="number"
                inputProps={{ min: 0, step: 5 }}
                value={settings.buffer_minutes ?? 0}
                onChange={handleBasicChange("buffer_minutes")}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Godziny otwarcia
          </Typography>

          <Stack spacing={2}>
            {DAYS.map(({ key, label }) => {
              const slots = openingHours[key];
              const isClosed = slots.length === 0;

              return (
                <Box key={key} sx={{ border: "1px solid #eee", borderRadius: 2, p: 2 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                    spacing={1}
                    sx={{ mb: 1 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">{label}</Typography>
                      {isClosed && <Chip size="small" label="Zamknięte" />}
                    </Stack>

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => addSlot(key)}
                    >
                      Dodaj przedział
                    </Button>
                  </Stack>

                  {slots.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Brak godzin — dzień jest zamknięty.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {slots.map((slot, idx) => (
                        <Stack
                          key={`${key}-${idx}`}
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          alignItems={{ xs: "stretch", md: "center" }}
                        >
                          <TextField
                            label="Start"
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateSlot(key, idx, "start", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ step: 300 }}
                            error={!isValidTime(slot.start)}
                            sx={{ width: { md: 180 } }}
                          />
                          <TextField
                            label="Koniec"
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateSlot(key, idx, "end", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ step: 300 }}
                            error={!isValidTime(slot.end)}
                            sx={{ width: { md: 180 } }}
                          />

                          <IconButton
                            aria-label="Usuń przedział"
                            color="error"
                            onClick={() => removeSlot(key, idx)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!canSave || saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Zapisywanie..." : "Zapisz"}
            </Button>

            <Button variant="outlined" onClick={() => void load()} disabled={saving}>
              Odśwież
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
