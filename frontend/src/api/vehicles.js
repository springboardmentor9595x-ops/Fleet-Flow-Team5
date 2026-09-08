import api from './axios';

export async function getVehicles(params = {}) {
  const res = await api.get('/vehicles/', { params });
  if (res.data && !Array.isArray(res.data) && Array.isArray(res.data.vehicles)) {
    return { ...res, data: res.data.vehicles, raw: res.data };
  }
  return res;
}

export async function getVehicleStats() {
  try {
    return await api.get('/vehicles/stats/summary');
  } catch (err) {
    if (err?.response?.status === 404) {
      const res = await api.get('/dashboard/fleet');
      const sb = res.data?.status_breakdown || {};
      return {
        data: {
          total: res.data?.total_vehicles || 0,
          available: sb['Available'] || 0,
          in_transit: (sb['In Transit'] || 0) + (sb['In Use'] || 0),
          maintenance: sb['Maintenance'] || 0,
          out_of_service: sb['Inactive'] || 0,
          assigned: sb['Assigned'] || 0,
        },
      };
    }
    throw err;
  }
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
