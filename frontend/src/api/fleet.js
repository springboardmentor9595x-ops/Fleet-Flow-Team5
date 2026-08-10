import api from "./axios";

export const fleetApi = {
  /**
   * List all vehicles.
   * @param {string|null} status - Optional filter: "Available" | "In Use" | "Maintenance"
   */
  getVehicles: (status = null) => {
    const params = { limit: 200 };
    if (status) params.status = status;
    return api.get("/vehicles/", { params }).then((r) => r.data);
  },

  /**
   * Get a single vehicle by ID.
   */
  getVehicle: (vehicleId) =>
    api.get(`/vehicles/${vehicleId}`).then((r) => r.data),

  /**
   * List all drivers.
   * @param {string|null} status - Optional filter: "Active" | "Inactive"
   */
  getDrivers: (status = null) => {
    const params = { limit: 200 };
    if (status) params.status = status;
    return api.get("/drivers/", { params }).then((r) => r.data);
  },

  /**
   * Get a single driver by ID.
   */
  getDriver: (driverId) =>
    api.get(`/drivers/${driverId}`).then((r) => r.data),
};

export default fleetApi;
