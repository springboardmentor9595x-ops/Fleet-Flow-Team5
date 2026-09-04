import api from './axios';

export function getFleetUtilizationReport(params = {}) {
  return api.get('/reports/fleet-utilization', { params });
}

export function getFuelConsumptionReport(params = {}) {
  return api.get('/reports/fuel-consumption', { params });
}

export function getDriverPerformanceReport(params = {}) {
  return api.get('/reports/driver-performance', { params });
}

export function getDeliveryPerformanceReport(params = {}) {
  return api.get('/reports/delivery-performance', { params });
}

export function getMaintenanceReport(params = {}) {
  return api.get('/reports/maintenance', { params });
}

/**
 * Triggers file download (PDF or Excel) for a given report endpoint
 */
export async function downloadReportFile(reportType, params = {}, format = 'pdf') {
  const endpointMap = {
    fleet_utilization: '/reports/fleet-utilization',
    fuel_consumption: '/reports/fuel-consumption',
    driver_performance: '/reports/driver-performance',
    delivery_performance: '/reports/delivery-performance',
    maintenance: '/reports/maintenance',
  };

  const url = endpointMap[reportType] || `/reports/${reportType}`;
  const response = await api.get(url, {
    params: { ...params, format },
    responseType: 'blob',
  });

  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  const filename = `${reportType}_report.${ext}`;

  const blob = new Blob([response.data], {
    type: format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf',
  });

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
