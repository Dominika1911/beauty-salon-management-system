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
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Pagination,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";

import type { Service } from "@/types";
import { servicesApi } from "@/api/services";
import { parseDrfError, pickFieldErrors } from "@/utils/drfErrors";

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
type IsActiveFilter = "all" | "active" | "disabled";

type SnackbarState = {
  open: boolean;
  msg: string;
  severity: "success" | "info";
};

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "name", label: "Nazwa" },
  { value: "price", label: "Cena" },
  { value: "duration_minutes", label: "Czas" },
  { value: "created_at", label: "Data utworzenia" },
];

export default function ServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [count, setCount] = useState(0);
  const [pageSize, setPageSize] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  // Paginacja (realnie odpala load)
  const [page, setPage] = useState(1);

  // UI draft (użytkownik wpisuje — bez requestów)
  const [draftQuery, setDraftQuery] = useState("");
  const [draftIsActive, setDraftIsActive] = useState<IsActiveFilter>("all");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftSortKey, setDraftSortKey] = useState<SortKey>("name");
  const [draftSortDir, setDraftSortDir] = useState<SortDir>("asc");

  // Applied (dopiero to idzie do backendu)
  const [query, setQuery] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<IsActiveFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // komunikaty
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackbarState>({ open: false, msg: "", severity: "info" });

  // dialog / formularz
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const busy = loading || saving || togglingId !== null;

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

  const hasActiveFiltersDraft =
    Boolean(draftQuery.trim()) ||
    Boolean(draftCategory.trim()) ||
    draftIsActive !== "all" ||
    draftSortKey !== "name" ||
    draftSortDir !== "asc";

  const hasActiveFiltersApplied =
    Boolean(query.trim()) ||
    Boolean(categoryFilter.trim()) ||
    isActiveFilter !== "all" ||
    sortKey !== "name" ||
    sortDir !== "asc";

  const hasUnappliedChanges =
    draftQuery !== query ||
    draftCategory !== categoryFilter ||
    draftIsActive !== isActiveFilter ||
    draftSortKey !== sortKey ||
    draftSortDir !== sortDir;

  async function load() {
    setLoading(true);
    setPageError(null);

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
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się pobrać usług. Spróbuj ponownie.");
      setItems([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  // Request tylko na start / zmianę strony / zmianę APPLIED filtrów (po kliknięciu Zastosuj)
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, orderingParam, query, is_active_param, categoryFilter]);

  function applyFilters() {
    // resetujemy paginację, bo zmieniły się filtry
    setPage(1);

    setQuery(draftQuery);
    setCategoryFilter(draftCategory);
    setIsActiveFilter(draftIsActive);
    setSortKey(draftSortKey);
    setSortDir(draftSortDir);
  }

  function resetFilters() {
    setDraftQuery("");
    setDraftCategory("");
    setDraftIsActive("all");
    setDraftSortKey("name");
    setDraftSortDir("asc");

    setPage(1);
    setQuery("");
    setCategoryFilter("");
    setIsActiveFilter("all");
    setSortKey("name");
    setSortDir("asc");
  }

  function openCreate() {
    setEdit(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
    setOpen(true);
  }

  function openEditDialog(s: Service) {
    setEdit(s);
    setFieldErrors({});
    setFormError(null);
    setForm({
      name: s.name ?? "",
      category: s.category ?? "",
      description: s.description ?? "",
      price: String(s.price ?? ""),
      duration_minutes: String(s.duration_minutes ?? ""),
      is_active: Boolean(s.is_active),
    });
    setOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
  }

  function validateLocal(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) next.name = "Nazwa jest wymagana.";

    const priceNum = Number(form.price);
    if (form.price.trim() === "") next.price = "Cena jest wymagana.";
    else if (Number.isNaN(priceNum) || priceNum < 0) next.price = "Cena musi być liczbą ≥ 0.";

    const dur = Number(form.duration_minutes);
    if (form.duration_minutes.trim() === "") next.duration_minutes = "Czas trwania jest wymagany.";
    else if (Number.isNaN(dur) || dur < 5) next.duration_minutes = "Czas trwania musi być ≥ 5 minut.";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    setFormError(null);

    if (!validateLocal()) {
      setFormError("Popraw błędy w formularzu.");
      return;
    }

    setSaving(true);
    try {
      const dur = Number(form.duration_minutes);

      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined,
        price: String(form.price),
        duration_minutes: dur,
        is_active: form.is_active,
      };

      if (edit) {
        await servicesApi.update(edit.id, payload);
        setSnack({ open: true, msg: "Zapisano zmiany.", severity: "success" });
      } else {
        await servicesApi.create(payload);
        setSnack({ open: true, msg: "Dodano usługę.", severity: "success" });
      }

      setOpen(false);
      await load();
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setFormError(parsed.message || "Nie udało się zapisać. Spróbuj ponownie.");
      setFieldErrors(pickFieldErrors<FormState>(parsed.fieldErrors, emptyForm));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    setPageError(null);
    setTogglingId(s.id);

    try {
      if (s.is_active) {
        await servicesApi.disable(s.id);
        setSnack({ open: true, msg: `Wyłączono usługę: ${s.name}`, severity: "info" });
      } else {
        await servicesApi.enable(s.id);
        setSnack({ open: true, msg: `Włączono usługę: ${s.name}`, severity: "info" });
      }
      await load();
    } catch (e: unknown) {
      const parsed = parseDrfError(e);
      setPageError(parsed.message || "Nie udało się zmienić statusu usługi. Spróbuj ponownie.");
    } finally {
      setTogglingId(null);
    }
  }

  const onDraftStatusChange = (e: SelectChangeEvent) => {
    setDraftIsActive(e.target.value as IsActiveFilter);
  };

  const onDraftSortKeyChange = (e: SelectChangeEvent) => {
    setDraftSortKey(e.target.value as SortKey);
  };

  const onDraftSortDirChange = (e: SelectChangeEvent) => {
    setDraftSortDir(e.target.value as SortDir);
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        gap={1}
      >
        <Box>
          <Typography variant="h5">Usługi</Typography>
          <Typography variant="body2" color="text.secondary">
            Zarządzaj ofertą usług i ich dostępnością.
          </Typography>
        </Box>

        <Button variant="contained" onClick={openCreate} disabled={busy}>
          Dodaj usługę
        </Button>
      </Stack>

      {pageError && <Alert severity="error">{pageError}</Alert>}

      <Paper sx={{ p: 2, position: "relative" }}>
        {loading && <LinearProgress sx={{ position: "absolute", left: 0, top: 0, right: 0 }} />}

        <Stack spacing={2} sx={{ pt: loading ? 1 : 0 }}>
          {/* Filtry (draft) */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              label="Szukaj"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              fullWidth
              disabled={busy}
              placeholder="Nazwa, kategoria lub opis"
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />

            <TextField
              label="Kategoria"
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
              disabled={busy}
              sx={{ minWidth: { md: 220 } }}
              placeholder="np. Kosmetyka"
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />

            <FormControl size="small" sx={{ minWidth: 170 }} disabled={busy}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={draftIsActive} onChange={onDraftStatusChange}>
                <MenuItem value="all">Wszystkie</MenuItem>
                <MenuItem value="active">Aktywne</MenuItem>
                <MenuItem value="disabled">Wyłączone</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }} disabled={busy}>
              <InputLabel>Sortowanie</InputLabel>
              <Select label="Sortowanie" value={draftSortKey} onChange={onDraftSortKeyChange}>
                {SORT_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }} disabled={busy}>
              <InputLabel>Kierunek</InputLabel>
              <Select label="Kierunek" value={draftSortDir} onChange={onDraftSortDirChange}>
                <MenuItem value="asc">Rosnąco</MenuItem>
                <MenuItem value="desc">Malejąco</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {hasActiveFiltersDraft && <Chip size="small" label="Ustawione filtry" />}
              {hasUnappliedChanges && (
                <Chip size="small" color="warning" label="Masz niezastosowane zmiany" variant="outlined" />
              )}
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={resetFilters} disabled={busy || (!hasActiveFiltersDraft && !hasActiveFiltersApplied)}>
                Wyczyść filtry
              </Button>
              <Button variant="contained" onClick={applyFilters} disabled={busy || !hasUnappliedChanges}>
                Zastosuj
              </Button>
            </Stack>
          </Stack>

          <Divider />

          {/* Lista / empty */}
          {!loading && items.length === 0 ? (
            <Box sx={{ py: 4 }}>
              <Typography variant="h6">Brak danych</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {hasActiveFiltersApplied
                  ? "Nie znaleziono usług dla wybranych filtrów. Zmień filtry i kliknij „Zastosuj”."
                  : "Nie masz jeszcze żadnych usług. Dodaj pierwszą usługę, aby rozpocząć."}
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
                {hasActiveFiltersApplied && (
                  <Button variant="outlined" onClick={resetFilters} disabled={busy}>
                    Wyczyść filtry
                  </Button>
                )}
                <Button variant="contained" onClick={openCreate} disabled={busy}>
                  Dodaj usługę
                </Button>
              </Stack>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {items.map((s) => {
                const isToggling = togglingId === s.id;

                return (
                  <Paper key={s.id} variant="outlined" sx={{ p: 2, opacity: busy && !isToggling ? 0.75 : 1 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "stretch", sm: "center" }}
                      spacing={1.5}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography fontWeight={700} sx={{ wordBreak: "break-word" }}>
                            {s.name}
                          </Typography>

                          <Chip
                            size="small"
                            label={s.is_active ? "Aktywna" : "Wyłączona"}
                            color={s.is_active ? "success" : "default"}
                            variant={s.is_active ? "filled" : "outlined"}
                          />

                          {s.category ? <Chip size="small" label={s.category} variant="outlined" /> : null}
                        </Stack>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {s.duration_minutes} min • {s.price} zł
                        </Typography>

                        {s.description ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {s.description}
                          </Typography>
                        ) : null}
                      </Box>

                      <Stack direction="row" spacing={1} justifyContent={{ xs: "flex-start", sm: "flex-end" }}>
                        <Button onClick={() => openEditDialog(s)} disabled={busy}>
                          Edytuj
                        </Button>

                        <Tooltip
                          title={
                            s.is_active ? "Wyłączy usługę (nie będzie dostępna w rezerwacji)" : "Włączy usługę"
                          }
                        >
                          <span>
                            <Button
                              color={s.is_active ? "error" : "success"}
                              variant="outlined"
                              onClick={() => void toggleActive(s)}
                              disabled={busy}
                            >
                              {isToggling ? "Zmieniam..." : s.is_active ? "Wyłącz" : "Włącz"}
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}

              {pageCount > 1 && (
                <Stack direction="row" justifyContent="center" sx={{ pt: 1 }}>
                  <Pagination
                    count={pageCount}
                    page={page}
                    onChange={(_, p) => setPage(p)}
                    disabled={loading}
                    showFirstButton
                    showLastButton
                  />
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{edit ? "Edytuj usługę" : "Dodaj usługę"}</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              label="Nazwa"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              fullWidth
              autoFocus
              disabled={saving}
              error={Boolean(fieldErrors.name)}
              helperText={fieldErrors.name}
            />

            <TextField
              label="Kategoria"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              fullWidth
              disabled={saving}
              error={Boolean(fieldErrors.category)}
              helperText={fieldErrors.category || "Opcjonalnie (ułatwia filtrowanie i wyszukiwanie)."}
            />

            <TextField
              label="Opis"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              fullWidth
              disabled={saving}
              multiline
              minRows={3}
              error={Boolean(fieldErrors.description)}
              helperText={fieldErrors.description}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Cena (zł)"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                fullWidth
                disabled={saving}
                inputMode="decimal"
                error={Boolean(fieldErrors.price)}
                helperText={fieldErrors.price}
              />

              <TextField
                label="Czas (min)"
                value={form.duration_minutes}
                onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                fullWidth
                disabled={saving}
                inputMode="numeric"
                error={Boolean(fieldErrors.duration_minutes)}
                helperText={fieldErrors.duration_minutes}
              />
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  disabled={saving}
                />
              }
              label="Usługa aktywna"
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Anuluj
          </Button>
          <Button onClick={() => void save()} variant="contained" disabled={saving}>
            {saving ? "Zapisuję..." : "Zapisz"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
