import type { Appointment, DRFPaginated } from '@/types';
import type { FormData, Ordering } from './types';
import type { AppointmentStatus } from '@/types';


export const EMPTY_FORM: FormData = {
  client: null,
  employee: null,
  service: null,
  start: null,
  end: null,
  status: 'CONFIRMED' as AppointmentStatus,
  internal_notes: '',
};


export const EMPTY_PAGE: DRFPaginated<Appointment> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export function orderingLabel(o: Ordering): string {
  switch (o) {
    case 'start':
      return 'Najbliższe terminy';
    case '-start':
      return 'Najdalsze terminy';
    case '-created_at':
      return 'Najnowsze dodane';
    case 'created_at':
      return 'Najstarsze dodane';
    case '-status':
      return 'Status: od oczekujących';
    case 'status':
      return 'Status: od anulowanych';
    default:
      return 'Sortowanie';
  }
}
