import api from './axios';

export async function getShipments(params = {}) {
  const res = await api.get('/shipments/', { params });
  if (res.data && !Array.isArray(res.data) && Array.isArray(res.data.shipments)) {
    return { ...res, data: res.data.shipments, raw: res.data };
  }
  return res;
}

export function getShipmentById(id) {
  return api.get(`/shipments/${id}`);
}

export function getShipmentTracking(id) {
  return api.get(`/shipments/${id}/tracking`);
}

export function trackShipmentByNumber(trackingNumber) {
  return api.get(`/shipments/tracking/${trackingNumber}`);
}

export async function getDelayedAlerts() {
  try {
    return await api.get('/shipments/alerts/delayed');
  } catch (err) {
    if (err?.response?.status === 404) {
      return await api.get('/shipments/alerts');
    }
    throw err;
  }
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
