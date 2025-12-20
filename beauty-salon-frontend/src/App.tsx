import React from 'react';

import { AppRouter } from '@/router';
import { AuthProvider } from '@/context/AuthProvider';
import { NotificationProvider } from '@/components/Notification';

/**
 * Główny komponent aplikacji (root).
 * Trzyma globalne providery oraz router.
 */
export function App(): React.ReactElement {
  return (
    <React.StrictMode>
      <NotificationProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </NotificationProvider>
    </React.StrictMode>
  );
}

export default App;
