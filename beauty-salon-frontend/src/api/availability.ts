import { api } from './axios.ts';
import type { AxiosResponse } from 'axios';

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface AvailabilityResponse {
  employee: number;
  service: number;
  slot_minutes: number;
  buffer_minutes: number;
  duration_minutes: number;
  slots: AvailabilitySlot[];
}

export interface AvailabilityParams {
  employee: number;
  service: number;
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
  ignore_timeoff?: boolean;
}

export const availabilityAPI = {
  getSlots: (params: AvailabilityParams): Promise<AxiosResponse<AvailabilityResponse>> => {
    const { ignore_timeoff, ...rest } = params;

    return api.get<AvailabilityResponse>('/availability/slots/', {
      params: {
        ...rest,
        ...(ignore_timeoff ? { ignore_timeoff: 1 } : {}),
      },
    });
  },
};
