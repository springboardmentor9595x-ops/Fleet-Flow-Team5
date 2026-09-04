import api from './axios';

export function getFleetUtilization() {
  return api.get('/analytics/fleet-utilization');
}

export function getDriverPerformance(driverId = null) {
  const params = driverId ? { driver_id: driverId } : {};
  return api.get('/analytics/driver-performance', { params });
}

export function getDeliveryPerformance(params = {}) {
  return api.get('/analytics/delivery-performance', { params });
}

export function getMaintenanceAnalytics() {
  return api.get('/analytics/maintenance');
}

export function getFuelEfficiency() {
  return api.get('/analytics/fuel-efficiency');
}

export function getVehicleFuelTrends(vehicleId) {
  return api.get(`/analytics/fuel-trends/${vehicleId}`);
}

export function getOperationalSummary() {
  return api.get('/analytics/operational-summary');
}
