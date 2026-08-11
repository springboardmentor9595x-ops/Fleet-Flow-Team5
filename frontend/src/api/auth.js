import api from './axios';

export function signup(data) {
  return api.post('/auth/signup', data);
}

export function login(data) {
  const formData = new URLSearchParams();
  formData.append('username', data.email);
  formData.append('password', data.password);

  return api.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

export function getMe(token) {
  return api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function verifyEmail(token) {
  return api.get('/auth/verify-email', { params: { token } });
}

export function resendVerification(email) {
  return api.post('/auth/resend-verification', { email });
}