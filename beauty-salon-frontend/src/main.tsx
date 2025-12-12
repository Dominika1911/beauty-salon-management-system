// Fragment z main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './router';
import { AuthProvider } from './context/AuthContext.tsx';
import { NotificationProvider } from './components/UI/Notification'; // 🚨 DODANO

import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider> {/* 🚨 PODŁĄCZENIE PROVIDERA */}
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </NotificationProvider>
  </React.StrictMode>
);