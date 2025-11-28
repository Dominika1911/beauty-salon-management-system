// src/api/index.ts

export { api } from './axios';
export { authAPI } from './auth';
export { appointmentsAPI } from './appointments';
export { clientsAPI } from './clients';
export { servicesAPI } from './services';
export { employeesAPI } from './employees';
export { dashboardAPI } from './dashboard';

// Teraz możesz importować tak:
// import { authAPI, appointmentsAPI } from '../api';