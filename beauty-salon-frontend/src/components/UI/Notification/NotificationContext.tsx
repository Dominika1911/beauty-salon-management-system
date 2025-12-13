/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { NotificationToast, type NotificationType } from './NotificationToast';
import { registerNotificationHandler } from "../../../utils/notificationService";

interface NotificationMessage {
  id: number;
  message: string;
  type: NotificationType;
}

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

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    const id = Date.now();
    const newNotification: NotificationMessage = { id, message, type };

    setNotifications((prev) => [...prev, newNotification]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  // ✅ rejestrujemy handler dopiero gdy istnieje funkcja showNotification
  useEffect(() => {
    registerNotificationHandler(showNotification);
  }, [showNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {notifications.map((n) => (
          <NotificationToast key={n.id} message={n.message} type={n.type} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
