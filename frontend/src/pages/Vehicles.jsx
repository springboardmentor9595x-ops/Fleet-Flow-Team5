import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import fleetApi from "../api/fleet";
import {
  Truck, Plus, RefreshCw, Search, Edit2, Trash2, MapPin,
  CheckCircle2, AlertTriangle, Clock, X, ShieldCheck, Wrench
} from "lucide-react";
import { toast } from "react-toastify";

const STATUS_COLORS = {
  Available: { bg: "rgba(5,150,105,0.1)", color: "#059669", border: "rgba(5,150,105,0.25)" },
  "In Use": { bg: "rgba(13,148,136,0.1)", color: "#0D9488", border: "rgba(13,148,136,0.25)" },
  Maintenance: { bg: "rgba(220,38,38,0.1)", color: "#DC2626", border: "rgba(220,38,38,0.25)" },
};

const Vehicles = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = ["Admin", "FleetManager"].includes(user?.role);

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    registration_number: "",
    vehicle_type: "Heavy Truck",
    brand: "",
    model: "",
    manufacture_year: new Date().getFullYear(),
    fuel_type: "Diesel",
    capacity: 5000,
    assigned_driver: "",
    status: "Available",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vList, dList] = await Promise.all([
        fleetApi.getVehicles(),
        fleetApi.getDrivers(),
      ]);
      setVehicles(vList || []);
      setDrivers(dList || []);
    } catch (err) {
      toast.error("Failed to load fleet vehicles data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAddModal = () => {
    setEditingVehicle(null);
    setForm({
      registration_number: "",
      vehicle_type: "Heavy Truck",
      brand: "",
      model: "",
      manufacture_year: new Date().getFullYear(),
      fuel_type: "Diesel",
      capacity: 5000,
      assigned_driver: "",
      status: "Available",
    });
    setShowModal(true);
  };

  const openEditModal = (v) => {
    setEditingVehicle(v);
    setForm({
      registration_number: v.registration_number,
      vehicle_type: v.vehicle_type || "Heavy Truck",
      brand: v.brand || "",
      model: v.model || "",
      manufacture_year: v.manufacture_year || new Date().getFullYear(),
      fuel_type: v.fuel_type || "Diesel",
      capacity: v.capacity || 0,
      assigned_driver: v.assigned_driver || "",
      status: v.status || "Available",
    });
    setShowModal(true);
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`Are you sure you want to remove vehicle ${v.registration_number}?`)) return;
    try {
      await fleetApi.deleteVehicle(v.vehicle_id);
      toast.success(`Vehicle ${v.registration_number} deleted.`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not delete vehicle.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      capacity: parseInt(form.capacity, 10) || null,
      manufacture_year: parseInt(form.manufacture_year, 10) || null,
      assigned_driver: form.assigned_driver || null,
    };

    try {
      if (editingVehicle) {
        await fleetApi.updateVehicle(editingVehicle.vehicle_id, payload);
        toast.success(`Vehicle ${form.registration_number} updated.`);
      } else {
        await fleetApi.createVehicle(payload);
        toast.success(`Vehicle ${form.registration_number} added to fleet!`);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = vehicles.filter((v) => {
    const matchSearch =
      !search ||
      v.registration_number.toLowerCase().includes(search.toLowerCase()) ||
      (v.brand && v.brand.toLowerCase().includes(search.toLowerCase())) ||
      (v.model && v.model.toLowerCase().includes(search.toLowerCase())) ||
      (v.vehicle_type && v.vehicle_type.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "All" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === "Available").length,
    inUse: vehicles.filter((v) => v.status === "In Use").length,
    maintenance: vehicles.filter((v) => v.status === "Maintenance").length,
  };

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Fleet Vehicles Directory
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            Manage trucks, cargo vans, and fleet assets
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
              Add Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>TOTAL FLEET</span>
          <p style={{ color: "#0F172A", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.total}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>AVAILABLE</span>
          <p style={{ color: "#059669", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.available}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488", textTransform: "uppercase" }}>IN USE / ON ROUTE</span>
          <p style={{ color: "#0D9488", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.inUse}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#DC2626", textTransform: "uppercase" }}>MAINTENANCE</span>
          <p style={{ color: "#DC2626", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.maintenance}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748B" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search registration #, brand, model..."
            style={{
              width: "100%", padding: "9px 14px 9px 36px", background: "#FFFFFF",
              border: "1px solid #E2E8F0", borderRadius: "10px", color: "#0F172A",
              fontSize: "13px", outline: "none", boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {["All", "Available", "In Use", "Maintenance"].map((s) => (
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

      {/* Vehicle Table */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px" }} />
            <p style={{ margin: 0 }}>Loading vehicles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <Truck size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
            <p style={{ fontWeight: 700, margin: 0 }}>No vehicles found.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                {["Reg Number", "Type", "Make / Model", "Fuel / Cap", "Assigned Driver", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const driverObj = drivers.find((d) => d.driver_id === v.assigned_driver);
                const sStyle = STATUS_COLORS[v.status] || STATUS_COLORS.Available;
                return (
                  <tr key={v.vehicle_id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ color: "#0D9488", fontWeight: 800, fontFamily: "monospace", fontSize: "13px" }}>
                        {v.registration_number}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600 }}>{v.vehicle_type}</td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                      {v.brand || v.model ? `${v.brand || ""} ${v.model || ""}` : "—"} ({v.manufacture_year || "—"})
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                      {v.fuel_type || "Diesel"} · {v.capacity ? `${v.capacity} kg` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600 }}>
                      {driverObj ? driverObj.driver_name : "Unassigned"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: sStyle.bg, color: sStyle.color, border: `1px solid ${sStyle.border}` }}>
                        {v.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => navigate(`/tracking/${v.vehicle_id}`)}
                          title="Track Vehicle"
                          style={{ padding: "6px", borderRadius: "6px", background: "rgba(13,148,136,0.1)", border: "none", color: "#0D9488", cursor: "pointer" }}
                        >
                          <MapPin size={14} />
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEditModal(v)}
                              title="Edit Vehicle"
                              style={{ padding: "6px", borderRadius: "6px", background: "rgba(79,70,229,0.1)", border: "none", color: "#4F46E5", cursor: "pointer" }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(v)}
                              title="Delete Vehicle"
                              style={{ padding: "6px", borderRadius: "6px", background: "rgba(220,38,38,0.1)", border: "none", color: "#DC2626", cursor: "pointer" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", maxWidth: "500px", width: "100%", padding: "24px", color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                {editingVehicle ? "Edit Fleet Vehicle" : "Add New Fleet Vehicle"}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Registration Number *</label>
                <input
                  required
                  placeholder="e.g. TRK-1001"
                  value={form.registration_number}
                  onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Vehicle Type</label>
                <select
                  value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}
                >
                  <option value="Heavy Truck">Heavy Truck</option>
                  <option value="Cargo Van">Cargo Van</option>
                  <option value="Refrigerated Truck">Refrigerated Truck</option>
                  <option value="Dispatch Car">Dispatch Car</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}
                >
                  <option value="Available">Available</option>
                  <option value="In Use">In Use</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Brand / Make</label>
                <input
                  placeholder="e.g. Volvo / BharatBenz"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Model</label>
                <input
                  placeholder="e.g. FH16"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Capacity (kg)</label>
                <input
                  type="number"
                  placeholder="5000"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Assigned Driver</label>
                <select
                  value={form.assigned_driver}
                  onChange={(e) => setForm({ ...form, assigned_driver: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}
                >
                  <option value="">— Unassigned —</option>
                  {drivers.map((d) => (
                    <option key={d.driver_id} value={d.driver_id}>
                      {d.driver_name} ({d.license_number})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
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
                  {saving ? "Saving..." : editingVehicle ? "Update Vehicle" : "Add Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
