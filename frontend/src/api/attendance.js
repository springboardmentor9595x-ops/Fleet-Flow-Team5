import api from './axios';

export function markAttendance(data) {
  return api.post('/attendance/', data);
}

export function getFleetAttendance(params = {}) {
  return api.get('/attendance/', { params });
}

export function getDriverAttendanceHistory(driverId, params = {}) {
  return api.get(`/attendance/driver/${driverId}`, { params });
}

export function getDriverAttendanceSummary(driverId, params = {}) {
  return api.get(`/attendance/driver/${driverId}/summary`, { params });
}

export function getMyAttendanceSummary(params = {}) {
  return api.get('/attendance/me/summary', { params });
}

export function getMyAttendanceHistory(params = {}) {
  return api.get('/attendance/me', { params });
}

export function markMyAttendance(params = {}) {
  return api.post('/attendance/me', null, { params });
}

export function checkInDriver() {
  return api.post('/attendance/me/check-in');
}

export function checkOutDriver() {
  return api.post('/attendance/me/check-out');
}

export function getMyTodayAttendance() {
  return api.get('/attendance/me/today');
}
