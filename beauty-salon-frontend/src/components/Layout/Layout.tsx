// src/components/Layout/Layout.tsx

import React, { type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/useAuth'; // Ścieżka do useAuth w context/
import { Sidebar } from './Sidebar';
import './Layout.css';

export const Layout: React.FC = (): ReactElement => {
  const { loading } = useAuth();

  // Wyświetlanie ekranu ładowania podczas sprawdzania statusu autoryzacji
  if (loading) {
    return (
      <div className="layout-loading">
        <span className="spinner-large"></span>
        Ładowanie aplikacji i sprawdzanie sesji...
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* 1. Panel boczny z nawigacją */}
      <Sidebar />

      {/* 2. Główna treść strony (gdzie renderują się pages) */}
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
};