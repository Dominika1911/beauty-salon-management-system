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
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  Pagination,
} from "@mui/material";

import type { Service } from "@/types";
import { servicesApi } from "@/api/services";

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

type SortKey = "name" | "price" | "duration_minutes" | "created_at";
type SortDir = "asc" | "desc";

export default function ServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // backend params
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isActiveFilter, setIsActiveFilter] =
    useState<"all" | "active" | "disabled">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [pageSize, setPageSize] = useState<number | null>(null);

  const pageCount = useMemo(() => {
    const ps = pageSize ?? 10;
    return Math.max(1, Math.ceil(count / ps));
  }, [count, pageSize]);

  const orderingParam = useMemo(() => {
    return sortDir === "desc" ? `-${sortKey}` : sortKey;
  }, [sortKey, sortDir]);

  const is_active_param = useMemo(() => {
    if (isActiveFilter === "all") return undefined;
    return isActiveFilter === "active";
  }, [isActiveFilter]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await servicesApi.list({
        page,
        search: query.trim() || undefined,
        ordering: orderingParam,
        is_active: is_active_param,
        category: categoryFilter.trim() || undefined,
      });

      setItems(res.results || []);
      setCount(res.count ?? 0);

      if (page === 1 && res.results?.length) {
        setPageSize(res.results.length);
      }
    } catch (e: any) {
      setErr(errMsg(e));
      setItems([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, orderingParam, query, is_active_param, categoryFilter]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isActiveFilter, categoryFilter, orderingParam]);

  function openCreate() {
    setEdit(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEditDialog(s: Service) {
    setEdit(s);
    setForm({
      name: s.name,
      category: s.category ?? "",
      description: s.description ?? "",
      price: String(s.price),
      duration_minutes: String(s.duration_minutes),
      is_active: s.is_active,
    });
    setOpen(true);
  }

  async function save() {
    setMsg("");
    setErr("");

    if (!form.name.trim()) {
      setErr("Nazwa jest wymagana.");
      return;
    }

    const priceNum = Number(form.price);
    const dur = Number(form.duration_minutes);

    if (Number.isNaN(priceNum) || priceNum < 0) {
      setErr("Cena musi być liczbą >= 0.");
      return;
    }
    if (Number.isNaN(dur) || dur < 5) {
      setErr("Czas trwania musi być >= 5 minut.");
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description,
        price: String(form.price),
        duration_minutes: dur,
        is_active: form.is_active,
      };

      if (edit) {
        await servicesApi.update(edit.id, payload);
        setMsg("Zapisano zmiany.");
      } else {
        await servicesApi.create(payload);
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
        await servicesApi.disable(s.id);
        setMsg(`Wyłączono usługę: ${s.name}`);
      } else {
        await servicesApi.enable(s.id);
        setMsg(`Włączono usługę: ${s.name}`);
      }
      await load();
    } catch (e: any) {
      setErr(errMsg(e));
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Usługi</Typography>

      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Szukaj (backend search)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
          />

          <FormControl size="small">
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={isActiveFilter}
              onChange={(e) =>
                setIsActiveFilter(e.target.value as any)
              }
            >
              <MenuItem value="all">Wszystkie</MenuItem>
              <MenuItem value="active">Aktywne</MenuItem>
              <MenuItem value="disabled">Wyłączone</MenuItem>
            </Select>
          </FormControl>

          <Button variant="contained" onClick={openCreate}>
            Dodaj usługę
          </Button>

          <Divider />

          {items.map((s) => (
            <Paper key={s.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Box>
                  <Typography fontWeight={600}>{s.name}</Typography>
                  <Typography variant="body2">
                    {s.duration_minutes} min • {s.price} zł
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => openEditDialog(s)}>
                    Edytuj
                  </Button>
                  <Button
                    color={s.is_active ? "error" : "success"}
                    onClick={() => void toggleActive(s)}
                  >
                    {s.is_active ? "Wyłącz" : "Włącz"}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}

          {pageCount > 1 && (
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_, p) => setPage(p)}
            />
          )}
        </Stack>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>
          {edit ? "Edytuj usługę" : "Dodaj usługę"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nazwa"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
            />
            <TextField
              label="Cena"
              value={form.price}
              onChange={(e) =>
                setForm((p) => ({ ...p, price: e.target.value }))
              }
            />
            <TextField
              label="Czas (min)"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  duration_minutes: e.target.value,
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Anuluj</Button>
          <Button onClick={() => void save()} variant="contained">
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
