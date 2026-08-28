import api from "./axios";

export const maintenanceApi = {
  // Get maintenance records
  getMaintenance: (skip = 0, limit = 100) =>
    api.get("/maintenance/", { params: { skip, limit } }).then((r) => r.data),

  // Create maintenance record
  addMaintenance: (data) =>
    api.post("/maintenance/", data).then((r) => r.data),

  // Update maintenance record
  updateMaintenance: (maintenanceId, data) =>
    api.put(`/maintenance/${maintenanceId}`, data).then((r) => r.data),

  // Resolve maintenance record (1-click action)
  resolveMaintenance: (maintenanceId) =>
    api.post(`/maintenance/${maintenanceId}/resolve`).then((r) => r.data),

  // Get active maintenance alerts (5-day, 1-day, due/overdue)
  getAlerts: () =>
    api.get("/maintenance/alerts").then((r) => r.data),

  // Trigger alert check / notification engine
  checkAlerts: () =>
    api.post("/maintenance/check-alerts").then((r) => r.data),

  // Get fuel logs
  getFuelLogs: (skip = 0, limit = 100) =>
    api.get("/maintenance/fuel", { params: { skip, limit } }).then((r) => r.data),

  // Create fuel log
  addFuelLog: (data) =>
    api.post("/maintenance/fuel", data).then((r) => r.data),
};

export default maintenanceApi;

