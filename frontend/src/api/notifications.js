import api from './axios';

export function getNotifications(params = {}) {
  return api.get('/notifications/', { params });
}

export function markNotificationRead(notificationId) {
  return api.patch(`/notifications/${notificationId}/read`);
}

export function markAllNotificationsRead() {
  return api.patch('/notifications/read-all');
}

