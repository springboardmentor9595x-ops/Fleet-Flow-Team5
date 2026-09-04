import api from './axios';

export function getDrivers(params = {}) {
  return api.get('/drivers/', { params });
}

export function getDriver(driverId) {
  return api.get(`/drivers/${driverId}`);
}

export function registerDriver(data) {
  return api.post('/drivers/', data);
}

export function updateDriver(driverId, data) {
  return api.put(`/drivers/${driverId}`, data);
}
