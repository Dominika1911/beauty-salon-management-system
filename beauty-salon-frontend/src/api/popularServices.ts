import { api } from "./axios";
import type { AxiosResponse } from "axios";
import type { Service } from "../types";

interface PopularServicesApi {
  get: (days?: number) => Promise<AxiosResponse<Service[]>>;
}

const ENDPOINTS = {
  base: "/popular-services/",
} as const;

export const popularServicesAPI: PopularServicesApi = {
  get: (days?: number) =>
    api.get<Service[]>(ENDPOINTS.base, {
      params: typeof days === "number" ? { days } : undefined,
    }),
};
