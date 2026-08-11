import api from "./axios";

export const maintenanceApi = {
  // Get maintenance records
  getMaintenance: (skip = 0, limit = 100) =>
    api.get("/maintenance/", { params: { skip, limit } }).then((r) => r.data),

  // Create maintenance record
  addMaintenance: (data) =>
    api.post("/maintenance/", data).then((r) => r.data),

  // Get fuel logs
  getFuelLogs: (skip = 0, limit = 100) =>
    api.get("/maintenance/fuel", { params: { skip, limit } }).then((r) => r.data),

  // Create fuel log
  addFuelLog: (data) =>
    api.post("/maintenance/fuel", data).then((r) => r.data),
};

export default maintenanceApi;
