import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import shipmentsApi from "../api/shipments";
import ShipmentForm from "../components/ShipmentForm";
import DelayAlert from "../components/DelayAlert";
import RouteOptimizationModal from "../components/RouteOptimizationModal";
import {
  Package, Plus, RefreshCw, Search, Eye, Edit2, Trash2,
  ChevronRight, MapPin, ArrowRight, Truck, User, AlertTriangle,
  CheckCircle2, Clock, XCircle, BarChart3, Filter,
} from "lucide-react";
import { toast } from "react-toastify";

const STATUS_COLORS = {
  Created: { bg: "rgba(100,116,139,0.1)", color: "#475569", border: "rgba(100,116,139,0.25)" },
  Assigned: { bg: "rgba(13,148,136,0.1)", color: "#0D9488", border: "rgba(13,148,136,0.25)" },
  "In Transit": { bg: "rgba(79,70,229,0.1)", color: "#4F46E5", border: "rgba(79,70,229,0.25)" },
  Delayed: { bg: "rgba(220,38,38,0.1)", color: "#DC2626", border: "rgba(220,38,38,0.25)" },
  Delivered: { bg: "rgba(5,150,105,0.1)", color: "#059669", border: "rgba(5,150,105,0.25)" },
  Cancelled: { bg: "rgba(100,116,139,0.1)", color: "#64748B", border: "rgba(100,116,139,0.2)" },
};

const StatusBadge = ({ status }) => {
  const style = STATUS_COLORS[status] || STATUS_COLORS.Created;
  const icons = {
    Created: <Package size={10} />,
    Assigned: <User size={10} />,
    "In Transit": <Truck size={10} />,
    Delayed: <AlertTriangle size={10} />,
    Delivered: <CheckCircle2 size={10} />,
    Cancelled: <XCircle size={10} />,
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
      background: style.bg, color: style.color, border: `1px solid ${style.border}`,
    }}>
      {icons[status]}
      {status}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div style={{
    padding: "16px 20px", borderRadius: "14px",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 12px rgba(15,23,42,0.03)",
    display: "flex", alignItems: "center", gap: "14px",
  }}>
    <div style={{
      width: "40px", height: "40px", borderRadius: "10px",
      background: `${color}12`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Icon size={18} color={color} />
    </div>
    <div>
      <p style={{ color: "#475569", fontSize: "11px", fontWeight: 800, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <p style={{ color: "#0F172A", fontSize: "22px", fontWeight: 900, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: "#DC2626", fontSize: "10px", fontWeight: 700, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  </div>
);

const MANAGEMENT_ROLES = ["Admin", "FleetManager", "Dispatcher"];

const Shipments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = MANAGEMENT_ROLES.includes(user?.role);

  const [data, setData] = useState({ shipments: [], total: 0, delayed_count: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [editingShipment, setEditingShipment] = useState(null);
  const [delayDismissed, setDelayDismissed] = useState(false);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await shipmentsApi.list();
      setData(result);
    } catch (err) {
      toast.error("Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const handleCancel = async (shipment) => {
    if (!window.confirm(`Cancel shipment ${shipment.tracking_number}?`)) return;
    try {
      await shipmentsApi.cancel(shipment.shipment_id);
      toast.success("Shipment cancelled");
      fetchShipments();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to cancel shipment");
    }
  };

  const filtered = data.shipments.filter((s) => {
    const matchSearch =
      !search ||
      s.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
      s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.source.toLowerCase().includes(search.toLowerCase()) ||
      s.destination.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const delayedShipments = data.shipments.filter((s) => s.status === "Delayed" || s.is_delayed);

  const stats = {
    total: data.total,
    inTransit: data.shipments.filter((s) => s.status === "In Transit").length,
    delayed: data.delayed_count,
    delivered: data.shipments.filter((s) => s.status === "Delivered").length,
  };

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Shipments Directory
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            {user?.role === "Driver" ? "Your assigned shipments" : "Manage and track all fleet shipments"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={fetchShipments} style={{
            padding: "9px 14px", borderRadius: "10px",
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            fontSize: "12px", fontWeight: 600, boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
          }}>
            <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
            Refresh
          </button>
          
          {canManage && (
            <button onClick={() => setShowOptimizer(true)} style={{
              padding: "9px 14px", borderRadius: "10px",
              background: "#F8FAFC", border: "1px solid #0D9488",
              color: "#0D9488", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 6px rgba(13,148,136,0.1)"
            }}>
              <MapPin size={13} />
              Optimize Routes
            </button>
          )}

          {canManage && (
            <button onClick={() => { setEditingShipment(null); setShowForm(true); }} style={{
              padding: "9px 18px", borderRadius: "10px",
              background: "#0D9488",
              border: "none", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "7px",
              fontSize: "13px", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(13,148,136,0.25)",
            }}>
              <Plus size={15} />
              New Shipment
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
        <StatCard label="Total" value={stats.total} icon={Package} color="#4F46E5" />
        <StatCard label="In Transit" value={stats.inTransit} icon={Truck} color="#0D9488" />
        <StatCard label="Delayed" value={stats.delayed} icon={AlertTriangle} color="#DC2626" sub="Requires Attention" />
        <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} color="#059669" />
      </div>

      {/* Delay Alert Banner */}
      {!delayDismissed && delayedShipments.length > 0 && (
        <DelayAlert
          delayedShipments={delayedShipments}
          onDismiss={() => setDelayDismissed(true)}
          onRefresh={fetchShipments}
        />
      )}

      {/* Filters */}
      <div style={{
        display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px",
        flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: "200px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748B" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracking #, customer, route..."
            style={{
              width: "100%", padding: "9px 14px 9px 36px",
              background: "#FFFFFF", border: "1px solid #E2E8F0",
              borderRadius: "10px", color: "#0F172A", fontSize: "13px",
              outline: "none", boxSizing: "border-box", boxShadow: "0 2px 6px rgba(15,23,42,0.02)"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["All", "Created", "Assigned", "In Transit", "Delayed", "Delivered", "Cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s",
                background: statusFilter === s ? "#0D9488" : "#FFFFFF",
                border: statusFilter === s ? "1px solid #0D9488" : "1px solid #E2E8F0",
                color: statusFilter === s ? "#FFFFFF" : "#475569",
                boxShadow: statusFilter === s ? "0 2px 8px rgba(13,148,136,0.2)" : "none"
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 4px 14px rgba(15,23,42,0.03)"
      }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#475569" }}>
            <RefreshCw size={24} style={{ animation: "spin 0.8s linear infinite", marginBottom: "12px" }} />
            <p style={{ margin: 0 }}>Loading shipments...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#475569" }}>
            <Package size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#0F172A", fontSize: "15px" }}>
              No shipments found
            </p>
            <p style={{ margin: 0, fontSize: "12px" }}>
              {canManage ? "Create a new shipment to get started." : "You have no assigned shipments yet."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                {["Tracking #", "Route", "Customer", "Weight", "ETA / Arrival", "Status", "Actions"].map((h) => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left",
                    fontSize: "10px", fontWeight: 800, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.shipment_id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #E2E8F0" : "none",
                    transition: "background 0.12s",
                    cursor: "pointer",
                    background: s.status === "Delayed" || s.is_delayed
                      ? "rgba(220,38,38,0.02)"
                      : "#FFFFFF",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(13,148,136,0.03)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = s.status === "Delayed" || s.is_delayed ? "rgba(220,38,38,0.02)" : "#FFFFFF"}
                >
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {(s.status === "Delayed" || s.is_delayed) && <AlertTriangle size={12} color="#DC2626" />}
                      <span style={{ color: "#0D9488", fontWeight: 800, fontSize: "12px", fontFamily: "monospace" }}>
                        {s.tracking_number}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#0F172A", fontSize: "12px", fontWeight: 600 }}>{s.source}</span>
                      <ArrowRight size={12} color="#64748B" style={{ flexShrink: 0 }} />
                      <span style={{ color: "#0F172A", fontSize: "12px", fontWeight: 600 }}>{s.destination}</span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <p style={{ color: "#0F172A", fontSize: "12px", margin: 0, fontWeight: 700 }}>{s.customer_name}</p>
                    {s.customer_phone && (
                      <p style={{ color: "#64748B", fontSize: "10px", margin: "2px 0 0" }}>{s.customer_phone}</p>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ color: "#475569", fontSize: "12px", fontWeight: 600 }}>
                      {s.shipment_weight ? `${s.shipment_weight} kg` : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {s.status === "Delivered" ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669" }}>Delivered</span>
                    ) : s.status === "Cancelled" ? (
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>Cancelled</span>
                    ) : s.estimated_arrival ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Clock size={11} color={s.is_delayed ? "#DC2626" : "#0D9488"} />
                          <span style={{ fontSize: "12px", fontWeight: 700, color: s.is_delayed ? "#DC2626" : "#0F172A" }}>
                            {s.estimated_arrival}
                          </span>
                        </div>
                        <span style={{ fontSize: "10px", color: s.is_delayed ? "#DC2626" : "#64748B", marginTop: "2px", display: "block" }}>
                          {s.remaining_distance_km ? `${s.remaining_distance_km} km · ` : ""}{s.eta_status || "In transit"}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>Calculating...</span>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => navigate(`/shipments/${s.shipment_id}`)}
                        title="View Details"
                        style={{
                          padding: "6px", borderRadius: "7px",
                          background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.2)",
                          color: "#0D9488", cursor: "pointer",
                        }}
                      >
                        <Eye size={13} />
                      </button>
                      {canManage && s.status !== "Delivered" && s.status !== "Cancelled" && (
                        <>
                          <button
                            onClick={() => { setEditingShipment(s); setShowForm(true); }}
                            title="Edit"
                            style={{
                              padding: "6px", borderRadius: "7px",
                              background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)",
                              color: "#4F46E5", cursor: "pointer",
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleCancel(s)}
                            title="Cancel Shipment"
                            style={{
                              padding: "6px", borderRadius: "7px",
                              background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)",
                              color: "#DC2626", cursor: "pointer",
                            }}
                          >
                            <XCircle size={13} />
                          </button>
                        </>
                      )}
                      {s.vehicle_id && (
                        <button
                          onClick={() => navigate(`/tracking/${s.vehicle_id}`)}
                          title="Live Track"
                          style={{
                            padding: "6px", borderRadius: "7px",
                            background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)",
                            color: "#059669", cursor: "pointer",
                          }}
                        >
                          <MapPin size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ShipmentForm
          editData={editingShipment}
          onClose={() => { setShowForm(false); setEditingShipment(null); }}
          onSuccess={fetchShipments}
        />
      )}

      {showOptimizer && (
        <RouteOptimizationModal
          onClose={() => setShowOptimizer(false)}
          availableShipments={data.shipments.filter(s => ["Created", "Assigned", "In Transit"].includes(s.status))}
        />
      )}
    </div>
  );
};

export default Shipments;
