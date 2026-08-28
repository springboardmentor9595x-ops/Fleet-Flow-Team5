import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import maintenanceApi from "../api/maintenance";
import fleetApi from "../api/fleet";
import {
  Wrench, Fuel, Plus, RefreshCw, Search, Calendar,
  DollarSign, Truck, CheckCircle2, Clock, X, AlertTriangle,
  Bell, ShieldAlert, Check
} from "lucide-react";
import { toast } from "react-toastify";

const Maintenance = () => {
  const { user } = useAuth();
  const canLogMaintenance = ["Admin", "FleetManager"].includes(user?.role);
  const canLogFuel = ["Admin", "FleetManager", "Driver"].includes(user?.role);
  const canViewFuel = user?.role !== "Dispatcher";

  const [activeTab, setActiveTab] = useState("maintenance"); // "maintenance" | "fuel"
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [fuelRecords, setFuelRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [alertsData, setAlertsData] = useState({ total_alerts: 0, alerts: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);

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
    status: "Scheduled",
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
      const promises = [
        maintenanceApi.getMaintenance(),
        fleetApi.getVehicles(),
        maintenanceApi.getAlerts(),
      ];
      if (canViewFuel) {
        promises.push(maintenanceApi.getFuelLogs());
      }
      const results = await Promise.all(promises);
      setMaintenanceRecords(results[0] || []);
      setVehicles(results[1] || []);
      setAlertsData(results[2] || { total_alerts: 0, alerts: [], summary: {} });
      if (canViewFuel && results[3]) {
        setFuelRecords(results[3] || []);
      }
    } catch (err) {
      toast.error("Failed to load fleet maintenance data");
    } finally {
      setLoading(false);
    }
  }, [canViewFuel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMaintSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await maintenanceApi.addMaintenance({
        ...maintForm,
        vehicle_id: maintForm.vehicle_id || null,
        next_service_date: maintForm.next_service_date || null,
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
        vehicle_id: fuelForm.vehicle_id || null,
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

  const handleResolve = async (maintenanceId) => {
    setResolvingId(maintenanceId);
    try {
      await maintenanceApi.resolveMaintenance(maintenanceId);
      toast.success("Maintenance marked as Resolved! Alerts disabled.");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to resolve maintenance record.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleTriggerAlertScan = async () => {
    try {
      const res = await maintenanceApi.checkAlerts();
      toast.success(`Alert scan completed! ${res.triggered_count} notification(s) evaluated.`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to trigger alert check.");
    }
  };

  const totalMaintCost = maintenanceRecords.reduce((acc, r) => acc + (r.cost || 0), 0);
  const totalFuelCost = fuelRecords.reduce((acc, r) => acc + (r.fuel_cost || 0), 0);
  const totalFuelLiters = fuelRecords.reduce((acc, r) => acc + (r.fuel_amount || 0), 0);

  const getStatusBadge = (r) => {
    const isResolved = (r.status || "").toLowerCase() === "resolved";
    if (isResolved) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800,
          background: "rgba(5,150,105,0.12)", color: "#059669", border: "1px solid rgba(5,150,105,0.3)"
        }}>
          <CheckCircle2 size={13} /> Resolved (Ignored)
        </span>
      );
    }

    const targetDate = r.service_date || r.next_service_date;
    if (!targetDate) {
      return (
        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: "#F1F5F9", color: "#475569" }}>
          {r.status || "Scheduled"}
        </span>
      );
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const diffTime = new Date(targetDate) - new Date(todayStr);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800,
          background: "rgba(220,38,38,0.12)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.35)",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
        }}>
          <AlertTriangle size={13} /> Overdue by {Math.abs(diffDays)}d (Alerting)
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800,
          background: "rgba(220,38,38,0.12)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.35)"
        }}>
          <Clock size={13} /> Due Today (Alerting)
        </span>
      );
    } else if (diffDays === 1) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800,
          background: "rgba(234,88,12,0.12)", color: "#EA580C", border: "1px solid rgba(234,88,12,0.35)"
        }}>
          <Clock size={13} /> Due Tomorrow (1-Day Warning)
        </span>
      );
    } else if (diffDays <= 5) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800,
          background: "rgba(217,119,6,0.12)", color: "#D97706", border: "1px solid rgba(217,119,6,0.3)"
        }}>
          <Calendar size={13} /> Due in {diffDays}d (5-Day Warning)
        </span>
      );
    }

    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
        background: "rgba(13,148,136,0.08)", color: "#0D9488", border: "1px solid rgba(13,148,136,0.2)"
      }}>
        {r.status || "Scheduled"} (Due in {diffDays}d)
      </span>
    );
  };

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Fleet Maintenance & Fuel Logging
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            {user?.role === "Dispatcher"
              ? "Read-only maintenance monitoring for vehicle availability"
              : user?.role === "Driver"
              ? "Service alerts and fuel refill logging for your assigned vehicle"
              : "Track vehicle servicing, automated 5-day & 1-day alerts, and resolution workflow"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {canLogMaintenance && (
            <button onClick={handleTriggerAlertScan} style={{
              padding: "9px 14px", borderRadius: "10px",
              background: "#FFFFFF", border: "1px solid #CBD5E1",
              color: "#0F172A", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
            }}>
              <Bell size={14} color="#D97706" />
              Check Alerts
            </button>
          )}

          <button onClick={fetchData} style={{
            padding: "9px 14px", borderRadius: "10px",
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            fontSize: "12px", fontWeight: 600, boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
          }}>
            <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
            Refresh
          </button>

          {canLogFuel && (
            <button onClick={() => setShowFuelModal(true)} style={{
              padding: "9px 14px", borderRadius: "10px",
              background: "#F8FAFC", border: "1px solid #059669",
              color: "#059669", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 6px rgba(5,150,105,0.1)"
            }}>
              <Fuel size={14} />
              Log Fuel
            </button>
          )}

          {canLogMaintenance && (
            <button onClick={() => setShowMaintModal(true)} style={{
              padding: "9px 18px", borderRadius: "10px",
              background: "#0D9488", border: "none", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(13,148,136,0.25)"
            }}>
              <Wrench size={15} />
              Log Maintenance
            </button>
          )}
        </div>
      </div>

      {/* Active Maintenance Alerts Banner */}
      {alertsData.total_alerts > 0 && (
        <div style={{
          marginBottom: "20px", padding: "16px 20px", borderRadius: "14px",
          background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
          border: "1px solid #FDE68A",
          boxShadow: "0 4px 14px rgba(217,119,6,0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "#D97706", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(217,119,6,0.3)"
              }}>
                <ShieldAlert size={18} color="white" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#92400E" }}>
                  Active Maintenance Service Alerts ({alertsData.total_alerts})
                </h4>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#B45309" }}>
                  Trigger rules active: <strong>5-Day Warning</strong> | <strong>1-Day Warning</strong> | <strong>Continuous Due/Overdue Alerts until Resolved</strong>
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {alertsData.summary?.overdue_alerts > 0 && (
                <span style={{ background: "#DC2626", color: "white", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800 }}>
                  {alertsData.summary.overdue_alerts} Overdue
                </span>
              )}
              {alertsData.summary?.due_today_alerts > 0 && (
                <span style={{ background: "#EA580C", color: "white", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800 }}>
                  {alertsData.summary.due_today_alerts} Due Today
                </span>
              )}
              {alertsData.summary?.one_day_alerts > 0 && (
                <span style={{ background: "#D97706", color: "white", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800 }}>
                  {alertsData.summary.one_day_alerts} Due in 1 Day
                </span>
              )}
              {alertsData.summary?.five_day_alerts > 0 && (
                <span style={{ background: "#0D9488", color: "white", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800 }}>
                  {alertsData.summary.five_day_alerts} Due in 5 Days
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "10px" }}>
            {alertsData.alerts.map((al) => (
              <div key={al.maintenance_id} style={{
                background: "#FFFFFF", padding: "12px 14px", borderRadius: "10px",
                border: al.days_diff <= 0 ? "1px solid #FECACA" : al.days_diff === 1 ? "1px solid #FED7AA" : "1px solid #FDE68A",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                boxShadow: "0 2px 6px rgba(15,23,42,0.03)"
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{
                      fontWeight: 800, fontSize: "12px", fontFamily: "monospace",
                      color: al.days_diff <= 0 ? "#DC2626" : al.days_diff === 1 ? "#EA580C" : "#D97706"
                    }}>
                      {al.registration_number || "Vehicle"}
                    </span>
                    <span style={{
                      fontSize: "10px", fontWeight: 800, padding: "1px 6px", borderRadius: "6px",
                      background: al.days_diff <= 0 ? "rgba(220,38,38,0.1)" : al.days_diff === 1 ? "rgba(234,88,12,0.1)" : "rgba(217,119,6,0.1)",
                      color: al.days_diff <= 0 ? "#DC2626" : al.days_diff === 1 ? "#EA580C" : "#D97706",
                    }}>
                      {al.days_diff < 0 ? `${Math.abs(al.days_diff)}d Overdue` : al.days_diff === 0 ? "Due Today" : al.days_diff === 1 ? "1-Day Warning" : "5-Day Warning"}
                    </span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", fontWeight: 600, color: "#1E293B" }}>
                    {al.maintenance_type}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748B" }}>
                    Scheduled: <strong>{al.service_date}</strong>
                  </p>
                </div>

                {canLogMaintenance && (
                  <button
                    onClick={() => handleResolve(al.maintenance_id)}
                    disabled={resolvingId === al.maintenance_id}
                    style={{
                      padding: "6px 12px", borderRadius: "8px",
                      background: "linear-gradient(135deg, #059669, #047857)",
                      border: "none", color: "white", cursor: "pointer",
                      fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px",
                      boxShadow: "0 2px 6px rgba(5,150,105,0.25)",
                      opacity: resolvingId === al.maintenance_id ? 0.6 : 1,
                    }}
                  >
                    <CheckCircle2 size={13} />
                    {resolvingId === al.maintenance_id ? "Resolving..." : "Resolve"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${canViewFuel ? 4 : 2}, 1fr)`, gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>MAINTENANCE EXPENSE</span>
          <p style={{ color: "#0F172A", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>${totalMaintCost.toFixed(2)}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488", textTransform: "uppercase" }}>SERVICE RECORDS</span>
          <p style={{ color: "#0D9488", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{maintenanceRecords.length}</p>
        </div>
        {canViewFuel && (
          <>
            <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>TOTAL FUEL COST</span>
              <p style={{ color: "#059669", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>${totalFuelCost.toFixed(2)}</p>
            </div>
            <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5", textTransform: "uppercase" }}>FUEL VOLUME</span>
              <p style={{ color: "#4F46E5", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{totalFuelLiters.toFixed(1)} L</p>
            </div>
          </>
        )}
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
        {canViewFuel && (
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
        )}
      </div>

      {/* Tables */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
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
                  {["Vehicle", "Service Type", "Scheduled Date", "Cost", "Next Cycle", "Resolution Status", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maintenanceRecords.map((r) => {
                  const isResolved = (r.status || "").toLowerCase() === "resolved";
                  return (
                    <tr key={r.maintenance_id} style={{ borderBottom: "1px solid #E2E8F0", background: isResolved ? "#FFFFFF" : "#FFFDFB" }}>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: "13px", fontWeight: 800, color: "#0D9488" }}>
                        {r.registration_number || "Vehicle"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600 }}>
                        <div>{r.maintenance_type}</div>
                        {r.remarks && <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>{r.remarks}</div>}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "12px", color: "#334155", fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Calendar size={13} color="#64748B" />
                          {r.service_date}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
                        ${r.cost.toFixed(2)}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "12px", color: "#64748B" }}>
                        {r.next_service_date || "—"}
                      </td>
                      {/* Separate Column in Maintenance for Resolution Status & Alert Level */}
                      <td style={{ padding: "14px 16px" }}>
                        {getStatusBadge(r)}
                      </td>
                      {/* Separate Action Column to Resolve Record */}
                      <td style={{ padding: "14px 16px" }}>
                        {canLogMaintenance ? (
                          !isResolved ? (
                            <button
                              onClick={() => handleResolve(r.maintenance_id)}
                              disabled={resolvingId === r.maintenance_id}
                              style={{
                                padding: "6px 12px", borderRadius: "8px",
                                background: "linear-gradient(135deg, #059669, #047857)",
                                border: "none", color: "white", cursor: "pointer",
                                fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px",
                                boxShadow: "0 2px 6px rgba(5,150,105,0.25)",
                                opacity: resolvingId === r.maintenance_id ? 0.6 : 1,
                                transition: "all 0.15s ease",
                              }}
                            >
                              <CheckCircle2 size={13} />
                              {resolvingId === r.maintenance_id ? "Saving..." : "Mark Resolved"}
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <Check size={13} /> Completed
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94A3B8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", maxWidth: "460px", width: "100%", padding: "24px", color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Schedule / Log Service Maintenance</h3>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Service Date *</label>
                  <input
                    type="date"
                    required
                    value={maintForm.service_date}
                    onChange={(e) => setMaintForm({ ...maintForm, service_date: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Next Recurring Date</label>
                  <input
                    type="date"
                    value={maintForm.next_service_date}
                    onChange={(e) => setMaintForm({ ...maintForm, next_service_date: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Estimated Cost ($)</label>
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
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Initial Status</label>
                  <select
                    value={maintForm.status}
                    onChange={(e) => setMaintForm({ ...maintForm, status: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px" }}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Remarks / Notes</label>
                <textarea
                  rows="2"
                  placeholder="Optional details or instructions..."
                  value={maintForm.remarks}
                  onChange={(e) => setMaintForm({ ...maintForm, remarks: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "13px", boxSizing: "border-box", resize: "none" }}
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

