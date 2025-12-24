import axiosInstance from './axios';
import type { Appointment } from '../types';

/**
 * API dla wizyt (Appointments)
 */

// Pobierz wszystkie wizyty (Widok Admina)
export const getAppointments = async (): Promise<Appointment[]> => {
  const response = await axiosInstance.get('/appointments/');
  return response.data.results || response.data;
};

// Pobierz wizyty zalogowanego użytkownika (Przez endpoint 'my' z Twojego views.py)
export const getMyAppointments = async (): Promise<Appointment[]> => {
  const response = await axiosInstance.get('/appointments/my/');
  return response.data.results || response.data;
};

// Pobierz szczegóły jednej wizyty
export const getAppointment = async (id: number): Promise<Appointment> => {
  const response = await axiosInstance.get<Appointment>(`/appointments/${id}/`);
  return response.data;
};

// --- POPRAWIONE: Utwórz nową wizytę (Rezerwacja dla Klienta) ---
export const createAppointment = async (data: {
  employee_id: number; // Zmienione na employee_id zgodnie z backendem
  service_id: number;  // Zmienione na service_id zgodnie z backendem
  start: string;       // Format ISO
}): Promise<Appointment> => {
  // ZMIANA: URL na /appointments/book/ zgodnie z Twoim urls.py
  const response = await axiosInstance.post<Appointment>('/appointments/book/', data);
  return response.data;
};

// =============================================================================
// AKCJE NA WIZYTACH (Statusy)
// =============================================================================

export const cancelAppointment = async (id: number): Promise<void> => {
  await axiosInstance.post(`/appointments/${id}/cancel/`);
};

export const confirmAppointment = async (id: number): Promise<void> => {
  await axiosInstance.post(`/appointments/${id}/confirm/`);
};

export const completeAppointment = async (id: number): Promise<void> => {
  await axiosInstance.post(`/appointments/${id}/complete/`);
};

// =============================================================================
// LOGIKA DOSTĘPNOŚCI (Zgodna z Twoim AvailabilitySlotsAPIView)
// =============================================================================

export const getAvailableSlots = async (
  employeeId: number,
  date: string,
  serviceId: number
): Promise<string[]> => {
  // ZMIANA: URL na /availability/slots/ zgodnie z Twoim urls.py
  const response = await axiosInstance.get('/availability/slots/', {
    params: {
      employee_id: employeeId,
      date: date,
      service_id: serviceId
    }
  });

  // Mapowanie: z obiektu {"start": "2023-10-10T09:00:00", ...} na string "09:00"
  return response.data.slots.map((slot: any) => {
    const timePart = slot.start.split('T')[1];
    return timePart.substring(0, 5);
  });
};