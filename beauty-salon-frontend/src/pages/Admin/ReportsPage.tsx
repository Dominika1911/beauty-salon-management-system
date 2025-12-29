import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { PictureAsPdf as PdfIcon } from "@mui/icons-material";
import { reportsApi } from "@/api/reports";
import type { AvailableReport } from "@/types";

export default function ReportsPage(): JSX.Element {
  const [reports, setReports] = useState<AvailableReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await reportsApi.list();
      setReports(data.available_reports || []);
    } catch (e: any) {
      console.error(e);
      setError("Nie udało się załadować listy raportów.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (type: string) => {
    // Bezpośrednie otwarcie PDF w nowej karcie
    const url = `/api/reports/${type}/`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" fontWeight={900}>
        Raporty
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Card variant="outlined">
        <CardContent>
          {reports.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              Brak dostępnych raportów
            </Typography>
          ) : (
            <List>
              {reports.map((report, index) => (
                <ListItem
                  key={report.type}
                  divider={index < reports.length - 1}
                  secondaryAction={
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<PdfIcon />}
                      onClick={() => handleDownload(report.type)}
                    >
                      Pobierz PDF
                    </Button>
                  }
                >
                  <ListItemText
                    primary={report.description}
                    primaryTypographyProps={{
                      fontWeight: 600,
                      fontSize: "1rem",
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary" align="center">
        Kliknij "Pobierz PDF" aby pobrać wybrany raport.
        <br />
        Raporty obejmują ostatnie 30 dni (z wyjątkiem Wykorzystania mocy - 7 dni).
      </Typography>
    </Stack>
  );
}