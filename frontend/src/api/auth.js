import api from './axios';

export function signup(data) {
  return api.post('/auth/signup', data);
}

export function login(data) {
  const formData = new URLSearchParams();
  formData.append('username', data.email);
  formData.append('password', data.password);
  if (data.role) {
    formData.append('role', data.role);
  }

  return api.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

export function getMe(token) {
  return api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function verifyEmail(email, code) {
  if (typeof email === 'object' && email !== null) {
    return api.post('/auth/verify-email', email);
  }
  return api.post('/auth/verify-email', { email, code });
}

export function resendVerification(email) {
  return api.post('/auth/resend-verification', { email });
}

export function updateProfile(data) {
  return api.put('/auth/me', data);
}

export function changePassword(data) {
  return api.post('/auth/change-password', data);
}