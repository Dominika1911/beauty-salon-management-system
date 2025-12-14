import { api } from './axios';
import type { AxiosResponse } from 'axios';
import type {
  PaginatedResponse,
  Payment,
  PaymentCreateData,
  PaymentMarkAsPaidData,
  PaymentMarkAsPaidResponse,
} from '../types';

interface PaymentListParams {
  appointment?: number;
  status?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface PaymentsApi {
  list: (params?: PaymentListParams) => Promise<AxiosResponse<PaginatedResponse<Payment>>>;
  detail: (id: number) => Promise<AxiosResponse<Payment>>;
  create: (data: PaymentCreateData) => Promise<AxiosResponse<Payment>>;
  update: (id: number, data: Partial<PaymentCreateData>) => Promise<AxiosResponse<Payment>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;

  myPayments: () => Promise<AxiosResponse<Payment[]>>;
  markAsPaid: (data: PaymentMarkAsPaidData) => Promise<AxiosResponse<PaymentMarkAsPaidResponse>>;
}

const ENDPOINTS = {
  base: '/payments/',
  detail: (id: number) => `/payments/${id}/`,
  myPayments: '/payments/my_payments/',
  markAsPaid: '/payments/mark_as_paid/',
} as const;

export const paymentsAPI: PaymentsApi = {
  list: (params?: PaymentListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  create: (data: PaymentCreateData) => api.post(ENDPOINTS.base, data),
  update: (id: number, data: Partial<PaymentCreateData>) => api.patch(ENDPOINTS.detail(id), data),
  delete: (id: number) => api.delete(ENDPOINTS.detail(id)),

  myPayments: () => api.get(ENDPOINTS.myPayments),
  markAsPaid: (data: PaymentMarkAsPaidData) => api.post(ENDPOINTS.markAsPaid, data),
};
