import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  Stack,
  Typography,
} from '@mui/material';
import { PictureAsPdf as PdfIcon } from '@mui/icons-material';

import { reportsApi } from '@/api/reports';
import type { AvailableReport, ReportType } from '@/types';

const REPORT_PERIODS: Partial<Record<ReportType, string>> = {
  'capacity-utilization': '7 dni',
  'employee-performance': '30 dni',
  'revenue-analysis': '30 dni',
  'client-analytics': '90 dni',
  operations: '30 dni',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<AvailableReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportsApi.list();
      setReports(data.available_reports || []);
    } catch (err: unknown) {
      setError('Nie udało się załadować listy raportów. Spróbuj odświeżyć stronę.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleDownloadPdf = useCallback(async (type: ReportType) => {
    try {
      setError(null);
      await reportsApi.downloadPdf(type);
    } catch {
      setError('Nie udało się pobrać raportu PDF.');
    }
  }, []);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Raporty</Typography>
        <Typography variant="body2" color="text.secondary">
          Generuj raporty PDF z kluczowymi danymi salonu.
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      ) : (
        <List>
          {reports.map((r, idx) => (
            <React.Fragment key={r.type}>
              <ListItem disableGutters>
                <Card variant="outlined" sx={{ width: '100%' }}>
                  <CardContent>
                    <Stack spacing={1}>
                      {/* AvailableReport w Twoim BE ma: type + description */}
                      <Typography variant="h6">{r.description}</Typography>

                      <Typography variant="caption" color="text.secondary">
                        Okres: {REPORT_PERIODS[r.type] ?? '—'}
                      </Typography>

                      <Box>
                        <Button
                          variant="contained"
                          startIcon={<PdfIcon />}
                          onClick={() => handleDownloadPdf(r.type)}
                        >
                          Pobierz PDF
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </ListItem>

              {idx < reports.length - 1 ? <Divider sx={{ my: 2 }} /> : null}
            </React.Fragment>
          ))}
        </List>
      )}

      <Box>
        <Button onClick={loadReports}>Odśwież</Button>
      </Box>
    </Stack>
  );
}
