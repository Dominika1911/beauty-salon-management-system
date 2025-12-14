import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { Notification, NotificationCreateData, PaginatedResponse } from '../types';

interface NotificationListParams {
  client?: number;
  type?: string;
  channel?: string;
  status?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface NotificationsApi {
  list: (params?: NotificationListParams) => Promise<AxiosResponse<PaginatedResponse<Notification>>>;
  detail: (id: number) => Promise<AxiosResponse<Notification>>;
  create: (data: NotificationCreateData) => Promise<AxiosResponse<Notification>>;
  update: (id: number, data: Partial<NotificationCreateData>) => Promise<AxiosResponse<Notification>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  myNotifications: () => Promise<AxiosResponse<Notification[]>>;
}

const ENDPOINTS = {
  base: '/notifications/',
  detail: (id: number) => `/notifications/${id}/`,
  myNotifications: '/notifications/my_notifications/',
} as const;

export const notificationsAPI: NotificationsApi = {
  list: (params?: NotificationListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  create: (data: NotificationCreateData) => api.post(ENDPOINTS.base, data),
  update: (id: number, data: Partial<NotificationCreateData>) => api.patch(ENDPOINTS.detail(id), data),
  delete: (id: number) => api.delete(ENDPOINTS.detail(id)),

  myNotifications: () => api.get(ENDPOINTS.myNotifications),
};
