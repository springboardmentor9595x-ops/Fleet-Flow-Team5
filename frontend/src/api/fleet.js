import api from "./axios";

export const fleetApi = {
  // List all vehicles
  getVehicles: (status = null) => {
    const params = { limit: 200 };
    if (status) params.status = status;
    return api.get("/vehicles/", { params }).then((r) => r.data);
  },

  // Get single vehicle
  getVehicle: (vehicleId) =>
    api.get(`/vehicles/${vehicleId}`).then((r) => r.data),

  // Create vehicle
  createVehicle: (data) =>
    api.post("/vehicles/", data).then((r) => r.data),

  // Update vehicle
  updateVehicle: (vehicleId, data) =>
    api.put(`/vehicles/${vehicleId}`, data).then((r) => r.data),

  // Delete vehicle
  deleteVehicle: (vehicleId) =>
    api.delete(`/vehicles/${vehicleId}`).then((r) => r.data),

  // List all drivers
  getDrivers: (status = null) => {
    const params = { limit: 200 };
    if (status) params.status = status;
    return api.get("/drivers/", { params }).then((r) => r.data);
  },

  // Get single driver
  getDriver: (driverId) =>
    api.get(`/drivers/${driverId}`).then((r) => r.data),

  // Create driver
  createDriver: (data) =>
    api.post("/drivers/", data).then((r) => r.data),

  // Update driver
  updateDriver: (driverId, data) =>
    api.put(`/drivers/${driverId}`, data).then((r) => r.data),

  // Delete driver
  deleteDriver: (driverId) =>
    api.delete(`/drivers/${driverId}`).then((r) => r.data),

  // Driver self-get own profile
  getMyDriver: () =>
    api.get("/drivers/me").then((r) => r.data),

  // Driver self-update own status (Active / Inactive)
  setMyStatus: (status) =>
    api.patch("/drivers/me/status", { status }).then((r) => r.data),

  // Admin/FleetManager quick-toggle a driver's status
  toggleDriverStatus: (driverId, status) =>
    api.put(`/drivers/${driverId}`, { status }).then((r) => r.data),
};

export default fleetApi;
