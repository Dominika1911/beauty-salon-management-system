import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { Service } from "../../types";
import {
  getServices,
  createService,
  updateService,
  disableService,
  enableService,
} from "../../api/services";

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

type FormState = {
  name: string;
  category: string;
  description: string;
  price: string;
  duration_minutes: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  category: "",
  description: "",
  price: "0",
  duration_minutes: "30",
  is_active: true,
};

export default function ServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // dialog
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await getServices();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEdit(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEdit(s);
    setForm({
      name: s.name ?? "",
      category: s.category ?? "",
      description: s.description ?? "",
      price: String(s.price ?? "0"),
      duration_minutes: String(s.duration_minutes ?? 30),
      is_active: !!s.is_active,
    });
    setOpen(true);
  }

  async function save() {
    setMsg("");
    setErr("");

    // prosta walidacja
    if (!form.name.trim()) {
      setErr("Nazwa jest wymagana.");
      return;
    }
    const price = Number(form.price);
    const dur = Number(form.duration_minutes);
    if (Number.isNaN(price) || price < 0) {
      setErr("Cena musi być liczbą >= 0.");
      return;
    }
    if (Number.isNaN(dur) || dur < 5) {
      setErr("Czas trwania musi być >= 5 minut.");
      return;
    }

    try {
      if (edit) {
        await updateService(edit.id, {
          name: form.name.trim(),
          category: form.category.trim(),
          description: form.description,
          price: form.price,
          duration_minutes: dur,
          is_active: form.is_active,
        });
        setMsg("Zapisano zmiany.");
      } else {
        await createService({
          name: form.name.trim(),
          category: form.category.trim(),
          description: form.description,
          price: form.price,
          duration_minutes: dur,
          is_active: form.is_active,
        });
        setMsg("Dodano usługę.");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      setErr(errMsg(e));
    }
  }

  async function toggleActive(s: Service) {
    setMsg("");
    setErr("");
    try {
      if (s.is_active) {
        await disableService(s.id);
        setMsg(`Wyłączono usługę: ${s.name}`);
      } else {
        await enableService(s.id);
        setMsg(`Włączono usługę: ${s.name}`);
      }
      await load();
    } catch (e: any) {
      setErr(errMsg(e));
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Usługi</Typography>
        <Button variant="contained" onClick={openCreate}>
          Dodaj usługę
        </Button>
      </Stack>

      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Szukaj (nazwa/kategoria)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <Divider />

          {loading ? (
            <Typography>Ładowanie...</Typography>
          ) : filtered.length === 0 ? (
            <Alert severity="info">Brak usług.</Alert>
          ) : (
            <Stack spacing={1}>
              {filtered.map((s) => (
                <Paper key={s.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={600}>{s.name}</Typography>
                        <Chip
                          size="small"
                          label={s.is_active ? "active" : "disabled"}
                          color={s.is_active ? "success" : "default"}
                        />
                        {s.category && <Chip size="small" label={s.category} />}
                      </Stack>

                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {s.duration_minutes} min • {s.price} zł
                      </Typography>

                      {!!s.description && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {s.description}
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" onClick={() => openEdit(s)}>
                        Edytuj
                      </Button>
                      <Button
                        variant="outlined"
                        color={s.is_active ? "error" : "success"}
                        onClick={() => toggleActive(s)}
                      >
                        {s.is_active ? "Wyłącz" : "Włącz"}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Dialog create/edit */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{edit ? "Edytuj usługę" : "Dodaj usługę"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nazwa"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <TextField
              label="Kategoria"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            />
            <TextField
              label="Opis"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              multiline
              minRows={3}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Cena (zł)"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Czas (min)"
                value={form.duration_minutes}
                onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Anuluj</Button>
          <Button variant="contained" onClick={save}>
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
