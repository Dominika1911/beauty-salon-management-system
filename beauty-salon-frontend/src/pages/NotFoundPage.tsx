import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Container, Typography, Button } from "@mui/material";
import { Home, ErrorOutline } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  const handleGoHome = () => {
    if (loading) return;
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
        <ErrorOutline sx={{ fontSize: 120, color: "error.main", mb: 2 }} />
        <Typography variant="h1" fontWeight="bold" gutterBottom>
          404
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Strona nie została znaleziona
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Przepraszamy, ale strona której szukasz nie istnieje.
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

export default NotFoundPage;
