import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import {
  Users, X, Search, ShieldCheck, UserCheck, RefreshCw, Trash2, Edit3, Check, AlertTriangle
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
  const [updatingId, setUpdatingId] = useState(null);

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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      const res = await api.patch(`/auth/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole} for ${res.data.full_name}`);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user role.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Permanently delete account for ${user.full_name} (${user.email})?`)) return;
    try {
      await api.delete(`/auth/users/${user.user_id}`);
      toast.success(`User ${user.full_name} deleted.`);
      setUsers((prev) => prev.filter((u) => u.user_id !== user.user_id));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete user.");
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    }}>
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "18px", maxWidth: "820px", width: "100%", maxHeight: "88vh",
        display: "flex", flexDirection: "column", color: "#0F172A", boxShadow: "0 25px 60px rgba(15,23,42,0.2)"
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "linear-gradient(135deg, #D97706, #B45309)", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(217,119,6,0.25)"
            }}>
              <ShieldCheck size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                Admin User & Role Governance
              </h2>
              <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>
                Manage all accounts and dynamically update role permissions
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={fetchUsers}
              style={{
                padding: "7px 12px", borderRadius: "8px", background: "#F8FAFC",
                border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "6px"
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

        {/* Search Bar */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #F1F5F9", background: "#FAFAFA", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px 8px 34px", borderRadius: "8px",
                border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box"
              }}
            />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748B" }}>
            {filteredUsers.length} Users
          </span>
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
                  <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>User</th>
                  <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Current Role</th>
                  <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Change Role</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const badge = roleBadgeStyle(u.role);
                  const isUpdating = updatingId === u.user_id;

                  return (
                    <tr key={u.user_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
                            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px"
                          }}>
                            {u.full_name ? u.full_name[0].toUpperCase() : "U"}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>{u.full_name}</p>
                            <p style={{ margin: 0, fontSize: "11px", color: "#64748B" }}>{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "12px 8px" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: "6px",
                          fontSize: "11px", fontWeight: 700, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`
                        }}>
                          {u.role}
                        </span>
                      </td>

                      <td style={{ padding: "12px 8px" }}>
                        <select
                          value={u.role}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                          style={{
                            padding: "6px 10px", borderRadius: "8px", border: "1px solid #CBD5E1",
                            background: "#FFFFFF", fontSize: "12px", fontWeight: 700, color: "#0F172A",
                            cursor: isUpdating ? "not-allowed" : "pointer", outline: "none"
                          }}
                        >
                          <option value="Admin">Admin</option>
                          <option value="FleetManager">FleetManager</option>
                          <option value="Dispatcher">Dispatcher</option>
                          <option value="Driver">Driver</option>
                        </select>
                      </td>

                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title="Delete User Account"
                          style={{
                            padding: "6px 10px", borderRadius: "6px", background: "rgba(220,38,38,0.08)",
                            border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626", cursor: "pointer",
                            fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px"
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end" }}>
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
    </div>
  );
};

export default UserManagementModal;
