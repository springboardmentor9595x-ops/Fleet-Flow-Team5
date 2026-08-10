import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Truck,
  ArrowRight,
  Mail,
  ShieldCheck,
  Package,
  MapPin,
  Navigation,
} from "lucide-react";

/* ─── Animated logistics particles ───────────────────────────────────── */
const ROUTES = [
  { startX: -5, startY: 20, endX: 110, endY: 15, delay: 0, dur: 14 },
  { startX: -5, startY: 50, endX: 110, endY: 55, delay: 3, dur: 18 },
  { startX: -5, startY: 80, endX: 110, endY: 75, delay: 6, dur: 12 },
];

const ICONS = [Truck, Package, MapPin, Navigation];

const LogisticsParticle = ({ route, index }) => {
  const Icon = ICONS[index % ICONS.length];
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
      <Icon className="w-5 h-5" />
    </div>
  );
};

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [status, setStatus] = useState("verifying"); 
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please check your verification link.");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await api.post(`/auth/verify-email?token=${token}`);
        setStatus("success");
        setMessage(response.data.message || "Email verified successfully!");
        toast.success("Email verified successfully! You can now log in.");
      } catch (err) {
        console.error("Verification error:", err);
        setStatus("error");
        const errMsg = err.response?.data?.detail || "Verification failed or token expired.";
        setMessage(errMsg);
        toast.error(errMsg);
      }
    };

    verifyToken();
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) {
      toast.warning("Please enter your registered email address.");
      return;
    }
    setResending(true);
    try {
      const res = await api.post("/auth/resend-verification", { email: resendEmail });
      toast.success(res.data.message || "Verification email sent!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-bg-layer">
        <div className="auth-glow glow-blue" />
        <div className="auth-glow glow-purple" />
        {ROUTES.map((r, i) => (
          <LogisticsParticle key={i} route={r} index={i} />
        ))}
      </div>

      <div className="auth-center z-10" style={{ maxWidth: "520px" }}>
        <div className="auth-logo-row">
          <div className="ff-badge">
            <Truck className="w-5 h-5 text-sky-400" />
          </div>
          <span className="auth-brand">FleetFlow</span>
        </div>

        <p className="auth-subtitle">Email Address Verification</p>

        <div className="auth-panel text-center py-6">
          {status === "verifying" && (
            <div className="space-y-4 py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center animate-spin">
                <RefreshCw className="w-8 h-8 text-sky-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Verifying Email...</h3>
              <p className="text-sm text-slate-300">
                Please wait while we validate your email verification token.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Email Verified!</h3>
                <p className="text-slate-300 mt-2 text-sm leading-relaxed">{message}</p>
                <div className="mt-3 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Your account is now active and ready for secure login.</span>
                </div>
              </div>

              <button
                onClick={() => navigate("/login")}
                className="auth-submit auth-submit--blue w-full flex items-center justify-center gap-2"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <XCircle className="w-10 h-10 text-rose-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Verification Failed</h3>
                <p className="text-slate-300 mt-2 text-sm">{message}</p>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-left space-y-3">
                <p className="text-xs font-semibold text-slate-300">Need a new verification link?</p>
                <form onSubmit={handleResend} className="space-y-3">
                  <div className="auth-input-wrap">
                    <Mail className="auth-input-icon text-slate-400" />
                    <input
                      type="email"
                      required
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="Enter your registered email"
                      className="auth-input auth-input--icon-left text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resending}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
                  >
                    {resending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Resend Verification Email</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="pt-2">
                <Link to="/login" className="text-xs text-sky-400 hover:underline">
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default VerifyEmail;
