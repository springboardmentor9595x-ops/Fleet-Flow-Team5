import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import EmailLogsModal from "../components/EmailLogsModal";
import shipmentsApi from "../api/shipments";
import DelayAlert from "../components/DelayAlert";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import {
  ShieldCheck, UserCheck, Mail, LogOut, UserPlus, RefreshCw, X, CheckCircle2,
  Lock, Eye, EyeOff, Truck, Zap, CreditCard, Building, Package, AlertTriangle,
  ArrowRight, Plus
} from "lucide-react";

const Dashboard = () => {
  const { user, logout, adminAddUser, emailNotification, clearNotification } = useAuth();
  const navigate = useNavigate();

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    full_name: "",
    email: "",
    role: "Driver",
    temporary_password: "",
    license_number: "",
    hub_location: "",
  });
  const [showAddPass, setShowAddPass] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState("");
  const [addUserSuccess, setAddUserSuccess] = useState("");

  const [stats, setStats] = useState({ total: 0, inTransit: 0, delayed: 0, delivered: 0 });
  const [recentShipments, setRecentShipments] = useState([]);
  const [delayedShipments, setDelayedShipments] = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setShipmentsLoading(true);
    try {
      const res = await shipmentsApi.list(0, 10);
      const all = res.shipments || [];
      setRecentShipments(all.slice(0, 5));
      setDelayedShipments(all.filter((s) => s.status === "Delayed" || s.is_delayed));
      setStats({
        total: res.total || all.length,
        inTransit: all.filter((s) => s.status === "In Transit").length,
        delayed: res.delayed_count || all.filter((s) => s.status === "Delayed").length,
        delivered: all.filter((s) => s.status === "Delivered").length,
      });
    } catch (err) {
      console.error("Error loading dashboard metrics", err);
    } finally {
      setShipmentsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "Driver") {
      navigate("/shipments");
      return;
    }
    fetchDashboardData();
  }, [user, navigate]);

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setAddUserError("");
    setAddUserSuccess("");
    setAddUserLoading(true);

    try {
      await adminAddUser(newUserForm);
      const msg = `User ${newUserForm.full_name} (${newUserForm.email}) provisioned successfully!`;
      setAddUserSuccess(msg);
      toast.success(msg);
      setNewUserForm({
        full_name: "",
        email: "",
        role: "Driver",
        temporary_password: "",
        license_number: "",
        hub_location: "",
      });
      setIsAddUserModalOpen(false);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || "Failed to add user.";
      setAddUserError(errMsg);
      toast.error(errMsg);
    } finally {
      setAddUserLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Fleet Overview Dashboard
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            Welcome back, <strong>{user?.full_name}</strong>! ({user?.role})
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {user?.role === "Admin" && (
            <>
              <button
                onClick={() => setIsEmailModalOpen(true)}
                style={{
                  padding: "8px 14px", borderRadius: "10px",
                  background: "#FFFFFF", border: "1px solid #E2E8F0",
                  color: "#0D9488", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                  display: "flex", alignItems: "center", gap: "6px",
                  boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
                }}
              >
                <Mail size={14} /> Email Logs
              </button>

              <button
                onClick={() => setIsAddUserModalOpen(true)}
                style={{
                  padding: "8px 16px", borderRadius: "10px",
                  background: "#D97706",
                  border: "none", color: "#FFFFFF", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                  display: "flex", alignItems: "center", gap: "6px",
                  boxShadow: "0 4px 12px rgba(217,119,6,0.2)"
                }}
              >
                <UserPlus size={14} /> Add User
              </button>
            </>
          )}

          <button
            onClick={fetchDashboardData}
            style={{
              padding: "8px 12px", borderRadius: "10px",
              background: "#FFFFFF", border: "1px solid #E2E8F0",
              color: "#475569", cursor: "pointer", boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
            }}
          >
            <RefreshCw size={14} style={shipmentsLoading ? { animation: "spin 0.8s linear infinite" } : {}} />
          </button>
        </div>
      </div>

      {/* Delayed Shipment Alert Banner */}
      {delayedShipments.length > 0 && (
        <DelayAlert delayedShipments={delayedShipments} onRefresh={fetchDashboardData} />
      )}

      {/* Email Notification */}
      {emailNotification && (
        <div style={{
          padding: "14px 18px", borderRadius: "12px", marginBottom: "20px",
          background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.25)",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Mail size={18} color="#0D9488" />
            <div>
              <h4 style={{ color: "#0D9488", fontWeight: 700, fontSize: "13px", margin: 0 }}>{emailNotification.title}</h4>
              <p style={{ color: "#475569", fontSize: "12px", margin: "2px 0 0" }}>{emailNotification.message}</p>
            </div>
          </div>
          <button onClick={clearNotification} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>TOTAL SHIPMENTS</span>
            <Package size={18} color="#4F46E5" />
          </div>
          <span style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", display: "block", marginTop: "8px" }}>
            {stats.total}
          </span>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>IN TRANSIT</span>
            <Truck size={18} color="#0D9488" />
          </div>
          <span style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", display: "block", marginTop: "8px" }}>
            {stats.inTransit}
          </span>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>DELAYED</span>
            <AlertTriangle size={18} color="#DC2626" />
          </div>
          <span style={{ fontSize: "26px", fontWeight: 900, color: stats.delayed > 0 ? "#DC2626" : "#0F172A", display: "block", marginTop: "8px" }}>
            {stats.delayed}
          </span>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>DELIVERED</span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <span style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", display: "block", marginTop: "8px" }}>
            {stats.delivered}
          </span>
        </div>
      </div>

      {/* Recent Active Shipments */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ color: "#0F172A", fontWeight: 800, fontSize: "15px", margin: 0 }}>
            Recent Active Shipments
          </h3>
          <button
            onClick={() => navigate("/shipments")}
            style={{
              background: "none", border: "none", color: "#0D9488", cursor: "pointer",
              fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px"
            }}
          >
            View All Shipments <ArrowRight size={14} />
          </button>
        </div>

        {recentShipments.length === 0 ? (
          <p style={{ color: "#475569", fontSize: "13px" }}>No recent shipments found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentShipments.map((s) => (
              <div
                key={s.shipment_id}
                onClick={() => navigate(`/shipments/${s.shipment_id}`)}
                style={{
                  background: "#F8FAFC", border: "1px solid #E2E8F0",
                  borderRadius: "10px", padding: "14px 18px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#0D9488"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E2E8F0"}
              >
                <div>
                  <span style={{ color: "#0D9488", fontWeight: 800, fontSize: "13px", fontFamily: "monospace" }}>
                    {s.tracking_number}
                  </span>
                  <span style={{ color: "#0F172A", fontWeight: 600, fontSize: "13px", marginLeft: "12px" }}>
                    {s.source} ➔ {s.destination}
                  </span>
                </div>
                <span style={{
                  padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                  background: "rgba(13,148,136,0.1)", color: "#0D9488", border: "1px solid rgba(13,148,136,0.25)"
                }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Add User Modal */}
      {isAddUserModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.6)",
          backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: "16px", maxWidth: "440px", width: "100%", padding: "24px", color: "#0F172A",
            boxShadow: "0 20px 50px rgba(15,23,42,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0F172A" }}>Provision New User</h3>
              <button onClick={() => setIsAddUserModalOpen(false)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                required
                placeholder="Full Name"
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                style={{ padding: "10px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", fontSize: "13px", outline: "none" }}
              />
              <input
                type="email"
                required
                placeholder="Email Address"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                style={{ padding: "10px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", fontSize: "13px", outline: "none" }}
              />
              <select
                value={newUserForm.role}
                onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                style={{ padding: "10px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", fontSize: "13px", outline: "none" }}
              >
                <option value="Driver">Driver</option>
                <option value="FleetManager">Fleet Manager</option>
                <option value="Dispatcher">Dispatcher</option>
                <option value="Admin">Admin</option>
              </select>
              <input
                type="password"
                required
                placeholder="Temporary Password"
                value={newUserForm.temporary_password}
                onChange={(e) => setNewUserForm({ ...newUserForm, temporary_password: e.target.value })}
                style={{ padding: "10px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", fontSize: "13px", outline: "none" }}
              />

              <button
                type="submit"
                disabled={addUserLoading}
                style={{
                  padding: "10px", borderRadius: "8px", background: "#D97706",
                  border: "none", color: "#FFFFFF", fontWeight: 800, cursor: "pointer", marginTop: "10px"
                }}
              >
                {addUserLoading ? "Creating..." : "Create Account & Send Email"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Email Logs Modal */}
      {isEmailModalOpen && <EmailLogsModal onClose={() => setIsEmailModalOpen(false)} />}
    </div>
  );
};

export default Dashboard;
