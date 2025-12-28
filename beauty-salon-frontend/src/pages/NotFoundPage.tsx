import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { Home } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  // W adminie mamy sidebar/navbar -> nie robimy 100vh.
  // Poza adminem chcemy "Result-like" full-screen.
  const isAdmin = location.pathname.startsWith("/admin");
  const destination = isAuthenticated ? "/dashboard" : "/login";

  const handleGoHome = () => {
    if (loading) return;
    navigate(destination, { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: isAdmin ? 420 : "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 4, sm: 6, md: 8 },
        bgcolor: isAdmin ? "transparent" : "background.default",
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 760,
          p: { xs: 4, sm: 6 },
          textAlign: "center",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Typography
            variant="h1"
            sx={{
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1,
              fontSize: { xs: 64, sm: 88, md: 104 },
            }}
          >
            404
          </Typography>

          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Strona nie została znaleziona
          </Typography>

          <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 560 }}>
            Strona, której szukasz, nie istnieje lub została przeniesiona.
          </Typography>

          <Box sx={{ pt: 1 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} /> : <Home />}
              onClick={handleGoHome}
              disabled={loading}
              sx={{ px: 3, py: 1.15, borderRadius: 2 }}
            >
              {isAuthenticated ? "Przejdź do panelu" : "Przejdź do logowania"}
            </Button>
          </Box>

          <Typography variant="caption" sx={{ color: "text.secondary", mt: 1 }}>
            Nie znaleziono: {location.pathname}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
};

export default NotFoundPage;
