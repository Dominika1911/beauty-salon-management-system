import React from 'react';

export type NotificationType = 'success' | 'error' | 'info';

interface NotificationProps {
  message: string;
  type: NotificationType;
}

const getBorderColor = (type: NotificationType): string => {
  switch (type) {
    case 'success':
      return '#4CAF50';
    case 'error':
      return '#F44336';
    case 'info':
      return '#2196F3';
    default:
      return '#9E9E9E';
  }
};

export const NotificationToast: React.FC<NotificationProps> = ({ message, type }) => {
  const style: React.CSSProperties = {
    padding: '12px 20px',
    margin: '8px 0',
    backgroundColor: 'white',
    color: '#333',
    borderRadius: '5px',
    borderLeft: `5px solid ${getBorderColor(type)}`,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    minWidth: '280px',
    maxWidth: '350px',
    transition: 'opacity 0.3s ease-out',
  };

  return (
    <div style={style}>
      <strong>{type.toUpperCase()}:</strong> {message}
    </div>
  );
};
