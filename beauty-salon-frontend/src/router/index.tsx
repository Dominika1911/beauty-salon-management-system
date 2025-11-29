// src/router/index.tsx (FINALNA WERSJA)

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

// DODAJEMY JAWNY TYP DLA STAŁEJ router
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee', 'client']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      // Nowe zagnieżdżone trasy z ochroną (przykład)
      {
        path: 'clients',
        element: (
          <ProtectedRoute allowedRoles={['manager', 'employee']}>
            {/* <ClientsPage /> */}
            <h1 style={{ padding: 50 }}>STRONA KLIENTÓW</h1>
          </ProtectedRoute>
        ),
      },
      // ... (reszta zagnieżdżonych tras jest poprawna)
      {
        path: '*',
        element: (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <h1>404</h1>
            <p>Strona nie znaleziona</p>
          </div>
        ),
      },
    ],
  },
]);