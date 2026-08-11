import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import fleetApi from "../api/fleet";
import api from "../api/axios";
import {
  UserCheck, Plus, RefreshCw, Search, Edit2, Trash2,
  CheckCircle2, XCircle, CreditCard, Award, MapPin, X
} from "lucide-react";
import { toast } from "react-toastify";

const Drivers = () => {
  const { user } = useAuth();
  const canManage = ["Admin", "FleetManager"].includes(user?.role);

  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    user_id: "",
    license_number: "",
    experience_years: 3,
    address: "",
    status: "Active",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dList = await fleetApi.getDrivers();
      setDrivers(dList || []);
    } catch (err) {
      toast.error("Failed to load drivers data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAddModal = () => {
    setEditingDriver(null);
    setForm({
      user_id: "",
      license_number: "",
      experience_years: 3,
      address: "",
      status: "Active",
    });
    setShowModal(true);
  };

  const openEditModal = (d) => {
    setEditingDriver(d);
    setForm({
      user_id: d.user_id || "",
      license_number: d.license_number || "",
      experience_years: d.experience_years || 0,
      address: d.address || "",
      status: d.status || "Active",
    });
    setShowModal(true);
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Are you sure you want to remove driver ${d.driver_name || d.license_number}?`)) return;
    try {
      await fleetApi.deleteDriver(d.driver_id);
      toast.success("Driver record removed.");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not delete driver.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      experience_years: parseInt(form.experience_years, 10) || 0,
      user_id: form.user_id || null,
    };

    try {
      if (editingDriver) {
        await fleetApi.updateDriver(editingDriver.driver_id, payload);
        toast.success("Driver updated.");
      } else {
        await fleetApi.createDriver(payload);
        toast.success("Driver created successfully!");
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = drivers.filter((d) => {
    const matchSearch =
      !search ||
      (d.driver_name && d.driver_name.toLowerCase().includes(search.toLowerCase())) ||
      (d.license_number && d.license_number.toLowerCase().includes(search.toLowerCase())) ||
      (d.address && d.address.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "All" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: drivers.length,
    active: drivers.filter((d) => d.status === "Active").length,
    inactive: drivers.filter((d) => d.status === "Inactive").length,
  };

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Drivers Directory
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            Manage commercial drivers and CDL licenses
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={fetchData} style={{
            padding: "9px 14px", borderRadius: "10px",
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            fontSize: "12px", fontWeight: 600, boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
          }}>
            <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
            Refresh
          </button>

          {canManage && (
            <button onClick={openAddModal} style={{
              padding: "9px 18px", borderRadius: "10px",
              background: "#0D9488", border: "none", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(13,148,136,0.25)"
            }}>
              <Plus size={15} />
              Add Driver
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>TOTAL DRIVERS</span>
          <p style={{ color: "#0F172A", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.total}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>ACTIVE ON DUTY</span>
          <p style={{ color: "#059669", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.active}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#DC2626", textTransform: "uppercase" }}>INACTIVE</span>
          <p style={{ color: "#DC2626", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.inactive}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748B" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search driver name, CDL license..."
            style={{
              width: "100%", padding: "9px 14px 9px 36px", background: "#FFFFFF",
              border: "1px solid #E2E8F0", borderRadius: "10px", color: "#0F172A",
              fontSize: "13px", outline: "none", boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {["All", "Active", "Inactive"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                cursor: "pointer", background: statusFilter === s ? "#0D9488" : "#FFFFFF",
                border: statusFilter === s ? "1px solid #0D9488" : "1px solid #E2E8F0",
                color: statusFilter === s ? "#FFFFFF" : "#475569"
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Driver Table */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px" }} />
            <p style={{ margin: 0 }}>Loading drivers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <UserCheck size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
            <p style={{ fontWeight: 700, margin: 0 }}>No drivers found.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                {["Driver Name", "CDL License #", "Experience", "Address / Depot", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.driver_id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px" }}>
                    {d.driver_name}
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: "#0D9488", fontWeight: 800 }}>
                    {d.license_number || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                    {d.experience_years ? `${d.experience_years} years` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                    {d.address || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                      background: d.status === "Active" ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
                      color: d.status === "Active" ? "#059669" : "#DC2626",
                      border: d.status === "Active" ? "1px solid rgba(5,150,105,0.25)" : "1px solid rgba(220,38,38,0.25)"
                    }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {canManage && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => openEditModal(d)}
                          title="Edit Driver"
                          style={{ padding: "6px", borderRadius: "6px", background: "rgba(79,70,229,0.1)", border: "none", color: "#4F46E5", cursor: "pointer" }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          title="Delete Driver"
                          style={{ padding: "6px", borderRadius: "6px", background: "rgba(220,38,38,0.1)", border: "none", color: "#DC2626", cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", maxWidth: "440px", width: "100%", padding: "24px", color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                {editingDriver ? "Edit Driver Details" : "Register New Driver"}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>CDL License Number *</label>
                <input
                  required
                  placeholder="e.g. CDL-98234-TX"
                  value={form.license_number}
                  onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Experience (Years)</label>
                <input
                  type="number"
                  placeholder="5"
                  value={form.experience_years}
                  onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Depot / Address</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Central Depot - Bay 4"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: "9px 16px", borderRadius: "8px", background: "transparent", border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: "9px 20px", borderRadius: "8px", background: "#0D9488", border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                >
                  {saving ? "Saving..." : editingDriver ? "Update Driver" : "Create Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;
