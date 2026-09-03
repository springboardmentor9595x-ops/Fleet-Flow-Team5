import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import dashboardApi from "../api/dashboard";
import api from "../api/axios";
import EmailLogsModal from "../components/EmailLogsModal";
import UserManagementModal from "../components/UserManagementModal";
import NotificationBell from "../components/NotificationBell";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import {
  Truck, Package, Users, Wrench, Fuel, MapPin, Navigation, ShieldCheck,
  UserCheck, Mail, UserPlus, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, BarChart2, Layers, X, Search, Check, Trash2, Shield,
  Edit3, CheckSquare, Square, Info, UserX, Pencil
} from "lucide-react";

const roleBadgeStyle = (role) => {
  switch (role) {
    case "Admin": return { bg: "rgba(217,119,6,0.12)", color: "#B45309", border: "rgba(217,119,6,0.3)" };
    case "FleetManager": return { bg: "rgba(13,148,136,0.12)", color: "#0F766E", border: "rgba(13,148,136,0.3)" };
    case "Driver": return { bg: "rgba(5,150,105,0.12)", color: "#047857", border: "rgba(5,150,105,0.3)" };
    case "Dispatcher": return { bg: "rgba(79,70,229,0.12)", color: "#4338CA", border: "rgba(79,70,229,0.3)" };
    default: return { bg: "rgba(100,116,139,0.1)", color: "#475569", border: "rgba(100,116,139,0.2)" };
  }
};

const Dashboard = () => {
  const { user, adminAddUser } = useAuth();

  const isDriver = user?.role === "Driver";
  const isDispatcher = user?.role === "Dispatcher";
  const isFleetManager = user?.role === "FleetManager";
  const isAdmin = user?.role === "Admin";

  const getInitialTab = () => {
    if (isDriver) return "driver";
    if (isDispatcher) return "logistics";
    return "fleet";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [loading, setLoading] = useState(true);

  const [fleetData, setFleetData] = useState(null);
  const [logisticsData, setLogisticsData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [driverData, setDriverData] = useState(null);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);

  const [systemUsers, setSystemUsers] = useState([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState(null);

  const [newUserForm, setNewUserForm] = useState({
    full_name: "",
    email: "",
    role: "Driver",
    temporary_password: "",
    license_number: "",
    hub_location: "",
  });
  const [addUserLoading, setAddUserLoading] = useState(false);

  const fetchDashboardMetrics = useCallback(async () => {
    setLoading(true);
    try {
      if (isDriver) {
        const d = await dashboardApi.getDriverDashboard();
        setDriverData(d);
      } else {
        if (isAdmin || isFleetManager) {
          const f = await dashboardApi.getFleetDashboard();
          setFleetData(f);
        }
        if (isAdmin || isFleetManager || isDispatcher) {
          const l = await dashboardApi.getLogisticsDashboard();
          setLogisticsData(l);
        }
        if (isAdmin) {
          const a = await dashboardApi.getAdminDashboard();
          setAdminData(a);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
      toast.error(err.response?.data?.detail || "Error loading dashboard metrics");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isFleetManager, isDispatcher, isDriver]);

  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [batchRole, setBatchRole] = useState("Driver");
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Role change with custom reason modal
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [targetRole, setTargetRole] = useState("Driver");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [roleChangeSubmitting, setRoleChangeSubmitting] = useState(false);

  // Safe delete with custom reason modal
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchSystemUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUserListLoading(true);
    try {
      const res = await api.get("/auth/users");
      setSystemUsers(res.data || []);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setUserListLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchDashboardMetrics();
    if (isAdmin) {
      fetchSystemUsers();
    }
  }, [fetchDashboardMetrics, fetchSystemUsers, isAdmin]);

  const openRoleChangeModal = (u) => {
    setRoleModalUser(u);
    setTargetRole(u.role);
    setRoleChangeReason("");
  };

  const handleConfirmRoleChange = async (e) => {
    if (e) e.preventDefault();
    if (!roleModalUser) return;
    setRoleChangeSubmitting(true);
    try {
      const res = await api.patch(`/auth/users/${roleModalUser.user_id}/role`, {
        role: targetRole,
        reason: roleChangeReason || undefined,
      });
      toast.success(`Role updated to ${targetRole} for ${res.data.full_name}! Notification email sent to ${res.data.email}.`);
      setSystemUsers((prev) =>
        prev.map((u) => (u.user_id === roleModalUser.user_id ? { ...u, role: targetRole } : u))
      );
      setRoleModalUser(null);
      fetchDashboardMetrics();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user role.");
    } finally {
      setRoleChangeSubmitting(false);
    }
  };

  const openDeleteModal = (u) => {
    setDeleteModalUser(u);
    setDeleteReason("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser) return;
    setDeleteSubmitting(true);
    try {
      const q = deleteReason ? `?reason=${encodeURIComponent(deleteReason)}` : "";
      const res = await api.delete(`/auth/users/${deleteModalUser.user_id}${q}`);
      toast.success(res.data?.message || `User account for ${deleteModalUser.full_name} deleted.`);
      setSystemUsers((prev) => prev.filter((u) => u.user_id !== deleteModalUser.user_id));
      setSelectedUserIds((prev) => prev.filter((id) => id !== deleteModalUser.user_id));
      setDeleteModalUser(null);
      fetchDashboardMetrics();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete user.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleToggleStatus = async (targetUser) => {
    const nextStatus = !targetUser.is_verified;
    const actionName = nextStatus ? "activate" : "suspend";
    if (targetUser.user_id === user?.user_id) {
      toast.warning("Cannot modify status of your own active Admin account.");
      return;
    }
    if (!window.confirm(`Are you sure you want to ${actionName} the account for ${targetUser.full_name || targetUser.email}?`)) {
      return;
    }
    try {
      await api.patch(`/auth/users/${targetUser.user_id}/status`, { is_verified: nextStatus });
      toast.success(`Account for ${targetUser.full_name || targetUser.email} successfully ${nextStatus ? "activated" : "suspended"}.`);
      setSystemUsers((prev) =>
        prev.map((u) => (u.user_id === targetUser.user_id ? { ...u, is_verified: nextStatus } : u))
      );
      fetchDashboardMetrics();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${actionName} user.`);
    }
  };

  // Inline edit state for user profile (name/email) on Executive Dashboard
  const [editUserId, setEditUserId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEditUser = (u) => {
    setEditUserId(u.user_id);
    setEditName(u.full_name || "");
    setEditEmail(u.email || "");
  };

  const cancelEditUser = () => {
    setEditUserId(null);
    setEditName("");
    setEditEmail("");
  };

  const handleSaveEditUser = async (userId) => {
    if (!editName.trim()) { toast.warning("Full name is required."); return; }
    if (!editEmail.trim() || !editEmail.includes("@")) { toast.warning("Enter a valid email."); return; }
    setEditSubmitting(true);
    try {
      const res = await api.patch(`/auth/users/${userId}`, {
        full_name: editName.trim(),
        email: editEmail.trim(),
      });
      toast.success(`Profile updated for ${res.data.full_name}.`);
      setSystemUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, full_name: res.data.full_name, email: res.data.email } : u))
      );
      setEditUserId(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user profile.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedUserIds.length === filteredSystemUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredSystemUsers.map((u) => u.user_id));
    }
  };

  const handleToggleSelectOne = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleBatchStatus = async (statusVal) => {
    if (selectedUserIds.length === 0) return;
    const actionName = statusVal ? "activate" : "suspend";
    if (!window.confirm(`${statusVal ? "Activate" : "Suspend"} ${selectedUserIds.length} selected user account(s)?`)) return;
    setBatchActionLoading(true);
    try {
      const res = await api.post("/auth/users/batch-status", {
        user_ids: selectedUserIds,
        is_verified: statusVal,
        reason: `Executive dashboard batch account ${actionName}`,
      });
      toast.success(res.data?.message || `Accounts successfully ${statusVal ? "activated" : "suspended"}.`);
      setSystemUsers((prev) =>
        prev.map((u) => (selectedUserIds.includes(u.user_id) ? { ...u, is_verified: statusVal } : u))
      );
      setSelectedUserIds([]);
      fetchDashboardMetrics();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to batch ${actionName} users.`);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchRoleUpdate = async () => {
    if (selectedUserIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      const res = await api.post("/auth/users/batch-role", {
        user_ids: selectedUserIds,
        role: batchRole,
        reason: "Executive dashboard batch role update",
      });
      toast.success(res.data?.message || `Updated ${selectedUserIds.length} users to ${batchRole}.`);
      setSystemUsers((prev) =>
        prev.map((u) => (selectedUserIds.includes(u.user_id) ? { ...u, role: batchRole } : u))
      );
      setSelectedUserIds([]);
      fetchDashboardMetrics();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to execute batch role update.");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUserIds.length === 0) return;
    if (!window.confirm(`Permanently decommission and delete ${selectedUserIds.length} selected account(s)?`)) return;
    setBatchActionLoading(true);
    try {
      const res = await api.post("/auth/users/batch-delete", {
        user_ids: selectedUserIds,
        reason: "Executive dashboard batch account decommission",
      });
      toast.success(res.data?.message || `Decommissioned ${selectedUserIds.length} accounts.`);
      setSystemUsers((prev) => prev.filter((u) => !selectedUserIds.includes(u.user_id)));
      setSelectedUserIds([]);
      fetchDashboardMetrics();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to batch delete accounts.");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setAddUserLoading(true);
    try {
      await adminAddUser(newUserForm);
      toast.success(`User ${newUserForm.full_name} provisioned successfully!`);
      setNewUserForm({
        full_name: "",
        email: "",
        role: "Driver",
        temporary_password: "",
        license_number: "",
        hub_location: "",
      });
      setIsAddUserModalOpen(false);
      fetchDashboardMetrics();
      fetchSystemUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add user.");
    } finally {
      setAddUserLoading(false);
    }
  };

  const filteredSystemUsers = systemUsers.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    const matchesSearch =
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (userRoleFilter === "ALL") return true;
    if (userRoleFilter === "SUSPENDED") return u.is_verified === false;
    return u.role === userRoleFilter;
  });

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            {isDriver ? "Driver Command Center" : "FleetFlow Operations Command"}
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            Welcome back, <strong>{user?.full_name}</strong> • Role: <span style={{ color: "#0D9488", fontWeight: 700 }}>{user?.role}</span>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isAdmin && (
            <>
              <button
                onClick={() => setIsUserManagementModalOpen(true)}
                style={{
                  padding: "8px 14px", borderRadius: "10px",
                  background: "#FFFFFF", border: "1px solid #E2E8F0",
                  color: "#D97706", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                  display: "flex", alignItems: "center", gap: "6px",
                  boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
                }}
              >
                <ShieldCheck size={14} /> Manage Roles
              </button>

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
                <Mail size={14} /> Email Audit Logs
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
                <UserPlus size={14} /> Provision User
              </button>
            </>
          )}

          <button
            onClick={fetchDashboardMetrics}
            style={{
              padding: "8px 12px", borderRadius: "10px",
              background: "#FFFFFF", border: "1px solid #E2E8F0",
              color: "#475569", cursor: "pointer", boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
            }}
            title="Refresh Dashboard"
          >
            <RefreshCw size={14} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
          </button>

          <NotificationBell />
        </div>
      </div>

      {/* Role-Gated Dashboard Tabs */}
      {!isDriver && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "22px", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
          {(isAdmin || isFleetManager) && (
            <button
              onClick={() => setActiveTab("fleet")}
              style={{
                padding: "8px 16px", borderRadius: "10px", border: "none",
                background: activeTab === "fleet" ? "#0D9488" : "#FFFFFF",
                color: activeTab === "fleet" ? "white" : "#475569",
                fontWeight: 700, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
                boxShadow: activeTab === "fleet" ? "0 4px 12px rgba(13,148,136,0.2)" : "0 1px 4px rgba(15,23,42,0.02)",
              }}
            >
              <Truck size={15} /> Fleet Dashboard
            </button>
          )}

          {(isAdmin || isFleetManager || isDispatcher) && (
            <button
              onClick={() => setActiveTab("logistics")}
              style={{
                padding: "8px 16px", borderRadius: "10px", border: "none",
                background: activeTab === "logistics" ? "#0D9488" : "#FFFFFF",
                color: activeTab === "logistics" ? "white" : "#475569",
                fontWeight: 700, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
                boxShadow: activeTab === "logistics" ? "0 4px 12px rgba(13,148,136,0.2)" : "0 1px 4px rgba(15,23,42,0.02)",
              }}
            >
              <Package size={15} /> Logistics Dashboard
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              style={{
                padding: "8px 16px", borderRadius: "10px", border: "none",
                background: activeTab === "admin" ? "#0D9488" : "#FFFFFF",
                color: activeTab === "admin" ? "white" : "#475569",
                fontWeight: 700, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
                boxShadow: activeTab === "admin" ? "0 4px 12px rgba(13,148,136,0.2)" : "0 1px 4px rgba(15,23,42,0.02)",
              }}
            >
              <ShieldCheck size={15} /> Admin Executive Dashboard
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#64748B" }}>
          <RefreshCw size={28} style={{ animation: "spin 0.8s linear infinite", marginBottom: "12px", color: "#0D9488" }} />
          <p style={{ fontWeight: 700, margin: 0 }}>Loading command metrics...</p>
        </div>
      ) : (
        <>
          {/* 1. FLEET DASHBOARD */}
          {activeTab === "fleet" && fleetData && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>ACTIVE VEHICLES</span>
                    <Truck size={18} color="#0D9488" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", margin: "8px 0 2px" }}>
                    {fleetData.active_vehicles_count} <span style={{ fontSize: "14px", color: "#94A3B8", fontWeight: 600 }}>/ {fleetData.total_vehicles}</span>
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Vehicles currently deployed</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488" }}>FLEET UTILIZATION %</span>
                    <TrendingUp size={18} color="#0D9488" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#0D9488", margin: "8px 0 2px" }}>
                    {fleetData.utilization_pct}%
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Assigned / In-Transit capacity</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>MONTHLY FUEL SPEND</span>
                    <Fuel size={18} color="#059669" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#059669", margin: "8px 0 2px" }}>
                    ${fleetData.fuel_summary.total_fuel_cost}
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>{fleetData.fuel_summary.total_fuel_liters} Liters consumed</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>MAINTENANCE ALERTS</span>
                    <Wrench size={18} color="#D97706" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: fleetData.maintenance_summary.overdue_count > 0 ? "#DC2626" : "#D97706", margin: "8px 0 2px" }}>
                    {fleetData.maintenance_summary.upcoming_count + fleetData.maintenance_summary.overdue_count}
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>
                    {fleetData.maintenance_summary.overdue_count} Overdue • {fleetData.maintenance_summary.upcoming_count} Due in 7d
                  </p>
                </div>
              </div>

              {/* Status Breakdown & Categories */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                    <BarChart2 size={16} color="#0D9488" /> Vehicle Status Overview
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {Object.entries(fleetData.status_breakdown).map(([st, count]) => {
                      const pct = Math.round((count / Math.max(fleetData.total_vehicles, 1)) * 100);
                      const color = st === "Available" ? "#059669" : st === "In Transit" ? "#0D9488" : st === "Assigned" ? "#4F46E5" : st === "Maintenance" ? "#D97706" : "#94A3B8";
                      return (
                        <div key={st}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                            <span style={{ color: "#334155" }}>{st}</span>
                            <span style={{ color }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ width: "100%", height: "7px", background: "#F1F5F9", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "4px" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Truck size={16} color="#0D9488" /> Fleet Categories & Models
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {Object.entries(fleetData.type_breakdown).map(([tname, count]) => (
                      <div key={tname} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #F1F5F9" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>{tname}</span>
                        <span style={{ background: "rgba(13,148,136,0.12)", color: "#0D9488", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 800 }}>
                          {count} Vehicles
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fuel & Maintenance Tables */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Fuel size={16} color="#059669" /> Top Vehicles by Fuel Spend
                  </h3>
                  {fleetData.fuel_summary.top_vehicles.length === 0 ? (
                    <p style={{ color: "#94A3B8", fontSize: "12px", margin: 0 }}>No fuel records logged this month.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #E2E8F0", fontSize: "10px", color: "#64748B", textTransform: "uppercase" }}>
                          <th style={{ textAlign: "left", paddingBottom: "8px" }}>Vehicle</th>
                          <th style={{ textAlign: "right", paddingBottom: "8px" }}>Volume (L)</th>
                          <th style={{ textAlign: "right", paddingBottom: "8px" }}>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fleetData.fuel_summary.top_vehicles.map((v, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", fontSize: "12px" }}>
                            <td style={{ padding: "8px 0", fontWeight: 700, color: "#0F172A" }}>{v.registration_number}</td>
                            <td style={{ textAlign: "right", color: "#475569" }}>{v.liters} L</td>
                            <td style={{ textAlign: "right", fontWeight: 800, color: "#059669" }}>${v.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Wrench size={16} color="#D97706" /> Service Alerts (Next 7 Days & Overdue)
                    </h3>
                    <Link to="/maintenance" style={{ fontSize: "11px", fontWeight: 700, color: "#0D9488", textDecoration: "none" }}>
                      View All →
                    </Link>
                  </div>

                  {fleetData.maintenance_summary.upcoming_7_days.length === 0 && fleetData.maintenance_summary.overdue_list.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#059669" }}>
                      <CheckCircle2 size={24} style={{ margin: "0 auto 6px" }} />
                      <p style={{ margin: 0, fontSize: "12px", fontWeight: 700 }}>All vehicle maintenance is up to date!</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {fleetData.maintenance_summary.overdue_list.map((m) => (
                        <div key={m.maintenance_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px" }}>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: "12px", color: "#DC2626" }}>{m.registration_number}</span>
                            <span style={{ fontSize: "11px", color: "#475569", marginLeft: "6px" }}>• {m.maintenance_type}</span>
                          </div>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "#DC2626", background: "#FFFFFF", padding: "2px 6px", borderRadius: "4px" }}>
                            OVERDUE
                          </span>
                        </div>
                      ))}
                      {fleetData.maintenance_summary.upcoming_7_days.map((m) => (
                        <div key={m.maintenance_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", borderRadius: "8px" }}>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: "12px", color: "#D97706" }}>{m.registration_number}</span>
                            <span style={{ fontSize: "11px", color: "#475569", marginLeft: "6px" }}>• {m.maintenance_type}</span>
                          </div>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "#D97706", background: "#FFFFFF", padding: "2px 6px", borderRadius: "4px" }}>
                            in {m.days_diff}d
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. LOGISTICS DASHBOARD */}
          {activeTab === "logistics" && logisticsData && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>ACTIVE SHIPMENTS</span>
                    <Package size={18} color="#0D9488" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", margin: "8px 0 2px" }}>
                    {logisticsData.active_shipments_count}
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Assigned or In-Transit</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>ON-TIME DELIVERY RATE</span>
                    <CheckCircle2 size={18} color="#059669" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#059669", margin: "8px 0 2px" }}>
                    {logisticsData.on_time_delivery_rate}%
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>{logisticsData.delayed_count} Delayed shipments</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5" }}>ETA ACCURACY</span>
                    <Clock size={18} color="#4F46E5" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#4F46E5", margin: "8px 0 2px" }}>
                    {logisticsData.eta_accuracy_pct}%
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Predicted vs Actual arrival</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>AVG TRIP DISTANCE</span>
                    <Navigation size={18} color="#D97706" />
                  </div>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#D97706", margin: "8px 0 2px" }}>
                    {logisticsData.route_performance.avg_distance_km} km
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>{logisticsData.route_performance.avg_duration_hrs} hrs avg duration</p>
                </div>
              </div>

              {/* Map Snapshot & Pipeline Breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={16} color="#0D9488" /> Live Fleet Tracking Snapshot
                    </h3>
                    <Link to="/tracking" style={{ fontSize: "11px", fontWeight: 700, color: "#0D9488", textDecoration: "none" }}>
                      Open Full Live Map →
                    </Link>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                    {logisticsData.live_tracking_snapshot.map((v) => (
                      <div key={v.vehicle_id} style={{ padding: "12px", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 800, fontSize: "12px", color: "#0F172A" }}>{v.registration_number}</span>
                          <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px", background: "rgba(13,148,136,0.12)", color: "#0D9488" }}>
                            {v.status}
                          </span>
                        </div>
                        <p style={{ margin: "2px 0", fontSize: "11px", color: "#64748B" }}>
                          Speed: <strong>{v.speed_kmh} km/h</strong>
                        </p>
                        <p style={{ margin: 0, fontSize: "10px", color: "#94A3B8", fontFamily: "monospace" }}>
                          {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Layers size={16} color="#0D9488" /> Shipment Pipeline Breakdown
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {Object.entries(logisticsData.status_breakdown).map(([st, count]) => (
                      <div key={st} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#F8FAFC", borderRadius: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{st}</span>
                        <span style={{ fontWeight: 800, fontSize: "12px", color: st === "Delayed" ? "#DC2626" : st === "Delivered" ? "#059669" : "#0F172A" }}>
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. ADMIN DASHBOARD */}
          {activeTab === "admin" && adminData && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>TOTAL SYSTEM USERS</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#0F172A", margin: "6px 0 2px" }}>
                    {adminData.operational_kpis.system_users}
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>RBAC Governed</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488" }}>FLEET UTILIZATION ROLLUP</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#0D9488", margin: "6px 0 2px" }}>
                    {adminData.fleet_rollup.utilization_pct}%
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>{adminData.fleet_rollup.active_vehicles} active / {adminData.fleet_rollup.total_vehicles} total</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>TOTAL LOGISTICS VOLUME</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#059669", margin: "6px 0 2px" }}>
                    {adminData.operational_kpis.total_shipments} <span style={{ fontSize: "13px", color: "#94A3B8" }}>Shipments</span>
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>{adminData.operational_kpis.total_trips} trips dispatched</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>TOTAL FLEET EXPENSES</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#D97706", margin: "6px 0 2px" }}>
                    ${adminData.operational_kpis.total_maintenance_spend}
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Maintenance & Servicing</p>
                </div>
              </div>

              {/* Leaderboard & Attention Shipments */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Users size={16} color="#0D9488" /> Driver Performance Leaderboard
                  </h3>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E2E8F0", fontSize: "10px", color: "#64748B", textTransform: "uppercase" }}>
                        <th style={{ textAlign: "left", paddingBottom: "8px" }}>Driver</th>
                        <th style={{ textAlign: "center", paddingBottom: "8px" }}>Status</th>
                        <th style={{ textAlign: "right", paddingBottom: "8px" }}>Completed</th>
                        <th style={{ textAlign: "right", paddingBottom: "8px" }}>On-Time %</th>
                        <th style={{ textAlign: "right", paddingBottom: "8px" }}>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminData.driver_leaderboard.map((d, i) => (
                        <tr key={d.driver_id} style={{ borderBottom: "1px solid #F1F5F9", fontSize: "12px" }}>
                          <td style={{ padding: "10px 0", fontWeight: 700, color: "#0F172A" }}>
                            {i + 1}. {d.name}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "8px", background: d.status === "Active" ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)", color: d.status === "Active" ? "#059669" : "#DC2626" }}>
                              {d.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: "#4F46E5" }}>{d.trips_completed}</td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: "#059669" }}>{d.on_time_rate}%</td>
                          <td style={{ textAlign: "right", color: "#475569" }}>{d.attendance_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={16} color="#DC2626" /> Critical Shipments Needing Attention
                  </h3>
                  {adminData.attention_shipments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px", color: "#059669" }}>
                      <CheckCircle2 size={24} style={{ margin: "0 auto 6px" }} />
                      <p style={{ margin: 0, fontSize: "12px", fontWeight: 700 }}>No delayed or cancelled shipments!</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {adminData.attention_shipments.map((s) => (
                        <div key={s.shipment_id} style={{ padding: "10px 12px", background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 800, fontSize: "12px", color: "#0F172A" }}>{s.tracking_number}</span>
                            <span style={{ fontSize: "10px", fontWeight: 800, color: "#DC2626" }}>{s.status}</span>
                          </div>
                          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748B" }}>
                            {s.source} → {s.destination} ({s.customer_name})
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
        
              {/* ── User Roles & Access Privilege Governance ── */}
              <div style={{
                background: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0",
                overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)"
              }}>

                {/* Card Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 22px", borderBottom: "1px solid #F1F5F9", flexWrap: "wrap", gap: "10px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0,
                      background: "linear-gradient(135deg, #D97706, #B45309)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 10px rgba(217,119,6,0.22)"
                    }}>
                      <ShieldCheck size={18} color="white" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                        User Roles &amp; Access Privilege Governance
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748B" }}>
                        Reassign roles, suspend accounts, and dispatch automated email alerts.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={fetchSystemUsers}
                      style={{
                        padding: "6px 12px", borderRadius: "8px", background: "#F8FAFC",
                        border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer",
                        fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px"
                      }}
                    >
                      <RefreshCw size={12} style={userListLoading ? { animation: "spin 0.8s linear infinite" } : {}} />
                      Refresh
                    </button>
                    <button
                      onClick={() => setIsUserManagementModalOpen(true)}
                      style={{
                        padding: "6px 14px", borderRadius: "8px", background: "#0F172A",
                        border: "none", color: "#FFFFFF", cursor: "pointer",
                        fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px"
                      }}
                    >
                      <Shield size={12} /> Full Screen
                    </button>
                  </div>
                </div>

                {/* Role Stats Row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                  borderBottom: "1px solid #F1F5F9"
                }}>
                  {[
                    { label: "Admins", key: "Admin", color: "#B45309", bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.18)" },
                    { label: "Fleet Managers", key: "FleetManager", color: "#0F766E", bg: "rgba(13,148,136,0.08)", border: "rgba(13,148,136,0.18)" },
                    { label: "Dispatchers", key: "Dispatcher", color: "#4338CA", bg: "rgba(79,70,229,0.08)", border: "rgba(79,70,229,0.18)" },
                    { label: "Drivers", key: "Driver", color: "#047857", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.18)" },
                  ].map((stat, i) => (
                    <div
                      key={stat.key}
                      style={{
                        padding: "14px 18px",
                        borderRight: i < 3 ? "1px solid #F1F5F9" : "none",
                        background: stat.bg
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "10px", fontWeight: 800, color: stat.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {stat.label}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: 900, color: stat.color, lineHeight: 1 }}>
                        {adminData.operational_kpis.user_role_breakdown?.[stat.key] || 0}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Search + Filter Toolbar */}
                <div style={{ padding: "14px 22px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flex: "1 1 200px", minWidth: "160px" }}>
                    <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                    <input
                      placeholder="Search by name, email, or role..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      style={{
                        width: "100%", padding: "7px 10px 7px 30px", borderRadius: "8px",
                        border: "1px solid #E2E8F0", fontSize: "12px", outline: "none",
                        boxSizing: "border-box", background: "#F8FAFC", color: "#0F172A"
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {["ALL", "Admin", "FleetManager", "Dispatcher", "Driver", "SUSPENDED"].map((rf) => (
                      <button
                        key={rf}
                        onClick={() => setUserRoleFilter(rf)}
                        style={{
                          padding: "5px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
                          cursor: "pointer", whiteSpace: "nowrap",
                          border: userRoleFilter === rf ? "1px solid #0D9488" : "1px solid #E2E8F0",
                          background: userRoleFilter === rf ? "#0D9488" : "#FFFFFF",
                          color: userRoleFilter === rf ? "#FFFFFF" : "#64748B",
                        }}
                      >
                        {rf === "ALL" ? "All" : rf === "SUSPENDED" ? "🚫 Suspended" : rf}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {filteredSystemUsers.length} / {systemUsers.length}
                  </span>
                </div>

                {/* Batch Selection Bar */}
                {selectedUserIds.length > 0 && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 22px", background: "#F0FDFA", borderBottom: "1px solid #99F6E4",
                    flexWrap: "wrap", gap: "8px"
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F766E" }}>
                      ✓ {selectedUserIds.length} account(s) selected
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <select
                        value={batchRole}
                        onChange={(e) => setBatchRole(e.target.value)}
                        style={{
                          padding: "5px 8px", borderRadius: "6px", border: "1px solid #99F6E4",
                          fontSize: "11px", fontWeight: 700, outline: "none", background: "#FFFFFF"
                        }}
                      >
                        <option value="Admin">Admin</option>
                        <option value="FleetManager">FleetManager</option>
                        <option value="Dispatcher">Dispatcher</option>
                        <option value="Driver">Driver</option>
                      </select>
                      <button
                        onClick={handleBatchRoleUpdate}
                        disabled={batchActionLoading}
                        style={{
                          padding: "5px 12px", borderRadius: "6px", background: "#0D9488",
                          border: "none", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: 700
                        }}
                      >
                        {batchActionLoading ? "Updating..." : "Apply Role"}
                      </button>
                      <button
                        onClick={() => handleBatchStatus(false)}
                        disabled={batchActionLoading}
                        style={{
                          padding: "5px 12px", borderRadius: "6px", background: "rgba(220,38,38,0.12)",
                          border: "1px solid rgba(220,38,38,0.3)", color: "#DC2626", cursor: "pointer", fontSize: "11px", fontWeight: 700
                        }}
                      >
                        🚫 Batch Suspend
                      </button>
                      <button
                        onClick={() => handleBatchStatus(true)}
                        disabled={batchActionLoading}
                        style={{
                          padding: "5px 12px", borderRadius: "6px", background: "rgba(5,150,105,0.12)",
                          border: "1px solid rgba(5,150,105,0.3)", color: "#059669", cursor: "pointer", fontSize: "11px", fontWeight: 700
                        }}
                      >
                        🟢 Batch Activate
                      </button>
                      <button
                        onClick={handleBatchDelete}
                        disabled={batchActionLoading}
                        style={{
                          padding: "5px 12px", borderRadius: "6px", background: "#DC2626",
                          border: "none", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: 700
                        }}
                      >
                        Decommission
                      </button>
                      <button
                        onClick={() => setSelectedUserIds([])}
                        style={{
                          padding: "5px 8px", background: "none", border: "none",
                          color: "#64748B", cursor: "pointer", fontSize: "11px"
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Users Table */}
                <div style={{ overflowX: "auto" }}>
                  {userListLoading ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                      <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px", color: "#D97706" }} />
                      <p style={{ margin: 0, fontSize: "12px" }}>Loading system accounts...</p>
                    </div>
                  ) : filteredSystemUsers.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                      <Users size={30} style={{ opacity: 0.35, marginBottom: "8px" }} />
                      <p style={{ margin: 0, fontSize: "12px", fontWeight: 700 }}>No users found.</p>
                      <p style={{ margin: "4px 0 0", fontSize: "11px" }}>Adjust your filter or search query.</p>
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                          <th style={{ padding: "10px 12px 10px 22px", width: "36px" }}>
                            <input
                              type="checkbox"
                              checked={selectedUserIds.length > 0 && selectedUserIds.length === filteredSystemUsers.length}
                              onChange={handleToggleSelectAll}
                              style={{ cursor: "pointer", accentColor: "#0D9488" }}
                            />
                          </th>
                          <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>User Profile</th>
                          <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Role</th>
                          <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", textAlign: "center" }}>Account Status</th>
                          <th style={{ padding: "10px 22px 10px 12px", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSystemUsers.map((u) => {
                          const badge = roleBadgeStyle(u.role);
                          const isSelected = selectedUserIds.includes(u.user_id);
                          return (
                            <tr
                              key={u.user_id}
                              style={{
                                borderBottom: "1px solid #F8FAFC",
                                background: isSelected ? "#F0FDFA" : "transparent",
                                transition: "background 0.15s"
                              }}
                            >
                              {/* Checkbox */}
                              <td style={{ padding: "11px 12px 11px 22px" }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectOne(u.user_id)}
                                  style={{ cursor: "pointer", accentColor: "#0D9488" }}
                                />
                              </td>

                              {/* User Info */}
                              <td style={{ padding: "11px 12px" }}>
                                {editUserId === u.user_id ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      placeholder="Full Name / Username"
                                      style={{
                                        padding: "4px 8px", borderRadius: "6px", border: "1px solid #0D9488",
                                        fontSize: "12px", color: "#0F172A", outline: "none", width: "150px"
                                      }}
                                    />
                                    <input
                                      type="email"
                                      value={editEmail}
                                      onChange={(e) => setEditEmail(e.target.value)}
                                      placeholder="Email address"
                                      style={{
                                        padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1",
                                        fontSize: "11px", color: "#0F172A", outline: "none", width: "170px"
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{
                                      width: "30px", height: "30px", borderRadius: "8px",
                                      background: badge.bg, border: `1px solid ${badge.border}`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontWeight: 800, fontSize: "12px", color: badge.color, flexShrink: 0
                                    }}>
                                      {u.full_name ? u.full_name[0].toUpperCase() : "U"}
                                    </div>
                                    <div>
                                      <p style={{ margin: 0, fontWeight: 700, fontSize: "12px", color: "#0F172A", lineHeight: 1.3 }}>{u.full_name}</p>
                                      <p style={{ margin: 0, fontSize: "11px", color: "#94A3B8", lineHeight: 1.3 }}>{u.email}</p>
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Role Badge */}
                              <td style={{ padding: "11px 12px" }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", padding: "3px 9px",
                                  borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                                  background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`
                                }}>
                                  {u.role}
                                </span>
                              </td>

                              {/* Status Toggle */}
                              <td style={{ padding: "11px 12px", textAlign: "center" }}>
                                <span style={{
                                  fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "20px",
                                  background: u.is_verified ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
                                  color: u.is_verified ? "#059669" : "#DC2626"
                                }}>
                                  {u.is_verified ? "Active" : "Suspended"}
                                </span>
                              </td>

                              {/* Actions */}
                              <td style={{ padding: "11px 22px 11px 12px", textAlign: "right" }}>
                                {editUserId === u.user_id ? (
                                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                    <button
                                      onClick={() => handleSaveEditUser(u.user_id)}
                                      disabled={editSubmitting}
                                      style={{
                                        padding: "5px 10px", borderRadius: "7px",
                                        background: "linear-gradient(135deg, #0D9488, #0891B2)",
                                        border: "none", color: "white", cursor: editSubmitting ? "wait" : "pointer",
                                        fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px"
                                      }}
                                    >
                                      <Check size={11} /> {editSubmitting ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      onClick={cancelEditUser}
                                      disabled={editSubmitting}
                                      style={{
                                        padding: "5px 8px", borderRadius: "7px",
                                        background: "#F1F5F9", border: "1px solid #CBD5E1",
                                        color: "#64748B", cursor: "pointer", fontSize: "11px"
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                    <button
                                      onClick={() => openEditUser(u)}
                                      title="Edit username and email"
                                      style={{
                                        padding: "5px 9px", borderRadius: "7px",
                                        background: "#F8FAFC", border: "1px solid #CBD5E1",
                                        color: "#0F172A", cursor: "pointer", fontSize: "11px", fontWeight: 600,
                                        display: "inline-flex", alignItems: "center", gap: "4px"
                                      }}
                                    >
                                      <Pencil size={11} color="#0D9488" /> Edit
                                    </button>
                                    <button
                                      onClick={() => handleToggleStatus(u)}
                                      title={u.is_verified ? "Suspend user account" : "Activate user account"}
                                      style={{
                                        padding: "5px 10px", borderRadius: "7px",
                                        background: u.is_verified ? "rgba(220,38,38,0.08)" : "rgba(5,150,105,0.08)",
                                        border: u.is_verified ? "1px solid rgba(220,38,38,0.22)" : "1px solid rgba(5,150,105,0.22)",
                                        color: u.is_verified ? "#DC2626" : "#059669",
                                        cursor: "pointer", fontSize: "11px", fontWeight: 700,
                                        display: "inline-flex", alignItems: "center", gap: "4px"
                                      }}
                                    >
                                      {u.is_verified ? <UserX size={11} /> : <CheckCircle2 size={11} />}
                                      {u.is_verified ? "Suspend" : "Activate"}
                                    </button>
                                    <button
                                      onClick={() => openRoleChangeModal(u)}
                                      style={{
                                        padding: "5px 11px", borderRadius: "7px",
                                        background: "#F1F5F9", border: "1px solid #CBD5E1",
                                        color: "#334155", cursor: "pointer", fontSize: "11px", fontWeight: 600,
                                        display: "inline-flex", alignItems: "center", gap: "4px"
                                      }}
                                    >
                                      <Edit3 size={11} /> Reassign
                                    </button>
                                    <button
                                      onClick={() => openDeleteModal(u)}
                                      style={{
                                        padding: "5px 11px", borderRadius: "7px",
                                        background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)",
                                        color: "#DC2626", cursor: "pointer", fontSize: "11px", fontWeight: 600,
                                        display: "inline-flex", alignItems: "center", gap: "4px"
                                      }}
                                    >
                                      <Trash2 size={11} /> Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Card Footer */}
                <div style={{
                  padding: "10px 22px", borderTop: "1px solid #F1F5F9",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#FAFAFA"
                }}>
                  <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                    Showing <strong style={{ color: "#475569" }}>{filteredSystemUsers.length}</strong> of <strong style={{ color: "#475569" }}>{systemUsers.length}</strong> accounts
                  </span>
                  <button
                    onClick={() => setIsUserManagementModalOpen(true)}
                    style={{
                      padding: "5px 12px", borderRadius: "7px", background: "none",
                      border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer",
                      fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px"
                    }}
                  >
                    <Shield size={11} /> Open Full Governance Panel
                  </button>
                </div>
              </div>

        </div>

              {/* System Health */}
              <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>Background Task Health & Monitoring</h4>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748B" }}>
                    Celery Worker: <strong style={{ color: "#059669" }}>{adminData.system_monitoring.celery_health}</strong> • Last scan: {adminData.system_monitoring.last_celery_check}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B" }}>NOTIFICATIONS SENT</span>
                    <p style={{ margin: 0, fontWeight: 900, fontSize: "16px", color: "#0D9488" }}>{adminData.system_monitoring.total_notifications_dispatched}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B" }}>EMAILS DISPATCHED</span>
                    <p style={{ margin: 0, fontWeight: 900, fontSize: "16px", color: "#059669" }}>{adminData.system_monitoring.emails_logged}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. DRIVER'S PERSONAL DASHBOARD */}
          {isDriver && driverData && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Truck size={16} color="#0D9488" /> My Assigned Vehicle
                    </h3>
                    <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "10px", background: "rgba(13,148,136,0.12)", color: "#0D9488" }}>
                      {driverData.assigned_vehicle ? driverData.assigned_vehicle.status : "Unassigned"}
                    </span>
                  </div>

                  {driverData.assigned_vehicle ? (
                    <div>
                      <p style={{ fontSize: "20px", fontWeight: 900, color: "#0F172A", margin: "0 0 4px" }}>
                        {driverData.assigned_vehicle.registration_number}
                      </p>
                      <p style={{ fontSize: "12px", color: "#64748B", margin: "0 0 10px" }}>
                        {driverData.assigned_vehicle.brand} {driverData.assigned_vehicle.model} • {driverData.assigned_vehicle.vehicle_type} (Capacity: {driverData.assigned_vehicle.capacity} kg)
                      </p>
                      <div style={{ padding: "10px", borderRadius: "10px", background: driverData.vehicle_maintenance_status.includes("Overdue") ? "rgba(220,38,38,0.08)" : "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>MAINTENANCE STATUS:</span>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", fontWeight: 700, color: driverData.vehicle_maintenance_status.includes("Overdue") ? "#DC2626" : "#059669" }}>
                          ● {driverData.vehicle_maintenance_status}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: "#94A3B8", fontSize: "12px" }}>No vehicle currently assigned. Contact your Fleet Manager.</p>
                  )}
                </div>

                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Package size={16} color="#0D9488" /> Current Active Delivery
                    </h3>
                    {driverData.current_shipment && (
                      <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "10px", background: "rgba(79,70,229,0.12)", color: "#4F46E5" }}>
                        {driverData.current_shipment.status}
                      </span>
                    )}
                  </div>

                  {driverData.current_shipment ? (
                    <div>
                      <p style={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", margin: "0 0 4px" }}>
                        {driverData.current_shipment.tracking_number}
                      </p>
                      <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 8px" }}>
                        Customer: <strong>{driverData.current_shipment.customer_name}</strong> • Cargo: {driverData.current_shipment.weight_kg} kg
                      </p>
                      <div style={{ padding: "8px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                        <p style={{ margin: 0, fontSize: "11px", color: "#334155" }}>
                          <strong>Route:</strong> {driverData.current_shipment.source} → {driverData.current_shipment.destination}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748B" }}>
                          Expected: {driverData.current_shipment.expected_delivery}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "24px", color: "#64748B" }}>
                      <CheckCircle2 size={24} style={{ margin: "0 auto 6px", color: "#059669" }} />
                      <p style={{ margin: 0, fontSize: "12px", fontWeight: 700 }}>No active deliveries pending right now.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance & Attendance */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>ON-TIME DELIVERY RATE</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#059669", margin: "6px 0 2px" }}>
                    {driverData.my_performance.on_time_rate_pct}%
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>High performance rating</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488" }}>TRIPS COMPLETED</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#0D9488", margin: "6px 0 2px" }}>
                    {driverData.my_performance.trips_completed} <span style={{ fontSize: "13px", color: "#94A3B8" }}>/ {driverData.my_performance.total_trips}</span>
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Total assigned trips</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5" }}>TOTAL DISTANCE</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#4F46E5", margin: "6px 0 2px" }}>
                    {driverData.my_performance.total_distance_km} km
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Kilometers logged</p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>MONTHLY ATTENDANCE</span>
                  <p style={{ fontSize: "26px", fontWeight: 900, color: "#D97706", margin: "6px 0 2px" }}>
                    {driverData.my_attendance.present_days} <span style={{ fontSize: "13px", color: "#94A3B8" }}>/ {driverData.my_attendance.working_days} Days</span>
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>{driverData.my_attendance.attendance_rate_pct}% presence ({driverData.my_attendance.month_label})</p>
                </div>
              </div>

              {/* Recent Trips Activity */}
              <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Navigation size={16} color="#0D9488" /> My Recent Trips Activity
                </h3>
                {driverData.recent_trips.length === 0 ? (
                  <p style={{ color: "#94A3B8", fontSize: "12px", margin: 0 }}>No recent trips recorded.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E2E8F0", fontSize: "10px", color: "#64748B", textTransform: "uppercase" }}>
                        <th style={{ textAlign: "left", paddingBottom: "8px" }}>Route</th>
                        <th style={{ textAlign: "center", paddingBottom: "8px" }}>Status</th>
                        <th style={{ textAlign: "right", paddingBottom: "8px" }}>Distance</th>
                        <th style={{ textAlign: "right", paddingBottom: "8px" }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverData.recent_trips.map((t) => (
                        <tr key={t.trip_id} style={{ borderBottom: "1px solid #F1F5F9", fontSize: "12px" }}>
                          <td style={{ padding: "10px 0", fontWeight: 700, color: "#0F172A" }}>
                            {t.start_location} → {t.destination}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "8px", background: t.status === "Completed" ? "rgba(5,150,105,0.1)" : "rgba(13,148,136,0.1)", color: t.status === "Completed" ? "#059669" : "#0D9488" }}>
                              {t.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", color: "#475569" }}>{t.distance_km} km</td>
                          <td style={{ textAlign: "right", color: "#94A3B8" }}>{t.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Admin Modals */}
      {isEmailModalOpen && <EmailLogsModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />}
      {isUserManagementModalOpen && (
        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => {
            setIsUserManagementModalOpen(false);
            fetchSystemUsers();
            fetchDashboardMetrics();
          }}
        />
      )}
      {isAddUserModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#FFFFFF", borderRadius: "16px", width: "420px", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>Provision New System User</h3>
              <button onClick={() => setIsAddUserModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddUserSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Full Name</label>
                <input
                  required
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", boxSizing: "border-box", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", boxSizing: "border-box", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", boxSizing: "border-box", outline: "none" }}
                >
                  <option value="FleetManager">Fleet Manager</option>
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Driver">Driver</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Temporary Password</label>
                <input
                  type="password"
                  required
                  value={newUserForm.temporary_password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, temporary_password: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", boxSizing: "border-box", outline: "none" }}
                />
              </div>
              {newUserForm.role === "Driver" && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>License Number</label>
                  <input
                    value={newUserForm.license_number}
                    onChange={(e) => setNewUserForm({ ...newUserForm, license_number: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", boxSizing: "border-box", outline: "none" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setIsAddUserModalOpen(false)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
                <button type="submit" disabled={addUserLoading} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#D97706", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  {addUserLoading ? "Provisioning..." : "Provision User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Role Change Modal */}
      {roleModalUser && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "460px", width: "100%", padding: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={18} color="#D97706" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>Reassign Role & Privileges</h3>
              </div>
              <button onClick={() => setRoleModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleConfirmRoleChange} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>Account Member:</p>
                <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>{roleModalUser.full_name} ({roleModalUser.email})</p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748B" }}>Current Role: <span style={{ fontWeight: 700, color: "#0D9488" }}>{roleModalUser.role}</span></p>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>Select New Assigned Role</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                >
                  <option value="Admin">Admin (Executive Governance & Full Access)</option>
                  <option value="FleetManager">FleetManager (Vehicles, Fuel & Maintenance)</option>
                  <option value="Dispatcher">Dispatcher (Shipments, Trips & GPS Tracking)</option>
                  <option value="Driver">Driver (Driver Manifests & Attendance)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>Admin Note / Reason (Included in notification email)</label>
                <textarea
                  rows={2}
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  placeholder="e.g. Promoted to Senior Logistics Manager..."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.2)", borderRadius: "8px", padding: "10px 12px", display: "flex", gap: "8px" }}>
                <Info size={15} color="#0D9488" style={{ flexShrink: 0, marginTop: "2px" }} />
                <p style={{ margin: 0, fontSize: "11px", color: "#0F766E", lineHeight: 1.4 }}>
                  A role transition email with new permission details will be dispatched to <strong>{roleModalUser.email}</strong>.
                </p>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" onClick={() => setRoleModalUser(null)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
                <button type="submit" disabled={roleChangeSubmitting} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#0D9488", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  {roleChangeSubmitting ? "Updating..." : "Confirm & Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Delete Confirmation Modal */}
      {deleteModalUser && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "440px", width: "100%", padding: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={20} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#DC2626" }}>Decommission User Account</h3>
              </div>
              <button onClick={() => setDeleteModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.5, margin: "0 0 12px" }}>
              Permanently delete <strong>{deleteModalUser.full_name}</strong> ({deleteModalUser.email})?
            </p>
            <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#B91C1C", lineHeight: 1.4 }}>
                <strong>Safe FK Cleanup:</strong> Driver records, vehicle assignments, trips, attendance, and leave requests will be safely unlinked. A decommission email will be sent.
              </p>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>Reason for Termination (Optional)</label>
              <input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. End of contract / Organization offboarding..."
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setDeleteModalUser(null)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
              <button type="button" onClick={handleConfirmDelete} disabled={deleteSubmitting} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#DC2626", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                {deleteSubmitting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
