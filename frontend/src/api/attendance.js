import api from "./axios";

export const attendanceApi = {
  // Get daily roster or fleet-wide attendance
  getAttendance: (params = {}) =>
    api.get("/attendance/", { params }).then((r) => r.data),

  // Mark single driver attendance
  markAttendance: (data) =>
    api.post("/attendance/mark", data).then((r) => r.data),

  // Bulk mark attendance
  bulkMarkAttendance: (records) =>
    api.post("/attendance/bulk", { records }).then((r) => r.data),

  // Quick action: mark all unmarked drivers as Present for a date
  markAllPresent: (targetDate = null) => {
    const params = targetDate ? { target_date: targetDate } : {};
    return api.post("/attendance/mark-all-present", null, { params }).then((r) => r.data);
  },

  // Get specific driver's attendance history & summary stats
  getDriverAttendanceHistory: (driverId, params = {}) =>
    api.get(`/attendance/driver/${driverId}`, { params }).then((r) => r.data),

  // Driver get own attendance history
  getMyAttendanceHistory: (params = {}) =>
    api.get("/attendance/my-history", { params }).then((r) => r.data),

  // Driver self check-in
  checkInToday: () =>
    api.post("/attendance/check-in").then((r) => r.data),

  // Submit leave application
  applyLeave: (data) =>
    api.post("/attendance/leaves/apply", data).then((r) => r.data),

  // List leave applications
  getLeaves: (statusFilter = null) => {
    const params = statusFilter && statusFilter !== "All" ? { status_filter: statusFilter } : {};
    return api.get("/attendance/leaves", { params }).then((r) => r.data);
  },

  // Admin/FM approve or reject leave request
  reviewLeave: (leaveId, data) =>
    api.patch(`/attendance/leaves/${leaveId}/review`, data).then((r) => r.data),

  // Cancel/delete leave request
  cancelLeave: (leaveId) =>
    api.delete(`/attendance/leaves/${leaveId}`).then((r) => r.data),
};

export default attendanceApi;
