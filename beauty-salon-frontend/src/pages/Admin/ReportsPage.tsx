import React, { useEffect, useState, useCallback } from 'react';
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
    Divider
} from '@mui/material';
import { PictureAsPdf as PdfIcon } from '@mui/icons-material';
import { reportsApi } from '@/api/reports';
import type { AvailableReport, ReportType } from '@/types';

const REPORT_PERIODS: Record<ReportType, string> = {
    'capacity-utilization': '7 dni',
    'employee-performance': '30 dni',
    'revenue-analysis': '30 dni',
    'client-analytics': '30 dni',
    'operations': '30 dni',
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
        } catch (err) {
            console.error('Błąd pobierania raportów:', err);
            setError('Nie udało się załadować listy raportów. Spróbuj odświeżyć stronę.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadReports();
    }, [loadReports]);

    const handleDownload = (type: ReportType) => {
        const url = `/api/reports/${type}/`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Stack spacing={3} sx={{ p: { xs: 2, md: 3 }, maxWidth: 800, mx: 'auto' }}>
            <Box>
                <Typography variant="h4" fontWeight={900} gutterBottom>
                    Raporty systemowe
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Wybierz raport z poniższej listy, aby pobrać szczegółowe zestawienie w formacie PDF.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" variant="filled">
                    {error}
                </Alert>
            )}

            <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    {reports.length === 0 ? (
                        <Box sx={{ py: 6, textAlign: 'center' }}>
                            <Typography color="text.secondary">Brak zdefiniowanych raportów w systemie.</Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {reports.map((report, index) => {
                                const period = REPORT_PERIODS[report.type] || '30 dni';

                                return (
                                    <React.Fragment key={report.type}>
                                        <ListItem
                                            sx={{ py: 2.5, px: 3 }}
                                            secondaryAction={
                                                <Button
                                                    variant="contained"
                                                    disableElevation
                                                    startIcon={<PdfIcon />}
                                                    onClick={() => handleDownload(report.type)}
                                                >
                                                    Pobierz PDF
                                                </Button>
                                            }
                                        >
                                            <ListItemText
                                                primary={report.description}
                                                secondary={`Zakres danych: ostatnie ${period}`}
                                                primaryTypographyProps={{
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    mb: 0.5
                                                }}
                                            />
                                        </ListItem>
                                        {index < reports.length - 1 && <Divider />}
                                    </React.Fragment>
                                );
                            })}
                        </List>
                    )}
                </CardContent>
            </Card>

            <Alert severity="info" variant="outlined" sx={{ borderStyle: 'dashed', backgroundColor: 'rgba(2, 136, 209, 0.02)' }}>
                Dane są aktualizowane w momencie generowania pliku. Raporty obejmują domyślne okresy czasu skonfigurowane w systemie.
            </Alert>
        </Stack>
    );
}