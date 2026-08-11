import api from "./axios";

export const tripsApi = {
  // Schedule a trip
  schedule: (data) => api.post("/trips", data).then((r) => r.data),

  // List all trips
  list: (skip = 0, limit = 100) =>
    api.get("/trips", { params: { skip, limit } }).then((r) => r.data),

  // Get single trip
  get: (id) => api.get(`/trips/${id}`).then((r) => r.data),

  // Start trip
  start: (id) => api.post(`/trips/${id}/start`).then((r) => r.data),

  // End trip
  end: (id, actualDistanceKm = null) =>
    api.post(`/trips/${id}/end`, { actual_distance_km: actualDistanceKm }).then((r) => r.data),

  // Recalculate route mid-trip
  recalculate: (id, currentLat, currentLon) =>
    api.post(`/trips/${id}/recalculate`, { current_lat: currentLat, current_lon: currentLon }).then((r) => r.data),

  // Get route options (fastest, shortest, traffic_avoidance, fuel_efficient)
  getRouteOptions: (id) => api.get(`/trips/${id}/route-options`).then((r) => r.data),
};

export default tripsApi;
