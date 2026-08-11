import api from './axios';

export function getVehicles(params = {}) {
  return api.get('/vehicles/', { params });
}

export function getVehicleStats() {
  return api.get('/vehicles/stats/summary');
}

export function getVehicleById(id) {
  return api.get(`/vehicles/${id}`);
}

export function createVehicle(data) {
  return api.post('/vehicles/', data);
}

export function updateVehicle(id, data) {
  return api.put(`/vehicles/${id}`, data);
}

export function deleteVehicle(id) {
  return api.delete(`/vehicles/${id}`);
}

export function assignDriver(vehicleId, driverId) {
  return api.post(`/vehicles/${vehicleId}/assign-driver`, null, {
    params: { driver_id: driverId },
  });
}
