import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import api from "../api/axios";
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Truck,
  Package,
  MapPin,
  Navigation,
  Zap,
  RefreshCw,
  Send,
} from "lucide-react";

/* ─── Animated logistics particles ───────────────────────────────────── */
const ROUTES = [
  { startX: -5, startY: 20, endX: 110, endY: 15, delay: 0, dur: 14 },
  { startX: -5, startY: 50, endX: 110, endY: 55, delay: 3, dur: 18 },
  { startX: -5, startY: 80, endX: 110, endY: 75, delay: 6, dur: 12 },
  { startX: 110, startY: 35, endX: -5, endY: 30, delay: 1, dur: 16 },
  { startX: 110, startY: 65, endX: -5, endY: 70, delay: 8, dur: 20 },
];

const ICONS = [Truck, Package, MapPin, Navigation];

const LogisticsParticle = ({ route, index }) => {
  const Icon = ICONS[index % ICONS.length];
  const goingRight = route.startX < 50;
  return (
    <div
      className="logistics-particle"
      style={{
        "--sx": `${route.startX}vw`,
        "--sy": `${route.startY}vh`,
        "--ex": `${route.endX}vw`,
        "--ey": `${route.endY}vh`,
        "--dur": `${route.dur}s`,
        "--delay": `${route.delay}s`,
        animationDelay: `${route.delay}s`,
        animationDuration: `${route.dur}s`,
      }}
    >
      <Icon
        style={{ transform: goingRight ? "scaleX(1)" : "scaleX(-1)" }}
        className="w-5 h-5"
      />
    </div>
  );
};

const RouteLines = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <line x1="0%" y1="20%" x2="100%" y2="15%" stroke="rgba(56,189,248,0.08)" strokeWidth="1" strokeDasharray="8 6" />
    <line x1="0%" y1="50%" x2="100%" y2="55%" stroke="rgba(99,102,241,0.08)" strokeWidth="1" strokeDasharray="8 6" />
    <line x1="0%" y1="80%" x2="100%" y2="75%" stroke="rgba(56,189,248,0.06)" strokeWidth="1" strokeDasharray="8 6" />
    <line x1="100%" y1="35%" x2="0%" y2="30%" stroke="rgba(251,191,36,0.07)" strokeWidth="1" strokeDasharray="6 8" />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [isUnverified, setIsUnverified] = useState(false);
  const [resending, setResending]     = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep]           = useState(1); // 1: Enter email, 2: Enter OTP & New Password
  const [forgotEmail, setForgotEmail]         = useState("");
  const [forgotOtp, setForgotOtp]             = useState("");
  const [forgotNewPass, setForgotNewPass]     = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotLoading, setForgotLoading]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsUnverified(false);
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      toast.success(`Welcome back, ${loggedInUser?.full_name || "User"}!`);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || "Authentication failed. Please check credentials.";
      setError(errMsg);
      toast.error(errMsg);
      if (errMsg.toLowerCase().includes("verify") || errMsg.toLowerCase().includes("not verified")) {
        setIsUnverified(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.warning("Please enter your email address.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail });
      toast.success(res.data.message || `Reset code dispatched to ${forgotEmail}`);
      setForgotStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send password reset code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (forgotNewPass.length < 6) {
      toast.warning("New password must be at least 6 characters long.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      toast.error("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        email: forgotEmail,
        otp: forgotOtp,
        new_password: forgotNewPass,
      });
      toast.success(res.data.message || "Password reset successfully! You can now sign in.");
      setShowForgotModal(false);
      setForgotStep(1);
      setEmail(forgotEmail);
      setPassword("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to reset password. Please verify the OTP code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      toast.warning("Please enter your email address to receive the verification link.");
      return;
    }
    setResending(true);
    try {
      const res = await api.post("/auth/resend-verification", { email });
      toast.success(res.data.message || `Verification link resent to ${email}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Could not resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-root">
      {/* ── Animated background ── */}
      <div className="auth-bg-layer">
        <div className="auth-glow glow-blue" />
        <div className="auth-glow glow-purple" />
        <RouteLines />
        {ROUTES.map((r, i) => (
          <LogisticsParticle key={i} route={r} index={i} />
        ))}
      </div>

      {/* ── Card ── */}
      <div className="auth-center z-10">
        <div className="auth-logo-row">
          <div className="ff-badge">
            <Truck className="w-5 h-5" />
          </div>
          <span className="auth-brand">FleetFlow</span>
        </div>

        <p className="auth-subtitle">Sign In to FleetFlow Portal</p>

        <div className="auth-panel">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="auth-error flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                {isUnverified && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/signup?otp=1&email=${encodeURIComponent(email)}`)}
                      className="text-xs bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition font-semibold"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Enter OTP to Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setResending(true);
                        try {
                          await api.post("/auth/resend-otp", { email });
                          toast.success(`Fresh OTP sent to ${email}`);
                          navigate(`/signup?otp=1&email=${encodeURIComponent(email)}`);
                        } catch (e) {
                          toast.error(e.response?.data?.detail || "Failed to resend OTP.");
                        } finally {
                          setResending(false);
                        }
                      }}
                      disabled={resending}
                      className="text-xs bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition"
                    >
                      {resending ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>Resend OTP</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Email */}
            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrap">
                <Mail className="auth-input-icon" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@fleetflow.com"
                  className="auth-input auth-input--icon-left"
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className="auth-label" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotStep(1);
                    setShowForgotModal(true);
                  }}
                  style={{
                    background: "none", border: "none", color: "#38BDF8", fontSize: "11px",
                    fontWeight: 700, cursor: "pointer", padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input auth-input--icon-left auth-input--icon-right"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="auth-eye-btn"
                  tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit auth-submit--blue"
            >
              {loading ? (
                <div className="auth-spinner" />
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch-text">
            Don't have an account?{" "}
            <Link to="/signup" className="auth-link">
              Sign up here
            </Link>
          </p>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15,23,42,0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#0F172A", border: "1px solid rgba(56,189,248,0.25)",
            borderRadius: "18px", maxWidth: "420px", width: "100%", padding: "24px",
            color: "#F8FAFC", boxShadow: "0 25px 60px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Lock size={18} color="#38BDF8" />
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Reset Password</h3>
                  <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>
                    {forgotStep === 1 ? "Step 1: Request 6-digit OTP code" : "Step 2: Enter OTP & New Password"}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowForgotModal(false)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleSendResetOtp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ fontSize: "12px", color: "#CBD5E1", margin: 0 }}>
                  Enter your registered FleetFlow account email. We will send a 6-digit verification code to reset your password.
                </p>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#94A3B8", display: "block", marginBottom: "4px" }}>
                    Account Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@fleetflow.com"
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: "8px",
                      background: "#1E293B", border: "1px solid #334155", color: "white", outline: "none", fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    style={{
                      padding: "8px 14px", borderRadius: "8px", background: "transparent",
                      border: "1px solid #334155", color: "#94A3B8", cursor: "pointer", fontSize: "12px", fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      padding: "8px 18px", borderRadius: "8px", background: "#0284C7",
                      border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                      opacity: forgotLoading ? 0.7 : 1, display: "flex", alignItems: "center", gap: "6px"
                    }}
                  >
                    {forgotLoading ? "Sending Code..." : "Send Reset Code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontSize: "12px", color: "#38BDF8", margin: 0, background: "rgba(56,189,248,0.1)", padding: "8px 10px", borderRadius: "8px" }}>
                  Verification code dispatched to <strong>{forgotEmail}</strong>
                </p>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#94A3B8", display: "block", marginBottom: "4px" }}>
                    6-Digit OTP Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    placeholder="e.g. 849201"
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: "8px", textAlign: "center", letterSpacing: "4px",
                      background: "#1E293B", border: "1px solid #0284C7", color: "#38BDF8", outline: "none", fontSize: "16px", fontWeight: 800, boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#94A3B8", display: "block", marginBottom: "4px" }}>
                    New Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: "8px",
                      background: "#1E293B", border: "1px solid #334155", color: "white", outline: "none", fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#94A3B8", display: "block", marginBottom: "4px" }}>
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={forgotConfirmPass}
                    onChange={(e) => setForgotConfirmPass(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: "8px",
                      background: "#1E293B", border: "1px solid #334155", color: "white", outline: "none", fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "11px", cursor: "pointer" }}
                  >
                    ← Back to email
                  </button>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      padding: "8px 18px", borderRadius: "8px", background: "#059669",
                      border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                      opacity: forgotLoading ? 0.7 : 1
                    }}
                  >
                    {forgotLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
