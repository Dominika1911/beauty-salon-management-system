import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import dayjs from 'dayjs';
import 'dayjs/locale/pl';

import { AuthProvider } from './context/AuthContext';
import { router } from '@/router';
import { appTheme } from './theme';

dayjs.locale('pl');

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <ThemeProvider theme={appTheme}>
                <CssBaseline />

                <LocalizationProvider
                    dateAdapter={AdapterDayjs}
                    adapterLocale="pl"
                >
                    <RouterProvider router={router} />
                </LocalizationProvider>

            </ThemeProvider>
        </AuthProvider>
    </React.StrictMode>,
);
