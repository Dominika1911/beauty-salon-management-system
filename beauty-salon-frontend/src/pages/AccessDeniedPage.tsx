import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Container, Typography, Button } from "@mui/material";
import { Home, BlockOutlined } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  const handleGoHome = () => {
    if (loading) return;
    // jeśli zalogowany -> wspólny dashboard, jeśli nie -> login
    navigate(isAuthenticated ? "/dashboard" : "/login", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: "center" }}>
        <BlockOutlined sx={{ fontSize: 120, color: "warning.main", mb: 2 }} />
        <Typography variant="h1" fontWeight="bold" gutterBottom>
          403
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Brak dostępu
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Nie masz uprawnień do przeglądania tej strony.
        </Typography>

        <Button
          variant="contained"
          startIcon={<Home />}
          onClick={handleGoHome}
          sx={{ mt: 2 }}
          disabled={loading}
        >
          Wróć do panelu
        </Button>
      </Container>
    </Box>
  );
};

export default AccessDeniedPage;
