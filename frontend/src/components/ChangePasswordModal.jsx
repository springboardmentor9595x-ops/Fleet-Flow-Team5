import React, { useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import { Lock, X, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.warning("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(res.data.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    }}>
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "16px", maxWidth: "420px", width: "100%", padding: "24px",
        color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.18)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "rgba(13,148,136,0.12)", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <KeyRound size={18} color="#0D9488" />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0F172A" }}>Change Password</h3>
              <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>Update your account security credentials</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Current Password */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>
              Current Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "9px 36px 9px 12px", borderRadius: "8px",
                  border: "1px solid #CBD5E1", outline: "none", fontSize: "13px", boxSizing: "border-box"
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{
                  position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#94A3B8", cursor: "pointer"
                }}
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>
              New Password (min 6 chars) *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showNew ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "9px 36px 9px 12px", borderRadius: "8px",
                  border: "1px solid #CBD5E1", outline: "none", fontSize: "13px", boxSizing: "border-box"
                }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#94A3B8", cursor: "pointer"
                }}
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: "8px",
                border: "1px solid #CBD5E1", outline: "none", fontSize: "13px", boxSizing: "border-box"
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 16px", borderRadius: "8px", background: "transparent",
                border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 700
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "9px 20px", borderRadius: "8px", background: "#0D9488",
                border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", gap: "6px",
                boxShadow: "0 2px 8px rgba(13,148,136,0.3)"
              }}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
