import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import dashboardApi from "../api/dashboard";
import EmailLogsModal from "../components/EmailLogsModal";
import NotificationBell from "../components/NotificationBell";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import {
  Truck, Package, Users, Wrench, Fuel, MapPin, Navigation, ShieldCheck,
  UserCheck, Mail, UserPlus, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, BarChart2, Layers, X
} from "lucide-react";

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

  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

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
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add user.");
    } finally {
      setAddUserLoading(false);
    }
  };

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
    </div>
  );
};

export default Dashboard;
