import api from './axios';

export function calculateRoutes(source, destination, coords = {}) {
  return api.post('/trips/calculate-routes', {
    source,
    destination,
    start_lat: coords.start_lat,
    start_lng: coords.start_lng,
    dest_lat: coords.dest_lat,
    dest_lng: coords.dest_lng,
  });
}

export function getTrips(params = {}) {
  return api.get('/trips/', { params });
}

export function getTripById(id) {
  return api.get(`/trips/${id}`);
}

export function createTrip(data) {
  return api.post('/trips/', data);
}

export function startTrip(id) {
  return api.post(`/trips/${id}/start`);
}

export function endTrip(id) {
  return api.post(`/trips/${id}/end`);
}

export function recalculateTrip(id, currentLat, currentLng, routeType) {
  return api.post(`/trips/${id}/recalculate`, {
    current_lat: currentLat,
    current_lng: currentLng,
    route_type: routeType,
  });
}

export function cancelTrip(id) {
  return api.post(`/trips/${id}/cancel`);
}

export function sendSimulatedPing(data) {
  return api.post('/realtime/simulate-ping', data);
}

export function getLatestLocations() {
  return api.get('/realtime/latest-locations');
}
