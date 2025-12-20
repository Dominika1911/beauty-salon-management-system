import type { NotificationType } from "@/components/Notification/NotificationToast.tsx";

let showFn: ((message: string, type: NotificationType) => void) | null = null;

export const registerNotificationHandler = (
  fn: (message: string, type: NotificationType) => void
) => {
  showFn = fn;
};

export const notify = (message: string, type: NotificationType = "info") => {
  if (showFn) showFn(message, type);
  else console.warn("Notification handler not registered:", message);
};
