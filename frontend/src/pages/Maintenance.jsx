import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import maintenanceApi from "../api/maintenance";
import fleetApi from "../api/fleet";
import {
  Wrench, Fuel, Plus, RefreshCw, Search, Calendar,
  DollarSign, Truck, CheckCircle2, Clock, X
} from "lucide-react";
import { toast } from "react-toastify";

const Maintenance = () => {
  const { user } = useAuth();
  const canManage = ["Admin", "FleetManager"].includes(user?.role);

  const [activeTab, setActiveTab] = useState("maintenance"); // "maintenance" | "fuel"
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [fuelRecords, setFuelRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showMaintModal, setShowMaintModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [maintForm, setMaintForm] = useState({
    vehicle_id: "",
    maintenance_type: "Oil & Filter Service",
    service_date: new Date().toISOString().slice(0, 10),
    next_service_date: "",
    cost: 150,
    remarks: "",
    status: "Completed",
  });

  const [fuelForm, setFuelForm] = useState({
    vehicle_id: "",
    fuel_amount: 45.0,
    fuel_cost: 160.0,
    mileage: 12500,
    refill_date: new Date().toISOString().slice(0, 10),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mList, fList, vList] = await Promise.all([
        maintenanceApi.getMaintenance(),
        maintenanceApi.getFuelLogs(),
        fleetApi.getVehicles(),
      ]);
      setMaintenanceRecords(mList || []);
      setFuelRecords(fList || []);
      setVehicles(vList || []);
    } catch (err) {
      toast.error("Failed to load fleet maintenance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMaintSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await maintenanceApi.addMaintenance({
        ...maintForm,
        cost: parseFloat(maintForm.cost) || 0,
      });
      toast.success("Maintenance service logged!");
      setShowMaintModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add maintenance record.");
    } finally {
      setSaving(false);
    }
  };

  const handleFuelSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await maintenanceApi.addFuelLog({
        ...fuelForm,
        fuel_amount: parseFloat(fuelForm.fuel_amount) || 0,
        fuel_cost: parseFloat(fuelForm.fuel_cost) || 0,
        mileage: parseFloat(fuelForm.mileage) || 0,
      });
      toast.success("Fuel refill logged!");
      setShowFuelModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add fuel record.");
    } finally {
      setSaving(false);
    }
  };

  const totalMaintCost = maintenanceRecords.reduce((acc, r) => acc + (r.cost || 0), 0);
  const totalFuelCost = fuelRecords.reduce((acc, r) => acc + (r.fuel_cost || 0), 0);
  const totalFuelLiters = fuelRecords.reduce((acc, r) => acc + (r.fuel_amount || 0), 0);

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Fleet Maintenance & Fuel Logging
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            Track vehicle servicing, oil changes, repair costs, and fuel economy
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
            <>
              <button onClick={() => setShowFuelModal(true)} style={{
                padding: "9px 14px", borderRadius: "10px",
                background: "#F8FAFC", border: "1px solid #059669",
                color: "#059669", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 6px rgba(5,150,105,0.1)"
              }}>
                <Fuel size={14} />
                Log Fuel
              </button>

              <button onClick={() => setShowMaintModal(true)} style={{
                padding: "9px 18px", borderRadius: "10px",
                background: "#0D9488", border: "none", color: "white", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 700,
                boxShadow: "0 4px 14px rgba(13,148,136,0.25)"
              }}>
                <Wrench size={15} />
                Log Maintenance
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>MAINTENANCE EXPENSE</span>
          <p style={{ color: "#0F172A", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>${totalMaintCost.toFixed(2)}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488", textTransform: "uppercase" }}>SERVICE RECORDS</span>
          <p style={{ color: "#0D9488", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{maintenanceRecords.length}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>TOTAL FUEL COST</span>
          <p style={{ color: "#059669", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>${totalFuelCost.toFixed(2)}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5", textTransform: "uppercase" }}>FUEL VOLUME</span>
          <p style={{ color: "#4F46E5", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{totalFuelLiters.toFixed(1)} L</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <button
          onClick={() => setActiveTab("maintenance")}
          style={{
            padding: "9px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            background: activeTab === "maintenance" ? "#0D9488" : "#FFFFFF",
            color: activeTab === "maintenance" ? "#FFFFFF" : "#475569",
            border: activeTab === "maintenance" ? "1px solid #0D9488" : "1px solid #E2E8F0"
          }}
        >
          <Wrench size={14} /> Service Records ({maintenanceRecords.length})
        </button>
        <button
          onClick={() => setActiveTab("fuel")}
          style={{
            padding: "9px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            background: activeTab === "fuel" ? "#059669" : "#FFFFFF",
            color: activeTab === "fuel" ? "#FFFFFF" : "#475569",
            border: activeTab === "fuel" ? "1px solid #059669" : "1px solid #E2E8F0"
          }}
        >
          <Fuel size={14} /> Fuel Logs ({fuelRecords.length})
        </button>
      </div>

      {/* Tables */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px" }} />
            <p style={{ margin: 0 }}>Loading logs...</p>
          </div>
        ) : activeTab === "maintenance" ? (
          maintenanceRecords.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
              <Wrench size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
              <p style={{ fontWeight: 700, margin: 0 }}>No maintenance logs recorded.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                  {["Vehicle", "Service Type", "Date", "Cost", "Next Service", "Status"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maintenanceRecords.map((r) => (
                  <tr key={r.maintenance_id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px", fontWeight: 800, color: "#0D9488" }}>
                      {r.registration_number || "Vehicle"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600 }}>{r.maintenance_type}</td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>{r.service_date}</td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>${r.cost.toFixed(2)}</td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>{r.next_service_date || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: "rgba(5,150,105,0.1)", color: "#059669", border: "1px solid rgba(5,150,105,0.25)" }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : fuelRecords.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <Fuel size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
            <p style={{ fontWeight: 700, margin: 0 }}>No fuel refill logs recorded.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                {["Vehicle", "Refill Date", "Volume (L)", "Total Cost", "Odometer / Mileage"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fuelRecords.map((r) => (
                <tr key={r.fuel_id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px", fontWeight: 800, color: "#059669" }}>
                    {r.registration_number || "Vehicle"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>{r.refill_date}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700 }}>{r.fuel_amount.toFixed(1)} L</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>${r.fuel_cost.toFixed(2)}</td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>{r.mileage} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Maintenance Modal */}
      {showMaintModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", maxWidth: "440px", width: "100%", padding: "24px", color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Log Service Maintenance</h3>
              <button onClick={() => setShowMaintModal(false)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}><X size={18} /></button>
            </div>

            <form onSubmit={handleMaintSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Select Vehicle *</label>
                <select
                  required
                  value={maintForm.vehicle_id}
                  onChange={(e) => setMaintForm({ ...maintForm, vehicle_id: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}
                >
                  <option value="">— Select Vehicle —</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.vehicle_type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Service / Maintenance Type</label>
                <input
                  required
                  placeholder="e.g. Engine Oil & Filter Service"
                  value={maintForm.maintenance_type}
                  onChange={(e) => setMaintForm({ ...maintForm, maintenance_type: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Service Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={maintForm.cost}
                  onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Service Date</label>
                <input
                  type="date"
                  required
                  value={maintForm.service_date}
                  onChange={(e) => setMaintForm({ ...maintForm, service_date: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowMaintModal(false)} style={{ padding: "9px 16px", borderRadius: "8px", background: "transparent", border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "9px 20px", borderRadius: "8px", background: "#0D9488", border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>{saving ? "Saving..." : "Save Record"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Fuel Modal */}
      {showFuelModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", maxWidth: "440px", width: "100%", padding: "24px", color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Log Fuel Refill</h3>
              <button onClick={() => setShowFuelModal(false)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}><X size={18} /></button>
            </div>

            <form onSubmit={handleFuelSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Select Vehicle *</label>
                <select
                  required
                  value={fuelForm.vehicle_id}
                  onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}
                >
                  <option value="">— Select Vehicle —</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.vehicle_type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Fuel Volume (Liters)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={fuelForm.fuel_amount}
                  onChange={(e) => setFuelForm({ ...fuelForm, fuel_amount: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Total Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fuelForm.fuel_cost}
                  onChange={(e) => setFuelForm({ ...fuelForm, fuel_cost: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Odometer (km)</label>
                <input
                  type="number"
                  required
                  value={fuelForm.mileage}
                  onChange={(e) => setFuelForm({ ...fuelForm, mileage: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowFuelModal(false)} style={{ padding: "9px 16px", borderRadius: "8px", background: "transparent", border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "9px 20px", borderRadius: "8px", background: "#059669", border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>{saving ? "Saving..." : "Log Fuel"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
