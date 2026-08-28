import api from "./axios";

export const notificationsApi = {
  getMyNotifications: (unreadOnly = false, limit = 50) =>
    api.get("/notifications/", { params: { unread_only: unreadOnly, limit } }).then((r) => r.data),

  markRead: (notificationId) =>
    api.put(`/notifications/${notificationId}/read`).then((r) => r.data),

  markAllRead: () =>
    api.put("/notifications/read-all").then((r) => r.data),
};

export default notificationsApi;
