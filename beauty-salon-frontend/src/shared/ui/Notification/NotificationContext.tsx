/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import type { NotificationType } from './NotificationToast';
import { registerNotificationHandler } from '@/shared/utils/notificationService';

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification musi być użyty wewnątrz NotificationProvider');
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

/**
 * Zgodnie z wymaganiami projektu: window.alert/confirm/prompt.
 * Notyfikacje są realizowane przez window.alert (bez toastów).
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const showNotification = useCallback((message: string, type: NotificationType) => {
    // NotificationType w Twoim projekcie nie musi mieć "warning".
    // Żeby nie robić niemożliwych porównań na unionie (TS2367),
    // operujemy na stringu (runtime dalej działa).
    const t = String(type);
    let prefix = '';
    if (t === 'error') prefix = 'Błąd: ';
    else if (t === 'success') prefix = 'OK: ';
    else if (t === 'warning') prefix = 'Uwaga: ';
    else if (t === 'info') prefix = '';

    window.alert(`${prefix}${message}`);
  }, []);

  // Rejestrujemy handler, żeby notify() działało w całej aplikacji.
  useEffect(() => {
    registerNotificationHandler(showNotification);
  }, [showNotification]);

  return <NotificationContext.Provider value={{ showNotification }}>{children}</NotificationContext.Provider>;
};
