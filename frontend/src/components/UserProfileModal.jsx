import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { User, Mail, Phone, Shield, Lock, X, Check, RefreshCw } from "lucide-react";

const roleBadgeStyle = (role) => {
  switch (role) {
    case "Admin": return { bg: "rgba(217,119,6,0.12)", color: "#B45309", border: "rgba(217,119,6,0.3)" };
    case "FleetManager": return { bg: "rgba(13,148,136,0.12)", color: "#0F766E", border: "rgba(13,148,136,0.3)" };
    case "Driver": return { bg: "rgba(5,150,105,0.12)", color: "#047857", border: "rgba(5,150,105,0.3)" };
    case "Dispatcher": return { bg: "rgba(79,70,229,0.12)", color: "#4338CA", border: "rgba(79,70,229,0.3)" };
    default: return { bg: "rgba(100,116,139,0.1)", color: "#475569", border: "rgba(100,116,139,0.2)" };
  }
};

const UserProfileModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.warning("Full name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.warning("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      toast.success("Profile updated successfully!");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const badge = roleBadgeStyle(user?.role);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    }}>
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "16px", maxWidth: "440px", width: "100%", padding: "24px",
        color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.18)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #0D9488, #0891B2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 10px rgba(13,148,136,0.25)"
            }}>
              <User size={18} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>
                My Profile &amp; Account
              </h3>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748B" }}>
                Update your personal info &amp; email
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "#94A3B8", cursor: "pointer",
              padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center"
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Read-only Role Display */}
          <div style={{
            padding: "10px 14px", borderRadius: "10px",
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div>
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                Account Role
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700,
                background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                marginTop: "3px"
              }}>
                <Shield size={11} /> {user?.role}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#94A3B8", fontSize: "10px", fontStyle: "italic" }}>
              <Lock size={11} /> Admin Controlled
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "5px", textTransform: "uppercase" }}>
              Full Name / Username
            </label>
            <div style={{ position: "relative" }}>
              <User size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
                style={{
                  width: "100%", padding: "9px 12px 9px 36px", borderRadius: "8px",
                  background: "#F8FAFC", border: "1px solid #CBD5E1", fontSize: "13px",
                  color: "#0F172A", outline: "none", boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "5px", textTransform: "uppercase" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  width: "100%", padding: "9px 12px 9px 36px", borderRadius: "8px",
                  background: "#F8FAFC", border: "1px solid #CBD5E1", fontSize: "13px",
                  color: "#0F172A", outline: "none", boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "5px", textTransform: "uppercase" }}>
              Phone Number (Optional)
            </label>
            <div style={{ position: "relative" }}>
              <Phone size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                style={{
                  width: "100%", padding: "9px 12px 9px 36px", borderRadius: "8px",
                  background: "#F8FAFC", border: "1px solid #CBD5E1", fontSize: "13px",
                  color: "#0F172A", outline: "none", boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "9px 12px", borderRadius: "8px",
                background: "#F1F5F9", border: "1px solid #CBD5E1",
                color: "#475569", fontWeight: 600, fontSize: "12px", cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1.5, padding: "9px 12px", borderRadius: "8px",
                background: "linear-gradient(135deg, #0D9488, #0891B2)",
                border: "none", color: "white", fontWeight: 700, fontSize: "12px",
                cursor: loading ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                boxShadow: "0 2px 8px rgba(13,148,136,0.3)", opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? (
                <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <Check size={14} />
              )}
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfileModal;
