import React, { useEffect, useState } from "react";
import { Typography, Grid, Paper, Button, Stack, Box, Card, CardContent } from "@mui/material";
import { Link } from "react-router-dom";
import { CalendarMonth, History } from "@mui/icons-material";
import { useAuth } from "../../context/AuthContext";

export default function ClientDashboardPage() {
  const { user } = useAuth();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Witaj, {user?.first_name || "miło Cię widzieć"}!
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        Zadbaj o siebie i zarezerwuj kolejną wizytę w naszym salonie.
      </Typography>

      <Grid container spacing={3}>
        {/* KARTA: NOWA REZERWACJA */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, boxShadow: 3 }}>
            <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 4 }}>
              <CalendarMonth sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Umów się na wizytę
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Wybierz usługę, ulubionego pracownika i dogodny termin.
              </Typography>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/client/booking"
                fullWidth
                sx={{ borderRadius: 10 }}
              >
                Zarezerwuj teraz
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* KARTA: MOJE WIZYTY */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, boxShadow: 3 }}>
            <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 4 }}>
              <History sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Moje rezerwacje
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Sprawdź status nadchodzących wizyt lub przejrzyj swoją historię.
              </Typography>
              <Button
                variant="outlined"
                size="large"
                component={Link}
                to="/client/appointments"
                fullWidth
                sx={{ borderRadius: 10 }}
              >
                Zobacz historię
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}