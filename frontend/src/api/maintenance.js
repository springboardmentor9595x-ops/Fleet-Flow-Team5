import api from './axios';

export function getMaintenance(params = {}) {
  return api.get('/maintenance/', { params });
}

export function getMaintenanceStats() {
  return api.get('/maintenance/stats/summary');
}

export function getMaintenanceById(id) {
  return api.get(`/maintenance/${id}`);
}

export function createMaintenance(data) {
  return api.post('/maintenance/', data);
}

export function updateMaintenance(id, data) {
  return api.put(`/maintenance/${id}`, data);
}

export function updateMaintenanceStatus(id, status) {
  return api.patch(`/maintenance/${id}/status`, { status });
}

export function deleteMaintenance(id) {
  return api.delete(`/maintenance/${id}`);
}

export function triggerMaintenanceAlerts() {
  return api.post('/maintenance/alerts/trigger');
}
