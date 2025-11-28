// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

// Importujemy nasz główny router
import { router } from './router'; 

// Importujemy nasz kontekst autoryzacji
import { AuthProvider } from './context/AuthContext'; 

// Importujemy style globalne (jeśli używasz)
import './index.css'; 


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 1. AuthProvider: Ustawia kontekst autoryzacji. Musi być na zewnątrz routera, 
           aby komponenty takie jak ProtectedRoute mogły używać useAuth(). */}
    <AuthProvider>
      {/* 2. RouterProvider: Wstrzykuje konfigurację routingu. */}
      <RouterProvider router={router} /> 
    </AuthProvider>
  </React.StrictMode>,
);