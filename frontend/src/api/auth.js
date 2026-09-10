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

export async function verifyEmail(email, code) {
  const cleanEmail = typeof email === 'object' && email !== null ? email.email : email;
  const cleanCode = typeof email === 'object' && email !== null ? (email.code || email.otp) : code;

  try {
    return await api.post('/auth/verify-email', { email: cleanEmail, code: cleanCode });
  } catch (err) {
    if (err?.response?.status === 404) {
      // Fallback for deployed Render backend supporting /auth/verify-otp
      return await api.post('/auth/verify-otp', { email: cleanEmail, otp: cleanCode });
    }
    throw err;
  }
}

export async function resendVerification(email) {
  const cleanEmail = typeof email === 'object' && email !== null ? email.email : email;
  try {
    return await api.post('/auth/resend-verification', { email: cleanEmail });
  } catch (err) {
    if (err?.response?.status === 404) {
      // Fallback for deployed Render backend supporting /auth/resend-otp
      return await api.post('/auth/resend-otp', { email: cleanEmail });
    }
    throw err;
  }
}

export function updateProfile(data) {
  return api.put('/auth/me', data);
}

export function changePassword(data) {
  return api.post('/auth/change-password', data);
}