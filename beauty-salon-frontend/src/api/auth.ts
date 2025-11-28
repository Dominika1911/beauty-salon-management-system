// src/api/auth.ts
import { api } from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export async function getCsrfCookie() {
  await api.get('/auth/csrf/');
}

export async function login(payload: LoginPayload) {
  await getCsrfCookie();
  const res = await api.post('/auth/login/', payload);
  return res.data;
}
