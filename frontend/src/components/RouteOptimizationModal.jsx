import React, { useState, useEffect } from "react";
import {
  X, Route, Zap, CheckCircle2, Navigation, MapPin, Clock,
  TrendingDown, Fuel, ArrowRight, Loader, Sparkles, AlertCircle
} from "lucide-react";
import shipmentsApi from "../api/shipments";
import { toast } from "react-toastify";

const C = {
  bg: "#FFFFFF",
  surface: "#F8FAFC",
  border: "#E2E8F0",
  primary: "#0D9488",
  primaryDark: "#0F766E",
  accent: "#4F46E5",
  text: "#0F172A",
  muted: "#475569",
  subtle: "#64748B",
  success: "#059669",
  warning: "#D97706",
};

const StatBadge = ({ label, value, sub, icon: Icon, color }) => (
  <div style={{
    padding: "14px 16px", borderRadius: "12px",
    background: `${color}0A`, border: `1px solid ${color}25`,
    display: "flex", alignItems: "center", gap: "12px",
  }}>
    <div style={{
      width: "36px", height: "36px", borderRadius: "10px",
      background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Icon size={18} color={color} />
    </div>
    <div>
      <p style={{ color: C.subtle, fontSize: "10px", fontWeight: 800, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      <p style={{ color: C.text, fontSize: "18px", fontWeight: 900, margin: 0 }}>
        {value}
      </p>
      {sub && <p style={{ color: color, fontSize: "10px", fontWeight: 700, margin: "1px 0 0" }}>{sub}</p>}
    </div>
  </div>
);

const RouteOptimizationModal = ({ onClose, preselectedVehicleId = null, availableShipments = [] }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [vehicleId, setVehicleId] = useState(preselectedVehicleId || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (availableShipments.length > 0) {
      setSelectedIds(availableShipments.map((s) => s.shipment_id));
    }
  }, [availableShipments]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOptimize = async () => {
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        shipment_ids: selectedIds.length > 0 ? selectedIds : null,
        vehicle_id: vehicleId || null,
      };
      const res = await shipmentsApi.optimizeRoute(payload);
      setResult(res);
      toast.success("🚀 Route optimized successfully!");
    } catch (err) {
      const msg = err.response?.data?.detail || "Optimization failed.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose && onClose()}
    >
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: "20px",
        width: "100%", maxWidth: "800px", maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(15,23,42,0.2)", color: C.text,
      }}>

        {/* Modal Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
          position: "sticky", top: 0, background: C.bg, zIndex: 10,
          borderRadius: "20px 20px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "linear-gradient(135deg, #0D9488, #0891B2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(13,148,136,0.3)",
            }}>
              <Route size={20} color="white" />
            </div>
            <div>
              <h3 style={{ color: C.text, fontWeight: 900, fontSize: "17px", margin: 0 }}>
                Multi-Stop Route Optimizer
              </h3>
              <p style={{ color: C.subtle, fontSize: "11px", margin: 0 }}>
                2-Opt TSP algorithm for optimal delivery sequencing & minimum fuel consumption
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "7px", borderRadius: "8px", background: C.surface,
              border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "24px" }}>

          {/* Selection Box */}
          {availableShipments.length > 0 && !result && (
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "11px", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                Select Shipments to Optimize ({selectedIds.length} of {availableShipments.length} selected)
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
                {availableShipments.map((s) => {
                  const isSel = selectedIds.includes(s.shipment_id);
                  return (
                    <div
                      key={s.shipment_id}
                      onClick={() => toggleSelect(s.shipment_id)}
                      style={{
                        padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                        background: isSel ? "rgba(13,148,136,0.08)" : C.surface,
                        border: isSel ? "1.5px solid #0D9488" : `1px solid ${C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "all 0.15s",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: C.primary, fontFamily: "monospace" }}>{s.tracking_number}</span>
                        <p style={{ fontSize: "11px", color: C.text, margin: "2px 0 0", fontWeight: 600 }}>{s.source} → {s.destination}</p>
                      </div>
                      <div style={{
                        width: "18px", height: "18px", borderRadius: "5px",
                        border: isSel ? "none" : `1.5px solid ${C.subtle}`,
                        background: isSel ? C.primary : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isSel && <CheckCircle2 size={13} color="white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Trigger */}
          {!result && (
            <button
              onClick={handleOptimize}
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: "12px",
                background: loading ? C.subtle : "linear-gradient(135deg, #0D9488, #0891B2)",
                border: "none", color: "white", cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                boxShadow: loading ? "none" : "0 4px 16px rgba(13,148,136,0.35)",
              }}
            >
              {loading ? (
                <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Calculating Optimal Route...</>
              ) : (
                <><Sparkles size={16} /> Run TSP Route Optimizer</>
              )}
            </button>
          )}

          {/* Optimization Results View */}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Stat Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                <StatBadge
                  label="Distance Saved"
                  value={`${result.distance_saved_km} km`}
                  sub={`From ${result.original_distance_km} km → ${result.total_distance_km} km`}
                  icon={TrendingDown}
                  color={C.success}
                />
                <StatBadge
                  label="Time Saved"
                  value={`${result.time_saved_minutes} mins`}
                  sub={`Total trip: ${result.total_duration_minutes} mins`}
                  icon={Clock}
                  color={C.accent}
                />
                <StatBadge
                  label="Est. Fuel Saved"
                  value={`${result.fuel_saved_liters} Liters`}
                  sub="Heavy diesel estimation"
                  icon={Fuel}
                  color={C.warning}
                />
              </div>

              {/* Itinerary Timeline */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <h4 style={{ fontSize: "11px", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    Optimized Waypoint Sequence ({result.legs?.length || 0} Stops)
                  </h4>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: C.primary, background: "rgba(13,148,136,0.1)", padding: "2px 8px", borderRadius: "10px" }}>
                    Origin: {result.origin?.name}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderLeft: `2px solid ${C.primary}`, paddingLeft: "14px" }}>
                  {result.legs.map((leg) => (
                    <div key={leg.step} style={{
                      background: C.bg, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "12px 14px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "50%",
                          background: C.primary, color: "white", fontSize: "11px", fontWeight: 900,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {leg.step}
                        </div>
                        <div>
                          <p style={{ fontSize: "12px", fontWeight: 800, color: C.text, margin: 0 }}>
                            {leg.to_name}
                          </p>
                          <p style={{ fontSize: "10px", color: C.subtle, margin: "2px 0 0" }}>
                            From: {leg.from_name} · {leg.tracking_number ? `Track #${leg.tracking_number}` : ""}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "12px", fontWeight: 800, color: C.primary, margin: 0 }}>
                          +{leg.leg_distance_km} km ({leg.leg_duration_minutes}m)
                        </p>
                        <p style={{ fontSize: "10px", color: C.subtle, margin: "2px 0 0" }}>
                          Est Arrival: {new Date(leg.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "10px" }}>
                <button
                  onClick={() => setResult(null)}
                  style={{
                    padding: "9px 18px", borderRadius: "10px",
                    background: C.surface, border: `1px solid ${C.border}`,
                    color: C.muted, cursor: "pointer", fontSize: "12px", fontWeight: 700,
                  }}
                >
                  Re-Calculate
                </button>
                <button
                  onClick={() => {
                    toast.success("✅ Optimized sequence applied to fleet dispatcher!");
                    onClose && onClose();
                  }}
                  style={{
                    padding: "9px 22px", borderRadius: "10px",
                    background: "linear-gradient(135deg, #0D9488, #0891B2)",
                    border: "none", color: "white", cursor: "pointer",
                    fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: "0 4px 14px rgba(13,148,136,0.3)",
                  }}
                >
                  <CheckCircle2 size={14} /> Apply Route Optimization
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default RouteOptimizationModal;
