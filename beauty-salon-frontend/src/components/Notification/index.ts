// Exportujemy główny hook i providera
export { useNotification, NotificationProvider } from './NotificationContext.tsx';
// Jeśli Notification jest używany oddzielnie, również go eksportujemy
// export { Notification } from './NotificationContext'; // Zostawimy to na razie w jednym pliku dla uproszczenia