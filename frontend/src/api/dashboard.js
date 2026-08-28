import api from "./axios";

export const dashboardApi = {
  getFleetDashboard: () => api.get("/dashboard/fleet").then((r) => r.data),
  getLogisticsDashboard: () => api.get("/dashboard/logistics").then((r) => r.data),
  getAdminDashboard: () => api.get("/dashboard/admin").then((r) => r.data),
  getDriverDashboard: () => api.get("/dashboard/driver").then((r) => r.data),
};

export default dashboardApi;
