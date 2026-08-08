import api from "./axios";

export const shipmentsApi = {
  // List all shipments (role-scoped)
  list: (skip = 0, limit = 100) =>
    api.get("/shipments", { params: { skip, limit } }).then((r) => r.data),

  // Get a single shipment by ID
  get: (id) => api.get(`/shipments/${id}`).then((r) => r.data),

  // Get shipment status history/timeline
  getHistory: (id) => api.get(`/shipments/${id}/history`).then((r) => r.data),

  // Create a new shipment
  create: (data) => api.post("/shipments", data).then((r) => r.data),

  // Update shipment details / reassign vehicle+driver
  update: (id, data) => api.put(`/shipments/${id}`, data).then((r) => r.data),

  // Update shipment status (Created → Assigned → In Transit → Delivered...)
  updateStatus: (id, status, note = "") =>
    api.patch(`/shipments/${id}/status`, { status, note }).then((r) => r.data),

  // Cancel or delete
  cancel: (id) =>
    api.delete(`/shipments/${id}`).then((r) => r.data),
  hardDelete: (id) =>
    api.delete(`/shipments/${id}`, { params: { hard_delete: true } }).then((r) => r.data),

  // Get delayed/alert shipments
  getAlerts: () => api.get("/shipments/alerts").then((r) => r.data),

  // By customer name
  getByCustomer: (name) =>
    api.get(`/shipments/customer/${encodeURIComponent(name)}`).then((r) => r.data),

  // By vehicle
  getByVehicle: (vehicleId) =>
    api.get(`/shipments/vehicle/${vehicleId}`).then((r) => r.data),

  // Route Optimization (TSP 2-Opt)
  optimizeRoute: (data) =>
    api.post("/shipments/optimize-route", data).then((r) => r.data),

  // Dynamic ETA for single shipment
  getETA: (id) =>
    api.get(`/shipments/${id}/eta`).then((r) => r.data),
};

export default shipmentsApi;
