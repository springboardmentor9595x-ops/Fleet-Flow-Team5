import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getMe, login as loginRequest, signup as signupRequest } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('fleetflow_token') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Ref to suppress the restoreSession effect while a login is in progress,
  // preventing a race condition where setToken() during login triggers a
  // redundant getMe() call before the login's own getMe() completes.
  const skipRestoreRef = useRef(false);

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }

      // Skip during an active login() call — login handles its own getMe.
      if (skipRestoreRef.current) return;

      try {
        // A persisted token is checked with /auth/me before protected content renders.
        const response = await getMe(token);
        setUser(response.data);
      } catch {
        localStorage.removeItem('fleetflow_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [token]);

  const login = useCallback(async (email, password) => {
    setError('');
    setLoading(true);
    skipRestoreRef.current = true;
    try {
      // 1. Exchange credentials for a JWT.
      const response = await loginRequest({ email, password });
      const nextToken = response.data.access_token;
      localStorage.setItem('fleetflow_token', nextToken);

      // 2. Fetch the user profile before updating state so that
      //    isAuthenticated is true by the time the caller navigates.
      const userResponse = await getMe(nextToken);

      // 3. Commit both token + user atomically (no intermediate state where
      //    token is set but user is null, which would break ProtectedRoute).
      setToken(nextToken);
      setUser(userResponse.data);

      return nextToken;
    } catch (err) {
      // Expose the server detail so LoginForm can display it.
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Login failed. Please try again.');
      throw err;
    } finally {
      skipRestoreRef.current = false;
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (payload) => {
    setError('');
    setLoading(true);
    try {
      const response = await signupRequest(payload);
      return response.data;
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Signup failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fleetflow_token');
    setToken(null);
    setUser(null);
    setError('');
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      error,
      isAuthenticated: Boolean(token && user),
      login,
      signup,
      logout,
    }),
    [token, user, loading, error, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
