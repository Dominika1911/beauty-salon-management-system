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

type ActionGroup = "ALL" | "AUTH" | "APPOINTMENTS" | "SETTINGS" | "USERS" | "OTHER";

function groupFromAction(action: string) {
  const a = (action || "").toLowerCase();
  if (a.includes("login") || a.includes("logout")) return "AUTH";
  if (a.includes("appointment") || a.includes("booking") || a.includes("reservation")) return "APPOINTMENTS";
  if (a.includes("settings")) return "SETTINGS";
  if (a.includes("user") || a.includes("client") || a.includes("employee")) return "USERS";
  return "OTHER";
}

function chipPropsForGroup(g: ActionGroup) {
  switch (g) {
    case "AUTH":
      return { color: "primary" as const, label: "Logowanie" };
    case "APPOINTMENTS":
      return { color: "success" as const, label: "Wizyty" };
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

function niceActor(s: string | null) {
  if (!s) return "—";
  // jeśli masz u siebie "admin-00000001" itp. skracamy czytelniej
  return s.replace(/^(.+?)-0+(\d+)$/, "$1-$2");
}

const LogsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  // UX: zamiast wpisywania "action" jako tekst, dajemy filtr grup
  const [group, setGroup] = useState<ActionGroup>("ALL");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const s = search.trim().toLowerCase();

    return logs.filter((l) => {
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

      // pobieramy wszystko, filtrujemy po stronie UI (najprościej, a na obronę wystarczy)
      const data = await getSystemLogs();
      // sort: najnowsze na górze
      data.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      setLogs(data);
    } catch {
      setError("Nie udało się pobrać logów (sprawdź endpoint /audit-logs/ i uprawnienia ADMIN).");
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
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">Logi operacji</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Typ zdarzenia</InputLabel>
          <Select label="Typ zdarzenia" value={group} onChange={handleGroupChange}>
            <MenuItem value="ALL">Wszystkie</MenuItem>
            <MenuItem value="AUTH">Logowanie</MenuItem>
            <MenuItem value="APPOINTMENTS">Wizyty</MenuItem>
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
          placeholder="np. admin, klient-1, appointment..."
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
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 190 }}>Data i czas</TableCell>
                <TableCell sx={{ width: 140 }}>Kategoria</TableCell>
                <TableCell>Co się stało</TableCell>
                <TableCell sx={{ width: 220 }}>Wykonał</TableCell>
                <TableCell sx={{ width: 220 }}>Dotyczy</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Brak logów dla wybranych filtrów.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((l) => {
                  const g = groupFromAction(l.action_display || l.action);
                  const badge = chipPropsForGroup(g);

                  return (
                    <TableRow key={l.id} hover>
                      <TableCell>{new Date(l.timestamp).toLocaleString("pl-PL")}</TableCell>
                      <TableCell>
                        <Chip size="small" color={badge.color} label={badge.label} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {l.action_display || l.action}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          Kod: {l.action}
                        </Typography>
                      </TableCell>
                      <TableCell>{l.performed_by_username ? niceActor(l.performed_by_username) : "System"}</TableCell>
                      <TableCell>{l.target_user_username ? niceActor(l.target_user_username) : "Akcja systemowa"}</TableCell>
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
