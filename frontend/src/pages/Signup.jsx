import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import {
  ShieldCheck,
  Truck,
  MapPin,
  UserCheck,
  Mail,
  ArrowRight,
  Lock,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  User,
  Package,
  Navigation,
  Zap,
  CreditCard,
  Building,
  Check,
  X
} from "lucide-react";

/* ─── Animated logistics particles ───────────────────────────────────── */
const ROUTES = [
  { startX: -5, startY: 15, endX: 110, endY: 20, delay: 0,  dur: 16 },
  { startX: -5, startY: 45, endX: 110, endY: 50, delay: 5,  dur: 20 },
  { startX: -5, startY: 75, endX: 110, endY: 80, delay: 10, dur: 13 },
  { startX: 110, startY: 30, endX: -5, endY: 25, delay: 2,  dur: 18 },
  { startX: 110, startY: 60, endX: -5, endY: 65, delay: 7,  dur: 22 },
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
    <line x1="0%" y1="15%" x2="100%" y2="20%" stroke="rgba(56,189,248,0.08)" strokeWidth="1" strokeDasharray="8 6" />
    <line x1="0%" y1="45%" x2="100%" y2="50%" stroke="rgba(99,102,241,0.08)" strokeWidth="1" strokeDasharray="8 6" />
    <line x1="0%" y1="75%" x2="100%" y2="80%" stroke="rgba(56,189,248,0.06)" strokeWidth="1" strokeDasharray="8 6" />
    <line x1="100%" y1="30%" x2="0%" y2="25%" stroke="rgba(251,191,36,0.07)" strokeWidth="1" strokeDasharray="6 8" />
  </svg>
);

const checkPasswordCriteria = (pass) => {
  return {
    minLength: pass.length >= 8,
    hasLower: /[a-z]/.test(pass),
    hasUpper: /[A-Z]/.test(pass),
    hasNumber: /[0-9]/.test(pass),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_]/.test(pass),
  };
};

const getStrengthDetails = (criteria) => {
  const count = Object.values(criteria).filter(Boolean).length;
  if (count <= 2) {
    return { score: count, label: "Weak Password", color: "bg-rose-500", textColor: "text-rose-400", barPercent: "33%" };
  } else if (count <= 4) {
    return { score: count, label: "Medium Password", color: "bg-amber-500", textColor: "text-amber-400", barPercent: "66%" };
  } else {
    return { score: count, label: "Strong Password", color: "bg-emerald-500", textColor: "text-emerald-400", barPercent: "100%" };
  }
};

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, verifyOtp, resendOtp } = useAuth();

  const [step, setStep] = useState(searchParams.get("otp") ? "otp" : "form"); // "form" | "otp"
  const [role, setRole] = useState("Driver");
  const [formData, setFormData] = useState({
    full_name: "",
    email: searchParams.get("email") || "",
    password: "",
    admin_secret_key: "",
    license_number: "",
    hub_location: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPass, setShowPass]               = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showAdminKey, setShowAdminKey]       = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [otp, setOtp]                         = useState("");
  const [verifyingOtp, setVerifyingOtp]       = useState(false);
  const [resendCooldown, setResendCooldown]   = useState(0);
  const [resendingOtp, setResendingOtp]       = useState(false);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const roles = [
    { id: "Driver", title: "Vehicle Driver", icon: UserCheck, activeBg: "role-card--green" },
    { id: "FleetManager", title: "Fleet Manager", icon: Truck, activeBg: "role-card--blue" },
    { id: "Dispatcher", title: "Dispatcher", icon: MapPin, activeBg: "role-card--purple" },
    { id: "Admin", title: "System Admin", icon: ShieldCheck, activeBg: "role-card--amber" },
  ];

  const criteria = checkPasswordCriteria(formData.password);
  const strength = getStrengthDetails(criteria);
  const isPasswordStrong = strength.score === 5;
  const passwordsMatch = confirmPassword.length > 0 && formData.password === confirmPassword;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isPasswordStrong) {
      const errMsg = "Please enter a strong password meeting all 5 security criteria.";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!passwordsMatch) {
      const errMsg = "Passwords do not match. Please verify confirm password.";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: role,
        admin_secret_key: role === "Admin" ? formData.admin_secret_key : null,
        license_number: role === "Driver" ? formData.license_number : null,
        hub_location: role === "FleetManager" || role === "Dispatcher" ? formData.hub_location : null,
      };
      await signup(payload);
      setStep("otp");
      setResendCooldown(60);
      toast.success("Account registered! A 6-digit OTP has been sent to your email.");
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || "Signup failed. Please check form details.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit OTP code.");
      return;
    }
    setVerifyingOtp(true);
    setError("");
    try {
      const authUser = await verifyOtp(formData.email, otp.trim());
      toast.success(`🎉 Verification successful! Welcome to FleetFlow, ${authUser?.full_name || "User"}!`);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || "Invalid or expired OTP code.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendingOtp) return;
    if (!formData.email) {
      toast.warning("Please specify an email address.");
      return;
    }
    setResendingOtp(true);
    setError("");
    try {
      const res = await resendOtp(formData.email);
      toast.success(res.message || `Fresh OTP sent to ${formData.email}`);
      setResendCooldown(60);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to resend OTP.");
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <div className="auth-root">
      {/* ── Animated background ── */}
      <div className="auth-bg-layer">
        <div className="auth-glow glow-blue" style={{ top: "20%", left: "30%" }} />
        <div className="auth-glow glow-purple" style={{ bottom: "15%", right: "20%" }} />
        <RouteLines />
        {ROUTES.map((r, i) => (
          <LogisticsParticle key={i} route={r} index={i} />
        ))}
      </div>

      {/* ── Card ── */}
      <div className="auth-center z-10 my-8" style={{ maxWidth: "540px" }}>
        <div className="auth-logo-row">
          <div className="ff-badge">
            <Truck className="w-5 h-5" />
          </div>
          <span className="auth-brand">FleetFlow</span>
        </div>
        <p className="auth-subtitle">
          {step === "otp" ? "Email OTP Verification" : "Create Account & Role Profile"}
        </p>

        <div className="auth-panel">
          {step === "otp" ? (
            <div className="space-y-6 py-2">
              <div className="text-center">
                <div className="success-icon-wrap" style={{ background: "rgba(13, 148, 136, 0.15)", border: "1px solid rgba(13, 148, 136, 0.3)" }}>
                  <KeyRound className="w-8 h-8 text-teal-400" />
                </div>
                <h3 className="text-xl font-bold text-white mt-3">Verify Your Email</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                  We sent a 6-digit OTP code to <strong className="text-sky-400">{formData.email}</strong>. Enter the OTP code below to verify your account and sign in.
                </p>
              </div>

              {error && (
                <div className="auth-error">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="auth-field">
                  <label className="auth-label text-center block mb-2">6-Digit Verification Code</label>
                  <div className="flex justify-center">
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="••••••"
                      autoFocus
                      required
                      className="auth-input text-center text-2xl font-mono font-bold text-white bg-slate-900/90 border-slate-700 focus:border-teal-500 rounded-xl"
                      style={{ maxWidth: "260px", letterSpacing: "10px", height: "54px" }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 text-center mt-2">
                    Code expires in 10 minutes. Please check your inbox / spam folder.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={verifyingOtp || otp.length < 6}
                  className="auth-submit auth-submit--blue"
                  style={{ opacity: (verifyingOtp || otp.length < 6) ? 0.7 : 1 }}
                >
                  {verifyingOtp ? (
                    <div className="auth-spinner" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Verify OTP & Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-slate-400 hover:text-slate-200 transition font-medium"
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || resendingOtp}
                  className="text-sky-400 hover:text-sky-300 font-semibold disabled:text-slate-500 disabled:cursor-not-allowed transition"
                >
                  {resendingOtp
                    ? "Sending..."
                    : resendCooldown > 0
                    ? `Resend OTP (${resendCooldown}s)`
                    : "Resend OTP"}
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="auth-error">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Role selection */}
              <div>
                <label className="auth-label mb-2 block">Select Role</label>
                <div className="role-grid">
                  {roles.map((r) => {
                    const Icon = r.icon;
                    const isSelected = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`role-card ${isSelected ? r.activeBg : "role-card--default"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? "text-white" : "text-slate-400"}`} />
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white/70" />}
                        </div>
                        <div className={`text-xs font-bold ${isSelected ? "text-white" : "text-slate-300"}`}>
                          {r.title}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full Name */}
              <div className="auth-field">
                <label className="auth-label">Full Name</label>
                <div className="auth-input-wrap">
                  <User className="auth-input-icon" />
                  <input
                    type="text"
                    name="full_name"
                    required
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Alex Morgan"
                    className="auth-input auth-input--icon-left"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="auth-field">
                <label className="auth-label">Email Address</label>
                <div className="auth-input-wrap">
                  <Mail className="auth-input-icon" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="alex@fleetflow.com"
                    className="auth-input auth-input--icon-left"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field">
                <div className="flex justify-between items-center mb-1">
                  <label className="auth-label">Password</label>
                  {formData.password && (
                    <span className={`text-[11px] font-bold ${strength.textColor}`}>
                      {strength.label}
                    </span>
                  )}
                </div>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <input
                    type={showPass ? "text" : "password"}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter a strong password"
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

                {/* ── Password Strength Bar ── */}
                {formData.password.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.barPercent }}
                      />
                    </div>

                    {/* Criteria Checklist Grid */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${criteria.minLength ? "text-emerald-400 font-medium" : "text-slate-400"}`}>
                        {criteria.minLength ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-rose-500" />}
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${criteria.hasUpper ? "text-emerald-400 font-medium" : "text-slate-400"}`}>
                        {criteria.hasUpper ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-rose-500" />}
                        <span>Uppercase letter (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${criteria.hasLower ? "text-emerald-400 font-medium" : "text-slate-400"}`}>
                        {criteria.hasLower ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-rose-500" />}
                        <span>Lowercase letter (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${criteria.hasNumber ? "text-emerald-400 font-medium" : "text-slate-400"}`}>
                        {criteria.hasNumber ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-rose-500" />}
                        <span>Number (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 col-span-2 ${criteria.hasSpecial ? "text-emerald-400 font-medium" : "text-slate-400"}`}>
                        {criteria.hasSpecial ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-rose-500" />}
                        <span>Special character (!@#$%^&*)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="auth-field">
                <div className="flex justify-between items-center mb-1">
                  <label className="auth-label">Confirm Password</label>
                  {confirmPassword.length > 0 && (
                    <span className={`text-[11px] font-bold ${passwordsMatch ? "text-emerald-400" : "text-rose-400"}`}>
                      {passwordsMatch ? "Passwords Match ✓" : "Passwords Do Not Match ✗"}
                    </span>
                  )}
                </div>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    name="confirm_password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={`auth-input auth-input--icon-left auth-input--icon-right ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? "border-emerald-500/50 focus:border-emerald-400"
                          : "border-rose-500/50 focus:border-rose-400"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass((v) => !v)}
                    className="auth-eye-btn"
                    tabIndex={-1}
                    aria-label={showConfirmPass ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role-Specific Additional Fields */}
              {role === "Driver" && (
                <div className="auth-field">
                  <label className="auth-label text-emerald-400">Commercial Driver License (CDL Number)</label>
                  <div className="auth-input-wrap">
                    <CreditCard className="auth-input-icon text-emerald-400" />
                    <input
                      type="text"
                      name="license_number"
                      required
                      value={formData.license_number}
                      onChange={handleChange}
                      placeholder="e.g. CDL-98234-TX"
                      className="auth-input auth-input--icon-left focus:border-emerald-400"
                    />
                  </div>
                </div>
              )}

              {(role === "FleetManager" || role === "Dispatcher") && (
                <div className="auth-field">
                  <label className="auth-label text-sky-400">Assigned Hub / Logistics Region</label>
                  <div className="auth-input-wrap">
                    <Building className="auth-input-icon text-sky-400" />
                    <input
                      type="text"
                      name="hub_location"
                      required
                      value={formData.hub_location}
                      onChange={handleChange}
                      placeholder="e.g. Central Hub - Metro East"
                      className="auth-input auth-input--icon-left focus:border-sky-400"
                    />
                  </div>
                </div>
              )}

              {role === "Admin" && (
                <div className="auth-field">
                  <label className="auth-label text-amber-300">Admin Authorization Key</label>
                  <div className="auth-input-wrap">
                    <KeyRound className="auth-input-icon text-amber-400" />
                    <input
                      type={showAdminKey ? "text" : "password"}
                      name="admin_secret_key"
                      required
                      value={formData.admin_secret_key}
                      onChange={handleChange}
                      placeholder="FLEETFLOW_ADMIN_2026"
                      className="auth-input auth-input--icon-left auth-input--icon-right auth-input--amber"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminKey((v) => !v)}
                      className="auth-eye-btn"
                      tabIndex={-1}
                    >
                      {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

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
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="auth-switch-text">
                Already have an account?{" "}
                <Link to="/login" className="auth-link">
                  Sign in here
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signup;
