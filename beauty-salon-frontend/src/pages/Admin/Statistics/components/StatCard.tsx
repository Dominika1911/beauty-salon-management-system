import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';

interface StatCardProps {
    label: string;
    value: string | number;
    xs?: number;
    sm?: number;
    md?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, xs = 12, sm = 6, md = 4 }) => (
    <Grid item xs={xs} sm={sm} md={md}>
        <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {label}
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                    {value}
                </Typography>
            </CardContent>
        </Card>
    </Grid>
);