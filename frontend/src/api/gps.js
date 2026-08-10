import api from "./axios";

export const gpsApi = {
  // Get latest GPS position for a vehicle
  getLatest: (vehicleId) =>
    api.get(`/gps/${vehicleId}/latest`).then((r) => r.data),

  // Get historical GPS track points for a vehicle
  getTrack: (vehicleId, limit = 200, since = null) => {
    const params = { limit };
    if (since) params.since = since;
    return api.get(`/gps/${vehicleId}/track`, { params }).then((r) => r.data);
  },
};

// Create a WebSocket connection to the live tracking endpoint
export function createTrackingWebSocket(vehicleId) {
  const wsUrl = `ws://127.0.0.1:8000/ws/tracking/${vehicleId}`;
  return new WebSocket(wsUrl);
}

export default gpsApi;
