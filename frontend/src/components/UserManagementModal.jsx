import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import {
  Users, X, Search, ShieldCheck, UserCheck, RefreshCw, Trash2, Edit3, Check,
  AlertTriangle, Shield, CheckSquare, Square, UserX, MessageSquare, Info,
  Pencil, CheckCircle2
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

const UserManagementModal = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [updatingId, setUpdatingId] = useState(null);

  // Multi-select state
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [batchRole, setBatchRole] = useState("Driver");
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Role change with reason modal
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [targetRole, setTargetRole] = useState("Driver");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [roleChangeSubmitting, setRoleChangeSubmitting] = useState(false);

  // Delete modal with reason
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load system users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setSelectedUserIds([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openRoleChangeModal = (user) => {
    setRoleModalUser(user);
    setTargetRole(user.role);
    setRoleChangeReason("");
  };

  const handleConfirmRoleChange = async (e) => {
    e.preventDefault();
    if (!roleModalUser) return;
    setRoleChangeSubmitting(true);
    try {
      const res = await api.patch(`/auth/users/${roleModalUser.user_id}/role`, {
        role: targetRole,
        reason: roleChangeReason || undefined,
      });
      toast.success(`Role updated to ${targetRole} for ${res.data.full_name}! Notification email sent to ${res.data.email}.`);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === roleModalUser.user_id ? { ...u, role: targetRole } : u))
      );
      setRoleModalUser(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user role.");
    } finally {
      setRoleChangeSubmitting(false);
    }
  };

  const openDeleteModal = (user) => {
    setDeleteModalUser(user);
    setDeleteReason("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser) return;
    setDeleteSubmitting(true);
    try {
      const q = deleteReason ? `?reason=${encodeURIComponent(deleteReason)}` : "";
      const res = await api.delete(`/auth/users/${deleteModalUser.user_id}${q}`);
      toast.success(res.data?.message || `User ${deleteModalUser.full_name} deleted.`);
      setUsers((prev) => prev.filter((u) => u.user_id !== deleteModalUser.user_id));
      setSelectedUserIds((prev) => prev.filter((id) => id !== deleteModalUser.user_id));
      setDeleteModalUser(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete user.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = !user.is_verified;
    const actionName = nextStatus ? "activate" : "suspend";
    if (!window.confirm(`Are you sure you want to ${actionName} the account for ${user.full_name || user.email}?`)) {
      return;
    }
    try {
      await api.patch(`/auth/users/${user.user_id}/status`, { is_verified: nextStatus });
      toast.success(`Account for ${user.full_name || user.email} successfully ${nextStatus ? "activated" : "suspended"}.`);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, is_verified: nextStatus } : u))
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${actionName} account.`);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.user_id));
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
        reason: `Admin modal batch account ${actionName}`,
      });
      toast.success(res.data?.message || `Accounts successfully ${statusVal ? "activated" : "suspended"}.`);
      setUsers((prev) =>
        prev.map((u) => (selectedUserIds.includes(u.user_id) ? { ...u, is_verified: statusVal } : u))
      );
      setSelectedUserIds([]);
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
        reason: "Admin batch role update",
      });
      toast.success(res.data?.message || `Updated ${selectedUserIds.length} users to ${batchRole}.`);
      setUsers((prev) =>
        prev.map((u) => (selectedUserIds.includes(u.user_id) ? { ...u, role: batchRole } : u))
      );
      setSelectedUserIds([]);
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
        reason: "Admin batch account decommission",
      });
      toast.success(res.data?.message || `Decommissioned ${selectedUserIds.length} accounts.`);
      setUsers((prev) => prev.filter((u) => !selectedUserIds.includes(u.user_id)));
      setSelectedUserIds([]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to batch delete accounts.");
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Inline edit state for name/email only (role is separate admin control)
  const [editUserId, setEditUserId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEditUser = (user) => {
    setEditUserId(user.user_id);
    setEditName(user.full_name || "");
    setEditEmail(user.email || "");
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
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, full_name: res.data.full_name, email: res.data.email } : u))
      );
      setEditUserId(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user profile.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (roleFilter === "ALL") return true;
    if (roleFilter === "SUSPENDED") return u.is_verified === false;
    return u.role === roleFilter;
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    }}>
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "18px", maxWidth: "920px", width: "100%", maxHeight: "90vh",
        display: "flex", flexDirection: "column", color: "#0F172A", boxShadow: "0 25px 60px rgba(15,23,42,0.2)"
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "10px",
              background: "linear-gradient(135deg, #D97706, #B45309)", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(217,119,6,0.25)"
            }}>
              <ShieldCheck size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                Admin User &amp; Role Privilege Governance
              </h2>
              <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>
                Dynamic RBAC management, safe foreign-key decommissions, and automated email alerts
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={fetchUsers}
              style={{
                padding: "6px 12px", borderRadius: "8px", background: "#F8FAFC",
                border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "5px"
              }}
            >
              <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
              Refresh
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #F1F5F9", background: "#FAFAFA", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                placeholder="Search by name, email, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "7px 10px 7px 32px", borderRadius: "8px",
                  border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box"
                }}
              />
            </div>

            {/* Role Filter Tabs */}
            <div style={{ display: "flex", gap: "4px" }}>
              {["ALL", "Admin", "FleetManager", "Dispatcher", "Driver", "SUSPENDED"].map((rf) => (
                <button
                  key={rf}
                  onClick={() => setRoleFilter(rf)}
                  style={{
                    padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                    border: roleFilter === rf ? "1px solid #0D9488" : "1px solid #E2E8F0",
                    background: roleFilter === rf ? "#0D9488" : "#FFFFFF",
                    color: roleFilter === rf ? "#FFFFFF" : "#475569",
                  }}
                >
                  {rf === "ALL" ? "All" : rf === "SUSPENDED" ? "Suspended" : rf}
                </button>
              ))}
            </div>
          </div>

          {/* Batch Actions Bar (when items selected) */}
          {selectedUserIds.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#F0FDFA", border: "1px solid #99F6E4", borderRadius: "8px", padding: "8px 14px"
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F766E" }}>
                {selectedUserIds.length} user(s) selected
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <select
                  value={batchRole}
                  onChange={(e) => setBatchRole(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #99F6E4", fontSize: "11px", fontWeight: 700, outline: "none" }}
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
                    padding: "5px 10px", borderRadius: "6px", background: "#0D9488",
                    border: "none", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: 700
                  }}
                >
                  Apply Role to Selected
                </button>
                <button
                  onClick={() => handleBatchStatus(false)}
                  disabled={batchActionLoading}
                  style={{
                    padding: "5px 10px", borderRadius: "6px", background: "rgba(220,38,38,0.12)",
                    border: "1px solid rgba(220,38,38,0.3)", color: "#DC2626", cursor: "pointer", fontSize: "11px", fontWeight: 700
                  }}
                >
                  🚫 Batch Suspend
                </button>
                <button
                  onClick={() => handleBatchStatus(true)}
                  disabled={batchActionLoading}
                  style={{
                    padding: "5px 10px", borderRadius: "6px", background: "rgba(5,150,105,0.12)",
                    border: "1px solid rgba(5,150,105,0.3)", color: "#059669", cursor: "pointer", fontSize: "11px", fontWeight: 700
                  }}
                >
                  🟢 Batch Activate
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={batchActionLoading}
                  style={{
                    padding: "5px 10px", borderRadius: "6px", background: "#DC2626",
                    border: "none", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: 700
                  }}
                >
                  Decommission Selected
                </button>
                <button
                  onClick={() => setSelectedUserIds([])}
                  style={{ padding: "5px 8px", background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: "11px" }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
              <RefreshCw size={22} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px", color: "#D97706" }} />
              <p style={{ margin: 0, fontSize: "13px" }}>Loading system accounts...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
              <Users size={32} style={{ opacity: 0.4, marginBottom: "8px" }} />
              <p style={{ margin: 0, fontWeight: 700 }}>No users found matching "{search}".</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#FFFFFF", position: "sticky", top: 0, zIndex: 1 }}>
                  <th style={{ padding: "12px 6px", textAlign: "left", width: "30px" }}>
                    <button
                      onClick={handleToggleSelectAll}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 0 }}
                    >
                      {selectedUserIds.length > 0 && selectedUserIds.length === filteredUsers.length ? (
                        <CheckSquare size={16} color="#0D9488" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>User</th>
                  <th style={{ padding: "12px 10px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Role</th>
                  <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.user_id);
                  const badge = roleBadgeStyle(u.role);
                  return (
                    <tr
                      key={u.user_id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        background: isSelected ? "rgba(13,148,136,0.05)" : "transparent"
                      }}
                    >
                      <td style={{ padding: "10px 6px" }}>
                        <button
                          onClick={() => handleToggleSelectOne(u.user_id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 0 }}
                        >
                          {isSelected ? <CheckSquare size={15} color="#0D9488" /> : <Square size={15} />}
                        </button>
                      </td>

                      <td style={{ padding: "10px" }}>
                        {editUserId === u.user_id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Full Name / Username"
                              style={{
                                padding: "4px 8px", borderRadius: "6px", border: "1px solid #0D9488",
                                fontSize: "12px", color: "#0F172A", outline: "none", width: "160px"
                              }}
                            />
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Email address"
                              style={{
                                padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1",
                                fontSize: "11px", color: "#0F172A", outline: "none", width: "180px"
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                              width: "28px", height: "28px", borderRadius: "50%",
                              background: badge.bg, color: badge.color, display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "11px", fontWeight: 800
                            }}>
                              {u.full_name ? u.full_name[0].toUpperCase() : "U"}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>{u.full_name}</p>
                              <p style={{ margin: 0, fontSize: "11px", color: "#64748B" }}>{u.email}</p>
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "10px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700,
                          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`
                        }}>
                          {u.role}
                        </span>
                      </td>

                      <td style={{ padding: "10px 8px" }}>
                        <span
                          style={{
                            padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 700,
                            background: u.is_verified ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
                            color: u.is_verified ? "#059669" : "#DC2626",
                            border: `1px solid ${u.is_verified ? "rgba(5,150,105,0.25)" : "rgba(220,38,38,0.25)"}`
                          }}
                        >
                          {u.is_verified ? "Active" : "Suspended"}
                        </span>
                      </td>

                      <td style={{ padding: "10px 8px", textAlign: "right" }}>
                        {editUserId === u.user_id ? (
                          <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                            <button
                              onClick={() => handleSaveEditUser(u.user_id)}
                              disabled={editSubmitting}
                              style={{
                                padding: "5px 10px", borderRadius: "6px",
                                background: "linear-gradient(135deg, #0D9488, #0891B2)",
                                border: "none", color: "white", cursor: editSubmitting ? "wait" : "pointer",
                                fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px"
                              }}
                            >
                              <Check size={12} /> {editSubmitting ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditUser}
                              disabled={editSubmitting}
                              style={{
                                padding: "5px 8px", borderRadius: "6px",
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
                              title="Edit user name and email (Role is admin-governed)"
                              style={{
                                padding: "5px 8px", borderRadius: "6px",
                                background: "#F8FAFC", border: "1px solid #CBD5E1",
                                color: "#0F172A", cursor: "pointer", fontSize: "11px",
                                fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px"
                              }}
                            >
                              <Pencil size={11} color="#0D9488" /> Edit
                            </button>

                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={u.is_verified ? "Suspend user account" : "Activate user account"}
                              style={{
                                padding: "5px 10px", borderRadius: "6px",
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
                                padding: "5px 10px", borderRadius: "6px", background: "#F1F5F9",
                                border: "1px solid #CBD5E1", color: "#0F172A", cursor: "pointer",
                                fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px"
                              }}
                            >
                              <Edit3 size={12} /> Reassign Role
                            </button>

                            <button
                              onClick={() => openDeleteModal(u)}
                              title="Decommission & Delete Account"
                              style={{
                                padding: "5px 10px", borderRadius: "6px", background: "rgba(220,38,38,0.08)",
                                border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626", cursor: "pointer",
                                fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px"
                              }}
                            >
                              <Trash2 size={12} /> Delete
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

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#64748B" }}>
            Total accounts: <strong>{users.length}</strong>
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px", borderRadius: "8px", background: "#0F172A",
              border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Role Change Modal with Reason & Email Preview */}
      {roleModalUser && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: "16px", maxWidth: "460px", width: "100%",
            padding: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={18} color="#D97706" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>
                  Reassign Role &amp; Privileges
                </h3>
              </div>
              <button onClick={() => setRoleModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmRoleChange} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>Account Member:</p>
                <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>
                  {roleModalUser.full_name} ({roleModalUser.email})
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748B" }}>
                  Current Role: <span style={{ fontWeight: 700, color: "#0D9488" }}>{roleModalUser.role}</span>
                </p>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Select New Assigned Role
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: "8px",
                    border: "1px solid #CBD5E1", fontSize: "13px", fontWeight: 700, outline: "none", boxSizing: "border-box"
                  }}
                >
                  <option value="Admin">Admin (Executive Governance &amp; Full Access)</option>
                  <option value="FleetManager">FleetManager (Vehicles, Fuel &amp; Maintenance)</option>
                  <option value="Dispatcher">Dispatcher (Shipments, Trips &amp; GPS Tracking)</option>
                  <option value="Driver">Driver (Driver Manifests &amp; Attendance)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Admin Note / Reason (Included in notification email)
                </label>
                <textarea
                  rows={2}
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  placeholder="e.g. Promoted to Senior Logistics Manager / Transferred to North Hub operations..."
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: "8px",
                    border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.2)", borderRadius: "8px", padding: "10px 12px", display: "flex", gap: "8px" }}>
                <Info size={16} color="#0D9488" style={{ flexShrink: 0, marginTop: "2px" }} />
                <p style={{ margin: 0, fontSize: "11px", color: "#0F766E", lineHeight: 1.4 }}>
                  An official role transition email detailing new capabilities and permissions will automatically be dispatched to <strong>{roleModalUser.email}</strong>.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", cursor: "pointer", fontSize: "12px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleChangeSubmitting}
                  style={{
                    padding: "8px 18px", borderRadius: "8px", border: "none",
                    background: "#0D9488", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700
                  }}
                >
                  {roleChangeSubmitting ? "Updating..." : "Confirm & Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal with Reason */}
      {deleteModalUser && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: "16px", maxWidth: "440px", width: "100%",
            padding: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={20} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#DC2626" }}>
                  Decommission User Account
                </h3>
              </div>
              <button onClick={() => setDeleteModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.5, margin: "0 0 12px" }}>
              Are you sure you want to permanently delete <strong>{deleteModalUser.full_name}</strong> ({deleteModalUser.email})?
            </p>

            <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#B91C1C", lineHeight: 1.4 }}>
                <strong>Safe Foreign-Key Cleanup:</strong> Driver records, vehicle assignments, and trip links will be safely detached or archived. A decommission notice email will be sent to the user.
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                Reason for Termination (Optional)
              </label>
              <input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. End of contract / Organization offboarding..."
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: "8px",
                  border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", cursor: "pointer", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "none",
                  background: "#DC2626", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700
                }}
              >
                {deleteSubmitting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementModal;
