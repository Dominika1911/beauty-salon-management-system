import React from "react";
import { Typography, Grid, Button, Box, Card, CardContent } from "@mui/material";
import { Link } from "react-router-dom";
import { CalendarMonth, History } from "@mui/icons-material";
import { useAuth } from "../../context/AuthContext";

export default function ClientDashboardPage() {
  const { user } = useAuth();

  const displayName = user?.first_name?.trim() || "miło Cię widzieć";

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Witaj, {displayName}!
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Zadbaj o siebie i zarezerwuj kolejną wizytę w naszym salonie.
      </Typography>

      <Grid container spacing={3}>
        {/* KARTA: NOWA REZERWACJA */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: 3,
              boxShadow: 3,
              transition: "0.2s",
              "&:hover": { boxShadow: 6, transform: "translateY(-2px)" },
            }}
          >
            <CardContent sx={{ flexGrow: 1, textAlign: "center", p: { xs: 3, md: 4 } }}>
              <CalendarMonth sx={{ fontSize: 60, color: "primary.main", mb: 2 }} />
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Umów się na wizytę
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Wybierz usługę, ulubionego pracownika i dogodny termin.
              </Typography>

              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/client/booking"
                fullWidth
                aria-label="Przejdź do rezerwacji wizyty"
                sx={{ borderRadius: 10, py: 1.25, fontWeight: 800 }}
              >
                Zarezerwuj teraz
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* KARTA: MOJE WIZYTY */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: 3,
              boxShadow: 3,
              transition: "0.2s",
              "&:hover": { boxShadow: 6, transform: "translateY(-2px)" },
            }}
          >
            <CardContent sx={{ flexGrow: 1, textAlign: "center", p: { xs: 3, md: 4 } }}>
              <History sx={{ fontSize: 60, color: "secondary.main", mb: 2 }} />
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Moje rezerwacje
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Sprawdź status nadchodzących wizyt lub przejrzyj swoją historię.
              </Typography>

              <Button
                variant="outlined"
                size="large"
                component={Link}
                to="/client/appointments"
                fullWidth
                aria-label="Przejdź do listy moich wizyt"
                sx={{ borderRadius: 10, py: 1.25, fontWeight: 800 }}
              >
                Zobacz wizyty
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Opcjonalnie: mały pasek info (możesz usunąć, jeśli nie chcesz) */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Zalogowano jako: {user?.email || "—"}
        </Typography>
      </Box>
    </Box>
  );
}
