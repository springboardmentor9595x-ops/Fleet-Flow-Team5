import api from './axios';

export function submitLeaveRequest(data, driverId = null) {
  const params = driverId ? { driver_id: driverId } : {};
  return api.post('/leave-requests/', data, { params });
}

export function getLeaveRequests(params = {}) {
  return api.get('/leave-requests/', { params });
}

export function getDriverLeaveRequests(driverId, params = {}) {
  return api.get(`/leave-requests/driver/${driverId}`, { params });
}

export function reviewLeaveRequest(leaveId, data) {
  return api.post(`/leave-requests/${leaveId}/review`, data);
}

export function cancelLeaveRequest(leaveId) {
  return api.post(`/leave-requests/${leaveId}/cancel`);
}
