import { api } from './axios.ts';
import type { AxiosResponse } from 'axios';
import type { Note, NoteCreateUpdateData, PaginatedResponse } from '@/types';

interface NoteListParams {
  appointment?: number;
  author?: number;
  visible_for_client?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface NotesApi {
  list: (params?: NoteListParams) => Promise<AxiosResponse<PaginatedResponse<Note>>>;
  detail: (id: number) => Promise<AxiosResponse<Note>>;
  create: (data: NoteCreateUpdateData) => Promise<AxiosResponse<Note>>;
  update: (id: number, data: Partial<NoteCreateUpdateData>) => Promise<AxiosResponse<Note>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

const ENDPOINTS = {
  base: '/notes/',
  detail: (id: number) => `/notes/${id}/`,
} as const;

export const notesAPI: NotesApi = {
  list: (params?: NoteListParams) => api.get(ENDPOINTS.base, { params }),
  detail: (id: number) => api.get(ENDPOINTS.detail(id)),
  create: (data: NoteCreateUpdateData) => api.post(ENDPOINTS.base, data),
  update: (id: number, data: Partial<NoteCreateUpdateData>) => api.patch(ENDPOINTS.detail(id), data),
  delete: (id: number) => api.delete(ENDPOINTS.detail(id)),
};
