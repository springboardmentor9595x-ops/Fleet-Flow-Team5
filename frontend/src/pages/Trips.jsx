import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import tripsApi from "../api/trips";
import shipmentsApi from "../api/shipments";
import fleetApi from "../api/fleet";
import TripScheduleModal from "../components/TripScheduleModal";
import RouteOptimizationModal from "../components/RouteOptimizationModal";
import {
  Navigation, Plus, RefreshCw, MapPin, Play, CheckCircle2,
  Clock, ArrowRight, Truck, User, Zap, AlertTriangle
} from "lucide-react";
import { toast } from "react-toastify";

const ROUTE_TYPE_COLORS = {
  fastest: "#4F46E5",
  shortest: "#0D9488",
  traffic_avoidance: "#D97706",
  fuel_efficient: "#059669",
};

const Trips = () => {
  const { user } = useAuth();
  const canManage = ["Admin", "FleetManager", "Dispatcher"].includes(user?.role);

  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showOptimizerModal, setShowOptimizerModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tList, vList, dList, sData] = await Promise.all([
        tripsApi.list(),
        fleetApi.getVehicles(),
        fleetApi.getDrivers(),
        shipmentsApi.list(),
      ]);
      setTrips(tList || []);
      setVehicles(vList || []);
      setDrivers(dList || []);
      setShipments(sData.shipments || []);
    } catch (err) {
      toast.error("Failed to load trips directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartTrip = async (tripId) => {
    try {
      await tripsApi.start(tripId);
      toast.success("Trip started! Dynamic route optimization active.");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not start trip.");
    }
  };

  const handleEndTrip = async (tripId) => {
    try {
      await tripsApi.end(tripId);
      toast.success("Trip completed and shipment marked Delivered!");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not end trip.");
    }
  };

  const stats = {
    total: trips.length,
    scheduled: trips.filter((t) => t.status === "Scheduled").length,
    inProgress: trips.filter((t) => t.status === "In Progress").length,
    completed: trips.filter((t) => t.status === "Completed").length,
  };

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Trips & Route Optimization
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            Schedule dispatches, optimize routes, and manage trip lifecycles
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
              <button onClick={() => setShowOptimizerModal(true)} style={{
                padding: "9px 14px", borderRadius: "10px",
                background: "#F8FAFC", border: "1px solid #0D9488",
                color: "#0D9488", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 6px rgba(13,148,136,0.1)"
              }}>
                <Zap size={14} />
                Optimize Routes
              </button>

              <button onClick={() => setShowScheduleModal(true)} style={{
                padding: "9px 18px", borderRadius: "10px",
                background: "#0D9488", border: "none", color: "white", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 700,
                boxShadow: "0 4px 14px rgba(13,148,136,0.25)"
              }}>
                <Plus size={15} />
                Schedule Trip
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>TOTAL TRIPS</span>
          <p style={{ color: "#0F172A", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.total}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5", textTransform: "uppercase" }}>SCHEDULED</span>
          <p style={{ color: "#4F46E5", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.scheduled}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488", textTransform: "uppercase" }}>IN PROGRESS</span>
          <p style={{ color: "#0D9488", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.inProgress}</p>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(15,23,42,0.03)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>COMPLETED</span>
          <p style={{ color: "#059669", fontSize: "24px", fontWeight: 900, margin: "6px 0 0" }}>{stats.completed}</p>
        </div>
      </div>

      {/* Trips Table */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px" }} />
            <p style={{ margin: 0 }}>Loading trips...</p>
          </div>
        ) : trips.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
            <Navigation size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
            <p style={{ fontWeight: 700, margin: 0 }}>No trips scheduled.</p>
            <p style={{ fontSize: "12px", margin: "4px 0 0" }}>Schedule a new trip to optimize route dispatch.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                {["Route", "Vehicle", "Driver", "Strategy", "Distance", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const veh = vehicles.find((v) => v.vehicle_id === t.vehicle_id);
                const drv = drivers.find((d) => d.driver_id === t.driver_id);
                const routeColor = ROUTE_TYPE_COLORS[t.planned_route_type] || "#0D9488";

                return (
                  <tr key={t.trip_id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>{t.start_location}</span>
                        <ArrowRight size={12} color="#64748B" />
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>{t.destination}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, fontFamily: "monospace", color: "#0D9488" }}>
                      {veh ? veh.registration_number : "Vehicle"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                      {drv ? drv.driver_name : "Driver"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 800, textTransform: "capitalize", background: `${routeColor}15`, color: routeColor, border: `1px solid ${routeColor}40` }}>
                        {t.planned_route_type || "fastest"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569" }}>
                      {t.distance ? `${t.distance} km` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                        background: t.status === "Completed" ? "rgba(5,150,105,0.1)" : t.status === "In Progress" ? "rgba(13,148,136,0.1)" : "rgba(79,70,229,0.1)",
                        color: t.status === "Completed" ? "#059669" : t.status === "In Progress" ? "#0D9488" : "#4F46E5",
                        border: t.status === "Completed" ? "1px solid rgba(5,150,105,0.25)" : t.status === "In Progress" ? "1px solid rgba(13,148,136,0.25)" : "1px solid rgba(79,70,229,0.25)"
                      }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {t.status === "Scheduled" && (
                          <button
                            onClick={() => handleStartTrip(t.trip_id)}
                            style={{ padding: "6px 12px", borderRadius: "6px", background: "#0D9488", border: "none", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <Play size={11} /> Start
                          </button>
                        )}

                        {t.status === "In Progress" && (
                          <button
                            onClick={() => handleEndTrip(t.trip_id)}
                            style={{ padding: "6px 12px", borderRadius: "6px", background: "#059669", border: "none", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <CheckCircle2 size={11} /> Complete
                          </button>
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

      {/* Modals */}
      {showScheduleModal && (
        <TripScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onSuccess={fetchData}
          availableVehicles={vehicles}
          availableDrivers={drivers}
          availableShipments={shipments}
        />
      )}

      {showOptimizerModal && (
        <RouteOptimizationModal
          onClose={() => setShowOptimizerModal(false)}
          availableShipments={shipments}
        />
      )}
    </div>
  );
};

export default Trips;
