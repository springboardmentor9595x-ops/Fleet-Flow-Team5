import api from './axios';

export function getUsers(params = {}) {
  return api.get('/users/', { params });
}

export function getUserById(id) {
  return api.get(`/users/${id}`);
}

export function updateUserRole(userId, role) {
  return api.patch(`/users/${userId}/role`, { role });
}
