import { api } from "./axios";
import type { AxiosResponse } from "axios";
import type { MediaAsset, MediaAssetCreateUpdateData, PaginatedResponse } from "@/shared/types";

interface MediaListParams {
  employee?: number;
  type?: string;
  is_active?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface MediaApi {
  list: (params?: MediaListParams) => Promise<AxiosResponse<PaginatedResponse<MediaAsset>>>;
  detail: (id: number) => Promise<AxiosResponse<MediaAsset>>;
  create: (data: MediaAssetCreateUpdateData) => Promise<AxiosResponse<MediaAsset>>;
  update: (id: number, data: Partial<MediaAssetCreateUpdateData>) => Promise<AxiosResponse<MediaAsset>>;
  delete: (id: number) => Promise<AxiosResponse<void>>;
}

const ENDPOINTS = {
  base: "/media/",
  detail: (id: number) => `/media/${id}/`,
} as const;

export const mediaAPI: MediaApi = {
  list: (params?: MediaListParams) =>
    api.get<PaginatedResponse<MediaAsset>>(ENDPOINTS.base, { params }),

  detail: (id: number) => {
    if (!Number.isFinite(id) || id <= 0) {
      return Promise.reject(new Error("Invalid media ID"));
    }
    return api.get<MediaAsset>(ENDPOINTS.detail(id));
  },

  create: (data: MediaAssetCreateUpdateData) =>
    api.post<MediaAsset>(ENDPOINTS.base, data),

  update: (id: number, data: Partial<MediaAssetCreateUpdateData>) => {
    if (!Number.isFinite(id) || id <= 0) {
      return Promise.reject(new Error("Invalid media ID"));
    }
    return api.patch<MediaAsset>(ENDPOINTS.detail(id), data);
  },

  delete: (id: number) => {
    if (!Number.isFinite(id) || id <= 0) {
      return Promise.reject(new Error("Invalid media ID"));
    }
    return api.delete<void>(ENDPOINTS.detail(id));
  },
};
