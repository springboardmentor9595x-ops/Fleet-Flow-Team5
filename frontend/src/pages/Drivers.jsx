import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import fleetApi from "../api/fleet";
import {
  UserCheck, Plus, RefreshCw, Search, Edit2, Trash2,
  X, ToggleLeft, ToggleRight, Activity, Wifi, WifiOff
} from "lucide-react";
import { toast } from "react-toastify";

const STATUS_STYLES = {
  Active: {
    bg: "rgba(5,150,105,0.12)",
    color: "#059669",
    border: "rgba(5,150,105,0.3)",
    dot: "#059669",
  },
  Inactive: {
    bg: "rgba(220,38,38,0.1)",
    color: "#DC2626",
    border: "rgba(220,38,38,0.25)",
    dot: "#DC2626",
  },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Inactive;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{
        width: "6px", height: "6px", borderRadius: "50%", background: s.dot,
        boxShadow: status === "Active" ? `0 0 0 2px rgba(5,150,105,0.2)` : "none",
        animation: status === "Active" ? "pulse 2s infinite" : "none",
        display: "inline-block",
      }} />
      {status}
    </span>
  );
};

const Drivers = () => {
  const { user } = useAuth();
  const canManage = ["Admin", "FleetManager"].includes(user?.role);
  const isDriver = user?.role === "Driver";

  const [drivers, setDrivers] = useState([]);
  const [myDriver, setMyDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

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
      const list = dList || [];
      setDrivers(list);

      if (isDriver) {
        try {
          const myProfile = await fleetApi.getMyDriver();
          setMyDriver(myProfile || null);
        } catch (e) {
          console.error("Error fetching own driver profile:", e);
        }
      }
    } catch (err) {
      toast.error("Failed to load drivers data");
    } finally {
      setLoading(false);
    }
  }, [isDriver]);

  useEffect(() => {
    fetchData();

    const handleStatusChanged = () => {
      fetchData();
    };
    window.addEventListener("driver_status_changed", handleStatusChanged);
    return () => window.removeEventListener("driver_status_changed", handleStatusChanged);
  }, [fetchData]);

  // Driver toggles their own status
  const handleToggleMyStatus = async () => {
    if (!myDriver) return;
    const newStatus = myDriver.status === "Active" ? "Inactive" : "Active";
    setTogglingId("me");
    try {
      const updated = await fleetApi.setMyStatus(newStatus);
      setMyDriver((prev) => ({ ...prev, status: updated.status }));
      setDrivers((prev) =>
        prev.map((d) => (d.driver_id === updated.driver_id ? { ...d, status: updated.status } : d))
      );
      toast.success(`You are now ${updated.status}.`);
      window.dispatchEvent(new Event("driver_status_changed"));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not update your status.");
    } finally {
      setTogglingId(null);
    }
  };

  // Admin/FM quick-toggle any driver's status
  const handleQuickToggle = async (d) => {
    const newStatus = d.status === "Active" ? "Inactive" : "Active";
    setTogglingId(d.driver_id);
    try {
      await fleetApi.toggleDriverStatus(d.driver_id, newStatus);
      setDrivers((prev) =>
        prev.map((row) => (row.driver_id === d.driver_id ? { ...row, status: newStatus } : row))
      );
      toast.success(`${d.driver_name || "Driver"} marked ${newStatus}.`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not update status.");
    } finally {
      setTogglingId(null);
    }
  };

  const openAddModal = () => {
    setEditingDriver(null);
    setForm({ user_id: "", license_number: "", experience_years: 3, address: "", status: "Active" });
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
    if (!window.confirm(`Remove driver ${d.driver_name || d.license_number}?`)) return;
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

      {/* ── My Duty Status Card (Driver only) ── */}
      {isDriver && (
        <div style={{
          marginBottom: "24px",
          borderRadius: "16px",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          background: !myDriver
            ? "linear-gradient(135deg, #FFFBEB, #FEF3C7)"
            : myDriver.status === "Active"
              ? "linear-gradient(135deg, #ECFDF5, #D1FAE5)"
              : "linear-gradient(135deg, #FEF2F2, #FEE2E2)",
          border: !myDriver
            ? "1.5px solid rgba(245,158,11,0.4)"
            : myDriver.status === "Active"
              ? "1.5px solid rgba(5,150,105,0.3)"
              : "1.5px solid rgba(220,38,38,0.3)",
        }}>
          {/* Left side: icon + text */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: !myDriver
                ? "rgba(245,158,11,0.15)"
                : myDriver.status === "Active"
                  ? "rgba(5,150,105,0.15)"
                  : "rgba(220,38,38,0.12)",
            }}>
              {!myDriver
                ? <Activity size={22} color="#D97706" />
                : myDriver.status === "Active"
                  ? <Wifi size={22} color="#059669" />
                  : <WifiOff size={22} color="#DC2626" />}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                My Duty Status
              </p>
              {loading ? (
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94A3B8" }}>Loading...</p>
              ) : myDriver ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                  <StatusBadge status={myDriver.status} />
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    {myDriver.status === "Active"
                      ? "You are visible as available for trips."
                      : "You are marked off-duty. Admins can see this."}
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: "4px" }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#92400E", fontWeight: 600 }}>
                    No driver profile linked to your account.
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#B45309" }}>
                    Ask your Admin to link a driver record to your user account.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right side: toggle button */}
          {myDriver && (
            <button
              onClick={handleToggleMyStatus}
              disabled={togglingId === "me"}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "11px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                border: "none", cursor: togglingId === "me" ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                opacity: togglingId === "me" ? 0.6 : 1,
                transition: "opacity 0.15s",
                color: "#FFFFFF",
                background: myDriver.status === "Active"
                  ? "linear-gradient(135deg, #DC2626, #B91C1C)"
                  : "linear-gradient(135deg, #059669, #047857)",
                boxShadow: myDriver.status === "Active"
                  ? "0 4px 14px rgba(220,38,38,0.3)"
                  : "0 4px 14px rgba(5,150,105,0.3)",
              }}
            >
              {togglingId === "me"
                ? "Updating..."
                : myDriver.status === "Active"
                  ? <><ToggleLeft size={16} /> Set Inactive</>
                  : <><ToggleRight size={16} /> Set Active</>}
            </button>
          )}
        </div>
      )}

      {/* ── Page Header ── */}
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
            padding: "9px 14px", borderRadius: "10px", background: "#FFFFFF",
            border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "12px", fontWeight: 600, boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
          }}>
            <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
            Refresh
          </button>
          {canManage && (
            <button onClick={openAddModal} style={{
              padding: "9px 18px", borderRadius: "10px", background: "#0D9488",
              border: "none", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(13,148,136,0.25)"
            }}>
              <Plus size={15} /> Add Driver
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>TOTAL DRIVERS</span>
          <p style={{ color: "#0F172A", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.total}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid rgba(5,150,105,0.2)", boxShadow: "0 4px 12px rgba(5,150,105,0.05)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>ACTIVE ON DUTY</span>
          <p style={{ color: "#059669", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.active}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid rgba(220,38,38,0.15)", boxShadow: "0 4px 12px rgba(220,38,38,0.04)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#DC2626", textTransform: "uppercase" }}>INACTIVE / OFF-DUTY</span>
          <p style={{ color: "#DC2626", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.inactive}</p>
        </div>
      </div>

      {/* ── Search & Filters ── */}
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
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "7px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
              cursor: "pointer",
              background: statusFilter === s ? "#0D9488" : "#FFFFFF",
              border: statusFilter === s ? "1px solid #0D9488" : "1px solid #E2E8F0",
              color: statusFilter === s ? "#FFFFFF" : "#475569"
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Driver Table ── */}
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
              {filtered.map((d) => {
                const isMe = isDriver && d.user_id && String(d.user_id) === String(user?.user_id);
                return (
                  <tr key={d.driver_id} style={{
                    borderBottom: "1px solid #E2E8F0",
                    background: isMe ? "rgba(13,148,136,0.04)" : "transparent",
                  }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {d.driver_name}
                        {isMe && (
                          <span style={{
                            fontSize: "9px", fontWeight: 800, padding: "2px 7px",
                            borderRadius: "10px", background: "rgba(13,148,136,0.12)",
                            color: "#0D9488", border: "1px solid rgba(13,148,136,0.25)",
                            textTransform: "uppercase",
                          }}>You</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: "#0D9488", fontWeight: 800 }}>
                      {d.license_number || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                      {d.experience_years ? `${d.experience_years} yrs` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                      {d.address || "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={d.status} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {/* Admin/FM: quick status toggle */}
                        {canManage && (
                          <button
                            onClick={() => handleQuickToggle(d)}
                            disabled={togglingId === d.driver_id}
                            title={d.status === "Active" ? "Mark Inactive" : "Mark Active"}
                            style={{
                              padding: "5px 10px", borderRadius: "7px", fontSize: "10px", fontWeight: 700,
                              border: "none", cursor: togglingId === d.driver_id ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", gap: "4px",
                              opacity: togglingId === d.driver_id ? 0.5 : 1,
                              background: d.status === "Active" ? "rgba(220,38,38,0.1)" : "rgba(5,150,105,0.1)",
                              color: d.status === "Active" ? "#DC2626" : "#059669",
                            }}
                          >
                            {d.status === "Active"
                              ? <><ToggleLeft size={12} /> Deactivate</>
                              : <><ToggleRight size={12} /> Activate</>}
                          </button>
                        )}
                        {/* Admin/FM: edit, Admin-only: delete */}
                        {canManage && (
                          <>
                            <button onClick={() => openEditModal(d)} title="Edit Driver"
                              style={{ padding: "6px", borderRadius: "6px", background: "rgba(79,70,229,0.1)", border: "none", color: "#4F46E5", cursor: "pointer" }}>
                              <Edit2 size={14} />
                            </button>
                            {user?.role === "Admin" && (
                              <button onClick={() => handleDelete(d)} title="Delete Driver (Admin Only)"
                                style={{ padding: "6px", borderRadius: "6px", background: "rgba(220,38,38,0.1)", border: "none", color: "#DC2626", cursor: "pointer" }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                        {!canManage && (
                          <span style={{ fontSize: "11px", color: "#94A3B8" }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
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
                <input required placeholder="e.g. CDL-98234-TX" value={form.license_number}
                  onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Experience (Years)</label>
                <input type="number" placeholder="5" value={form.experience_years}
                  onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Depot / Address</label>
                <textarea rows={2} placeholder="e.g. Central Depot - Bay 4" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box", resize: "none" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding: "9px 16px", borderRadius: "8px", background: "transparent", border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: "9px 20px", borderRadius: "8px", background: "#0D9488", border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  {saving ? "Saving..." : editingDriver ? "Update Driver" : "Create Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
};

export default Drivers;
