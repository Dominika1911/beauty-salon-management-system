import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { getSystemLogs } from "../../api/system";
import type { SystemLog } from "../../types";

// Definicja grup akcji - dodano TIMEOFF
type ActionGroup = "ALL" | "AUTH" | "APPOINTMENTS" | "TIMEOFF" | "SETTINGS" | "USERS" | "OTHER";

/**
 * Funkcja przypisująca log do grupy na podstawie nazwy akcji.
 * Poprawiona o obsługę "time off" (z Twojego zrzutu ekranu).
 */
function groupFromAction(action: string): ActionGroup {
  const a = (action || "").toLowerCase();

  if (a.includes("login") || a.includes("logout")) return "AUTH";
  if (a.includes("appointment") || a.includes("booking") || a.includes("reservation")) return "APPOINTMENTS";

  // Sprawdza "time off" (wyświetlana nazwa) oraz "timeoff" (kod akcji)
  if (a.includes("time off") || a.includes("timeoff") || a.includes("urlop")) return "TIMEOFF";

  if (a.includes("settings")) return "SETTINGS";
  if (a.includes("user") || a.includes("client") || a.includes("employee")) return "USERS";

  return "OTHER";
}

/**
 * Zwraca właściwości Chipa (kolor i etykietę) dla danej grupy.
 */
function chipPropsForGroup(g: ActionGroup) {
  switch (g) {
    case "AUTH":
      return { color: "primary" as const, label: "Logowanie" };
    case "APPOINTMENTS":
      return { color: "success" as const, label: "Wizyty" };
    case "TIMEOFF":
      return { color: "info" as const, label: "Urlopy" }; // Jasnoniebieski dla urlopów
    case "SETTINGS":
      return { color: "warning" as const, label: "Ustawienia" };
    case "USERS":
      return { color: "secondary" as const, label: "Użytkownicy" };
    case "OTHER":
      return { color: "default" as const, label: "Inne" };
    default:
      return { color: "default" as const, label: "Wszystkie" };
  }
}

/**
 * Skraca nazwy użytkowników (np. admin-00000001 -> admin-1).
 */
function niceActor(s: string | null) {
  if (!s) return "—";
  return s.replace(/^(.+?)-0+(\d+)$/, "$1-$2");
}

const LogsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  const [group, setGroup] = useState<ActionGroup>("ALL");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const s = search.trim().toLowerCase();

    return logs.filter((l) => {
      // Sprawdzamy grupę na podstawie nazwy wyświetlanej LUB kodu akcji
      const g = groupFromAction(l.action_display || l.action);
      if (group !== "ALL" && g !== group) return false;

      if (!s) return true;

      const hay = [
        l.action_display,
        l.action,
        l.performed_by_username,
        l.target_user_username,
        l.timestamp,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [logs, group, search]);

  const load = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getSystemLogs();
      // Sortowanie: najnowsze na górze
      data.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      setLogs(data);
    } catch {
      setError("Nie udało się pobrać logów operacji.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleGroupChange = (e: SelectChangeEvent) => {
    setGroup(e.target.value as ActionGroup);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 3 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">Logi operacji</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Historia aktywności i zmian statusów w systemie
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Kategoria</InputLabel>
          <Select label="Kategoria" value={group} onChange={handleGroupChange}>
            <MenuItem value="ALL">Wszystkie</MenuItem>
            <MenuItem value="AUTH">Logowanie</MenuItem>
            <MenuItem value="APPOINTMENTS">Wizyty</MenuItem>
            <MenuItem value="TIMEOFF">Urlopy</MenuItem>
            <MenuItem value="SETTINGS">Ustawienia</MenuItem>
            <MenuItem value="USERS">Użytkownicy</MenuItem>
            <MenuItem value="OTHER">Inne</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Szukaj"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="np. admin, urlop, maria..."
          sx={{ minWidth: 240 }}
        />

        <Button variant="contained" onClick={() => void load()} disabled={loading}>
          Odśwież
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                <TableCell sx={{ width: 190, fontWeight: "bold" }}>Data i czas</TableCell>
                <TableCell sx={{ width: 140, fontWeight: "bold" }}>Kategoria</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Opis zdarzenia</TableCell>
                <TableCell sx={{ width: 220, fontWeight: "bold" }}>Wykonał</TableCell>
                <TableCell sx={{ width: 220, fontWeight: "bold" }}>Dotyczy</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    Brak logów spełniających kryteria wyszukiwania.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((l) => {
                  const g = groupFromAction(l.action_display || l.action);
                  const badge = chipPropsForGroup(g);

                  return (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {new Date(l.timestamp).toLocaleString("pl-PL")}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={badge.color} label={badge.label} sx={{ fontWeight: 500 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {l.action_display || l.action}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
                          Kod: {l.action}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>
                        {l.performed_by_username ? niceActor(l.performed_by_username) : "System"}
                      </TableCell>
                      <TableCell>
                        {l.target_user_username ? (
                          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                            {niceActor(l.target_user_username)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default LogsPage;