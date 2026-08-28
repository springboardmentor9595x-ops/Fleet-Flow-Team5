import api from "./axios";

export const reportsApi = {
  getFleetUtilization: (startDate, endDate) =>
    api.get("/reports/fleet-utilization", { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),

  getFuelConsumption: (startDate, endDate) =>
    api.get("/reports/fuel-consumption", { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),

  getDriverPerformance: (startDate, endDate) =>
    api.get("/reports/driver-performance", { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),

  getDeliveryPerformance: (startDate, endDate) =>
    api.get("/reports/delivery-performance", { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),

  getMaintenance: (startDate, endDate) =>
    api.get("/reports/maintenance", { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),

  exportPdf: async (reportType, startDate, endDate) => {
    const response = await api.get("/reports/export/pdf", {
      params: { report_type: reportType, start_date: startDate, end_date: endDate },
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FleetFlow_${reportType.replace("-", "_")}_${startDate}_${endDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  exportExcel: async (reportType, startDate, endDate) => {
    const response = await api.get("/reports/export/excel", {
      params: { report_type: reportType, start_date: startDate, end_date: endDate },
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FleetFlow_${reportType.replace("-", "_")}_${startDate}_${endDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default reportsApi;
