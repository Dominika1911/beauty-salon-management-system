import React from 'react';

import { AppRouter } from "@/app/router/index";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { NotificationProvider } from "@/shared/ui/Notification/index";


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
