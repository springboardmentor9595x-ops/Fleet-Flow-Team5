import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const [emailNotification, setEmailNotification] = useState(null);

  // Fetch current user details on mount if token exists
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get("/auth/me");
        setUser(response.data);
      } catch (err) {
        console.error("Failed to load user profile", err);
        logout();
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [token]);

  // Standard user login
  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await api.post("/auth/login", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const accessToken = res.data.access_token;
    localStorage.setItem("token", accessToken);
    setToken(accessToken);

    let userData = res.data.user;
    if (!userData) {
      const meRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      userData = meRes.data;
    }

    setUser(userData);
    return userData;
  };

  // Strict Admin Portal login
  const adminLogin = async (email, password) => {
    return await login(email, password);
  };


  // Signup for different roles
  const signup = async (userData) => {
    const res = await api.post("/auth/signup", userData);
    const newUser = res.data;

    setEmailNotification({
      type: "SIGNUP_EMAIL_SENT",
      title: "Welcome Email Dispatched!",
      message: `A confirmation welcome email has been queued and sent to ${newUser.email} for role [${newUser.role}].`,
      recipient: newUser.email,
      role: newUser.role,
    });

    return newUser;
  };

  // Verify OTP and auto-authenticate user
  const verifyOtp = async (email, otp) => {
    const res = await api.post("/auth/verify-otp", { email, otp });
    const accessToken = res.data.access_token;
    localStorage.setItem("token", accessToken);
    setToken(accessToken);

    let userData = res.data.user;
    if (!userData) {
      const meRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      userData = meRes.data;
    }
    setUser(userData);
    return userData;
  };

  // Resend OTP code
  const resendOtp = async (email) => {
    const res = await api.post("/auth/resend-otp", { email });
    return res.data;
  };

  // Admin add user functionality
  const adminAddUser = async (newUserData) => {
    const res = await api.post("/auth/admin/add-user", newUserData);
    const addedUser = res.data;

    setEmailNotification({
      type: "ADMIN_PROVISION_EMAIL_SENT",
      title: "User Credentials Emailed!",
      message: `Account created by Admin! Welcome email with login details has been sent to ${addedUser.email}.`,
      recipient: addedUser.email,
      role: addedUser.role,
    });

    return addedUser;
  };

  const fetchEmailLogs = async () => {
    const res = await api.get("/auth/email-logs");
    return res.data;
  };

  const updateProfile = async (profileData) => {
    const res = await api.patch("/auth/me", profileData);
    if (res.data?.access_token) {
      localStorage.setItem("token", res.data.access_token);
      setToken(res.data.access_token);
    }
    if (res.data?.user) {
      setUser(res.data.user);
    } else {
      const meRes = await api.get("/auth/me");
      setUser(meRes.data);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const clearNotification = () => setEmailNotification(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        emailNotification,
        login,
        adminLogin,
        signup,
        verifyOtp,
        resendOtp,
        adminAddUser,
        updateProfile,
        fetchEmailLogs,
        logout,
        clearNotification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
