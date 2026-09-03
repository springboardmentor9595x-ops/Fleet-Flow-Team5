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

  // Submit a GPS coordinate for a vehicle (used for simulation)
  pushPing: (vehicleId, latitude, longitude, speed = null, heading = null) =>
    api.post(`/gps/${vehicleId}/ping`, { latitude, longitude, speed, heading }).then((r) => r.data),

  // Get latest position for all vehicles
  getAllLatest: () =>
    api.get("/gps/all-vehicles/latest").then((r) => r.data),
};

// Create a WebSocket connection to the live tracking endpoint
export function createTrackingWebSocket(vehicleId) {
  let wsBase = import.meta.env.VITE_WS_URL;
  if (!wsBase) {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
      wsBase = apiUrl.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
    } else {
      wsBase = "ws://127.0.0.1:8000";
    }
  }
  // Strip trailing slash if present
  wsBase = wsBase.replace(/\/+$/, "");
  const wsUrl = `${wsBase}/ws/tracking/${vehicleId}`;
  return new WebSocket(wsUrl);
}

export default gpsApi;
