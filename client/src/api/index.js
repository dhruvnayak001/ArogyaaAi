/**
 * api/index.js
 * Barrel export for all API modules
 */

export { authApi }              from './auth.api';
export { chatApi }              from './chat.api';
export { appointmentsApi }      from './appointments.api';
export { recordsApi }           from './records.api';
export { doctorsApi }           from './doctors.api';
export { notificationsApi }     from './notifications.api';
export { aiApi }                from './ai.api';
export { default as apiClient } from './axios';

