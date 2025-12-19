import React, { type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { Sidebar } from './Sidebar';
import '@/styles/layout/Layout.css';

export const Layout: React.FC = (): ReactElement => {
  const { loading, user } = useAuth();

  // Wyświetlanie ekranu ładowania podczas sprawdzania statusu autoryzacji
  if (loading) {
    return (
      <div className="layout-loading">
        <span className="spinner-large"></span>
        Ładowanie aplikacji i sprawdzanie sesji...
      </div>
    );
  }

  const hasSidebar = user !== null;

  return (
    <div className={`app-layout ${hasSidebar ? '' : 'app-layout--no-sidebar'}`.trim()}>
      {/* Panel boczny tylko gdy user zalogowany (Sidebar i tak zwraca null, ale Layout musi też zmienić grid) */}
      <Sidebar />

      {/* Główna treść strony */}
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
};
