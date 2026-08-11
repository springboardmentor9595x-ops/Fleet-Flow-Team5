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
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={resending}
                    className="mt-1 text-xs bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition"
                  >
                    {resending ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>Resend Verification Email to {email}</span>
                  </button>
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
              <label className="auth-label">Password</label>
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
    </div>
  );
};

export default Login;
