import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Grid,
  Alert,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth";

const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Nie jesteś zalogowany</Alert>
      </Box>
    );
  }

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(null);

    // Walidacja po stronie frontendu
    if (newPassword !== newPassword2) {
      setError("Hasła nie są identyczne");
      return;
    }

    if (newPassword.length < 8) {
      setError("Nowe hasło musi mieć minimum 8 znaków");
      return;
    }

    try {
      setSaving(true);

      // Wywołanie API POST /api/auth/change-password/
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        new_password2: newPassword2,
      });

      // Sukces - czyszczenie pól haseł
      setSuccess("Hasło zostało zmienione pomyślnie");
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");

      // Odświeżenie danych użytkownika w kontekście
      await refreshUser();
    } catch (err: any) {
      // Pobieramy dane błędu zwrócone przez Django Rest Framework
      const serverData = err.response?.data;

      // Logika wyciągania błędów z różnych możliwych pól backendu:
      // 1. non_field_errors - tu Django wysyła błędy siły hasła (np. "zbyt powszechne")
      // 2. detail - błędy ogólne (np. brak autoryzacji)
      // 3. specyficzne błędy pól (old_password, new_password)
      const errorMessage =
        (serverData?.non_field_errors && serverData.non_field_errors.join(" ")) ||
        serverData?.detail ||
        serverData?.old_password?.[0] ||
        serverData?.new_password?.[0] ||
        "Nie udało się zmienić hasła. Upewnij się, że jest wystarczająco silne.";

      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 800 }}>
        Mój profil
      </Typography>

      <Grid container spacing={3}>
        {/* ================== DANE UŻYTKOWNIKA ================== */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Dane użytkownika
              </Typography>

              <TextField
                label="Login"
                value={user.username}
                fullWidth
                margin="dense"
                disabled
                variant="outlined"
              />

              <TextField
                label="Imię"
                value={user.first_name || ""}
                fullWidth
                margin="dense"
                disabled
                variant="outlined"
              />

              <TextField
                label="Nazwisko"
                value={user.last_name || ""}
                fullWidth
                margin="dense"
                disabled
                variant="outlined"
              />

              <TextField
                label="Email"
                value={user.email || ""}
                fullWidth
                margin="dense"
                disabled
                variant="outlined"
              />

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Rola w systemie:
                </Typography>
                <Chip
                  label={user.role_display}
                  color={
                    user.role === "ADMIN"
                      ? "error"
                      : user.role === "EMPLOYEE"
                      ? "primary"
                      : "success"
                  }
                  variant="filled"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ================== ZMIANA HASŁA ================== */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography
                variant="h6"
                sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1, fontWeight: 600 }}
              >
                <LockOutlinedIcon fontSize="small" />
                Bezpieczeństwo
              </Typography>

              {/* Wyświetlanie komunikatów o błędach i sukcesach */}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

              <TextField
                label="Aktualne hasło"
                type="password"
                fullWidth
                margin="normal"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
              />

              <TextField
                label="Nowe hasło"
                type="password"
                fullWidth
                margin="normal"
                helperText="Minimum 8 znaków, nie może być podobne do loginu"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />

              <TextField
                label="Powtórz nowe hasło"
                type="password"
                fullWidth
                margin="normal"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                autoComplete="new-password"
              />

              <Button
                variant="contained"
                fullWidth
                size="large"
                sx={{ mt: 3, py: 1.5, fontWeight: 700 }}
                disabled={saving || !oldPassword || !newPassword || !newPassword2}
                onClick={handleChangePassword}
              >
                {saving ? "Zapisywanie..." : "Zaktualizuj hasło"}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;