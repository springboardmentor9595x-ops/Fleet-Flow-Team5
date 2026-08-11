import api from './axios';

export function getShipments(params = {}) {
  return api.get('/shipments/', { params });
}

export function getShipmentById(id) {
  return api.get(`/shipments/${id}`);
}

export function trackShipmentByNumber(trackingNumber) {
  return api.get(`/shipments/tracking/${trackingNumber}`);
}

export function getDelayedAlerts() {
  return api.get('/shipments/alerts/delayed');
}

export function createShipment(data) {
  return api.post('/shipments/', data);
}

export function updateShipment(id, data) {
  return api.put(`/shipments/${id}`, data);
}

export function updateShipmentStatus(id, status, notes = '') {
  return api.patch(`/shipments/${id}/status`, { status, notes });
}

export function cancelShipment(id) {
  return api.post(`/shipments/${id}/cancel`);
}
