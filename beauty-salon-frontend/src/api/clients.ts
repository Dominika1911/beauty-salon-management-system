import axios from 'axios';
import type { Client, PaginatedResponse } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

// axios skonfigurowany pod Django session + CSRF
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,          // <– KLUCZOWE przy session auth
  xsrfCookieName: 'csrftoken',    // nazwa ciasteczka od Django
  xsrfHeaderName: 'X-CSRFToken',  // nagłówek, który Django czyta
});

const CLIENTS_ENDPOINT = '/clients/';

// Pobranie strony klientów (paginacja DRF)
export async function getClients(
  url?: string,
): Promise<PaginatedResponse<Client>> {
  const target = url ?? CLIENTS_ENDPOINT;

  const response = await axiosInstance.get<PaginatedResponse<Client>>(target);
  return response.data;
}

export const clientsAPI = {
  getClients,
};
