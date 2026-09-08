import api from './axios';

export function submitLeaveRequest(data, driverId = null) {
  const params = driverId ? { driver_id: driverId } : {};
  return api.post('/leave-requests/', data, { params });
}

export async function getLeaveRequests(params = {}) {
  try {
    const res = await api.get('/leave-requests/', { params });
    if (res.data && !Array.isArray(res.data) && Array.isArray(res.data.leaves)) {
      return { ...res, data: res.data.leaves };
    }
    return res;
  } catch (err) {
    if (err?.response?.status === 404) {
      const res = await api.get('/attendance/leaves');
      return res;
    }
    throw err;
  }
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
