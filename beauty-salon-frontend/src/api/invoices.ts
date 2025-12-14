import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type { Invoice, PaginatedResponse } from '../types';

interface InvoiceListParams {
  client?: number;
  is_paid?: boolean;
  issue_date?: string;
  due_date?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface InvoicesApi {
  list: (params?: InvoiceListParams) => Promise<AxiosResponse<PaginatedResponse<Invoice>>>;
  detail: (id: number) => Promise<AxiosResponse<Invoice>>;
  myInvoices: () => Promise<AxiosResponse<Invoice[]>>;
}

const ENDPOINTS = {
  base: '/invoices/',
  detail: (id: number) => `/invoices/${id}/`,
  myInvoices: '/invoices/my_invoices/',
} as const;

export const invoicesAPI: InvoicesApi = {
  list: (params?: InvoiceListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  myInvoices: () => api.get(ENDPOINTS.myInvoices),
};
