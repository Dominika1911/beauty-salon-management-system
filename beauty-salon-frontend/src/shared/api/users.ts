import { api } from './axios';
import type {
  PaginatedResponse,
  User,
  UserCreateData,
  UserListItem,
  UserUpdateData,
  PasswordResetData,
  PasswordChangeData,
} from '@/shared/types';
import type { AxiosResponse } from 'axios';

interface UserListParams {
  role?: string;
  is_active?: boolean;
  is_staff?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface UsersApi {
  list: (params?: UserListParams) => Promise<AxiosResponse<PaginatedResponse<UserListItem>>>;
  detail: (id: number) => Promise<AxiosResponse<User>>;
  create: (data: UserCreateData) => Promise<AxiosResponse<User>>;
  update: (id: number, data: UserUpdateData) => Promise<AxiosResponse<User>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  me: () => Promise<AxiosResponse<User>>;
  changePassword: (data: PasswordChangeData) => Promise<AxiosResponse<{ detail: string }>>;
  resetPassword: (id: number, data: PasswordResetData) => Promise<AxiosResponse<{ detail: string }>>;
}

const ENDPOINTS = {
  base: '/users/',
  detail: (id: number) => `/users/${id}/`,
  me: '/users/me/',
  changePassword: '/users/change_password/',
  resetPassword: (id: number) => `/users/${id}/reset_password/`,
} as const;

export const usersAPI: UsersApi = {
  list: (params?: UserListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  create: (data: UserCreateData) => api.post(ENDPOINTS.base, data),
  update: (id: number, data: UserUpdateData) => api.patch(ENDPOINTS.detail(id), data),
  delete: (id: number) => api.delete(ENDPOINTS.detail(id)),

  me: () => api.get(ENDPOINTS.me),
  changePassword: (data: PasswordChangeData) => api.post(ENDPOINTS.changePassword, data),
  resetPassword: (id: number, data: PasswordResetData) => api.post(ENDPOINTS.resetPassword(id), data),
};
