import api from './axios';

export async function getFleetUtilization() {
  try {
    return await api.get('/analytics/fleet-utilization');
  } catch (err) {
    if (err?.response?.status === 404) {
      const res = await api.get('/reports/fleet-utilization');
      return {
        data: {
          fleet_utilization_rate_pct: res.data?.utilization_rate ?? 0,
          total_active_vehicles: res.data?.total_vehicles ?? 0,
          utilized_vehicles: res.data?.active_vehicles ?? 0,
          status_breakdown: res.data?.status_breakdown || {},
          trend: res.data?.data || []
        }
      };
    }
    throw err;
  }
}

export async function getDriverPerformance(driverId = null) {
  try {
    const params = driverId ? { driver_id: driverId } : {};
    return await api.get('/analytics/driver-performance', { params });
  } catch (err) {
    if (err?.response?.status === 404) {
      return await api.get('/reports/driver-performance');
    }
    throw err;
  }
}

export async function getDeliveryPerformance(params = {}) {
  try {
    return await api.get('/analytics/delivery-performance', { params });
  } catch (err) {
    if (err?.response?.status === 404) {
      return await api.get('/reports/delivery-performance', { params });
    }
    throw err;
  }
}

export async function getMaintenanceAnalytics() {
  try {
    return await api.get('/analytics/maintenance');
  } catch (err) {
    if (err?.response?.status === 404) {
      return await api.get('/reports/maintenance');
    }
    throw err;
  }
}

export async function getFuelEfficiency() {
  try {
    return await api.get('/analytics/fuel-efficiency');
  } catch (err) {
    if (err?.response?.status === 404) {
      return await api.get('/reports/fuel-consumption');
    }
    throw err;
  }
}

export function getVehicleFuelTrends(vehicleId) {
  return api.get(`/analytics/fuel-trends/${vehicleId}`);
}

export async function getOperationalSummary() {
  try {
    return await api.get('/analytics/operational-summary');
  } catch (err) {
    if (err?.response?.status === 404) {
      return await api.get('/dashboard/admin');
    }
    throw err;
  }
}
