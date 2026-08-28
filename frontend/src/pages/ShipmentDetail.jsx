import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import shipmentsApi from "../api/shipments";
import fleetApi from "../api/fleet";
import DeliveryProgressStepper from "../components/DeliveryProgressStepper";
import TripScheduleModal from "../components/TripScheduleModal";
import {
  ArrowLeft, Package, MapPin, Truck, User, Calendar,
  CheckCircle2, AlertTriangle, FileText, Phone, Weight, History,
  ChevronRight, Activity, Route
} from "lucide-react";
import { toast } from "react-toastify";

const NEXT_STATUS_MAP = {
  Created:    [{ target: "Assigned",   label: "Assign Vehicle & Driver", color: "#0D9488" }, { target: "Cancelled", label: "Cancel Shipment", color: "#DC2626" }],
  Assigned:   [{ target: "In Transit", label: "Start Transit",           color: "#4F46E5" }, { target: "Cancelled", label: "Cancel Shipment", color: "#DC2626" }],
  "In Transit": [
    { target: "Delivered", label: "Mark as Delivered", color: "#059669" },
    { target: "Delayed",   label: "Flag as Delayed",   color: "#D97706" },
    { target: "Cancelled", label: "Cancel Shipment",   color: "#DC2626" },
  ],
  Delayed: [
    { target: "In Transit", label: "Resume Transit",      color: "#4F46E5" },
    { target: "Delivered",  label: "Mark as Delivered",   color: "#059669" },
    { target: "Cancelled",  label: "Cancel Shipment",     color: "#DC2626" },
  ],
  Delivered: [], Cancelled: [],
};

const STATUS_COLORS = {
  Created:    "#64748B", Assigned:   "#0D9488", "In Transit": "#4F46E5",
  Delivered:  "#059669", Delayed:    "#D97706", Cancelled:    "#DC2626",
};

const InfoRow = ({ label, icon: Icon, iconColor, children }) => (
  <div>
    <p style={{ color: "#475569", fontSize: "11px", fontWeight: 800, margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {Icon && <Icon size={15} color={iconColor} />}
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>{children}</div>
    </div>
  </div>
);

const MANAGEMENT_ROLES = ["Admin", "FleetManager", "Dispatcher"];

const ShipmentDetail = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const canManage = MANAGEMENT_ROLES.includes(user?.role);

  const [shipment,    setShipment]    = useState(null);
  const [history,     setHistory]     = useState([]);
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [driverInfo,  setDriverInfo]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [updating,    setUpdating]    = useState(false);
  const [statusNote,  setStatusNote]  = useState("");
  const [showTripModal, setShowTripModal] = useState(false);

  const [etaInfo, setEtaInfo] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, hData, etaRes] = await Promise.all([
        shipmentsApi.get(id),
        shipmentsApi.getHistory(id),
        shipmentsApi.getETA(id).catch(() => null),
      ]);
      setShipment(sData);
      setHistory(hData);
      setEtaInfo(etaRes);

      // Resolve human-readable vehicle + driver names in parallel
      const [vInfo, dInfo] = await Promise.all([
        sData.vehicle_id ? fleetApi.getVehicle(sData.vehicle_id).catch(() => null) : Promise.resolve(null),
        sData.driver_id  ? fleetApi.getDriver(sData.driver_id).catch(() => null)   : Promise.resolve(null),
      ]);
      setVehicleInfo(vInfo);
      setDriverInfo(dInfo);
    } catch {
      toast.error("Failed to load shipment details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (targetStatus) => {
    if (!window.confirm(`Set status to "${targetStatus}"?`)) return;
    setUpdating(true);
    try {
      await shipmentsApi.updateStatus(id, targetStatus, statusNote);
      toast.success(`Status updated to ${targetStatus}`);
      setStatusNote("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Status update failed.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#475569" }}>
        <Package size={32} style={{ color: "#0D9488", animation: "spin 1.2s linear infinite" }} />
        <p style={{ marginTop: "14px", fontSize: "14px", fontWeight: 600 }}>Loading shipment details...</p>
      </div>
    </div>
  );

  if (!shipment) return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "40px", color: "#0F172A" }}>
      <button onClick={() => navigate("/shipments")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#0D9488", cursor: "pointer", fontWeight: 700 }}>
        <ArrowLeft size={16} /> Back to Shipments
      </button>
      <div style={{ marginTop: "40px", textAlign: "center" }}><h2>Shipment Not Found</h2></div>
    </div>
  );

  const nextActions   = NEXT_STATUS_MAP[shipment.status] || [];
  const statusColor   = STATUS_COLORS[shipment.status] || "#64748B";
  const isInTransit   = shipment.status === "In Transit";

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/shipments")}
            style={{ padding: "8px 14px", borderRadius: "10px", background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 6px rgba(15,23,42,0.04)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{ color: "#0F172A", fontWeight: 900, fontSize: "20px", margin: 0, fontFamily: "monospace" }}>
                {shipment.tracking_number}
              </h1>
              {/* Status badge */}
              <span style={{
                padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800,
                background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}35`,
                display: "flex", alignItems: "center", gap: "5px",
              }}>
                {isInTransit && (
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: "#4F46E5", display: "inline-block",
                    animation: "liveBlip 1.4s ease-in-out infinite",
                  }} />
                )}
                {shipment.status}
              </span>
              {(shipment.is_delayed || etaInfo?.is_delayed) && (
                <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, background: "rgba(220,38,38,0.1)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.25)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <AlertTriangle size={11} /> {etaInfo?.delay_status || "Delayed"}
                </span>
              )}
            </div>
            <p style={{ color: "#475569", fontSize: "12px", margin: "3px 0 0" }}>
              Created {new Date(shipment.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {canManage && !(["Delivered", "Cancelled"].includes(shipment?.status)) && (
            <button
              onClick={() => setShowTripModal(true)}
              style={{ padding: "10px 18px", borderRadius: "10px", background: "linear-gradient(135deg, #4F46E5, #7C3AED)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 700, boxShadow: "0 4px 14px rgba(79,70,229,0.3)" }}
            >
              <Route size={15} /> Schedule Trip
            </button>
          )}
          {shipment.vehicle_id && (
            <button
              onClick={() => navigate(`/tracking/${shipment.vehicle_id}`)}
              style={{ padding: "10px 18px", borderRadius: "10px", background: "linear-gradient(135deg, #0D9488, #0891B2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 700, boxShadow: "0 4px 14px rgba(13,148,136,0.3)" }}
            >
              <MapPin size={15} /> Live GPS Map
            </button>
          )}
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Progress Card */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(15,23,42,0.04)" }}>
            <h3 style={{ fontSize: "11px", fontWeight: 800, color: "#475569", margin: "0 0 20px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Delivery Progression</h3>
            <DeliveryProgressStepper status={shipment.status} />
          </div>

          {/* Dynamic ETA & Route Telemetry Card */}
          {shipment.status !== "Cancelled" && (
            <div style={{
              background: "linear-gradient(135deg, #FFFFFF, #F8FAFC)",
              border: "1.5px solid #E2E8F0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(13,148,136,0.1)", color: "#0D9488" }}>
                    <Activity size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "13px", fontWeight: 900, color: "#0F172A", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Dynamic ETA & Route Telemetry
                    </h3>
                    <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>
                      Calculated from real-time speed, live road traffic & GPS coordinates
                    </p>
                  </div>
                </div>

                <span style={{
                  padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800,
                  background: (etaInfo?.is_delayed || shipment.is_delayed) ? "rgba(220,38,38,0.1)" : "rgba(5,150,105,0.1)",
                  color: (etaInfo?.is_delayed || shipment.is_delayed) ? "#DC2626" : "#059669",
                  border: (etaInfo?.is_delayed || shipment.is_delayed) ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(5,150,105,0.25)"
                }}>
                  {etaInfo?.delay_status || (shipment.status === "Delivered" ? "Delivered" : "On Schedule")}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Estimated Arrival</span>
                  <p style={{ fontSize: "16px", fontWeight: 900, color: "#0D9488", margin: "4px 0 0" }}>
                    {shipment.status === "Delivered" ? "Delivered" : (etaInfo?.eta_formatted || shipment.estimated_arrival || "Calculating...")}
                  </p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Remaining Distance</span>
                  <p style={{ fontSize: "16px", fontWeight: 900, color: "#0F172A", margin: "4px 0 0" }}>
                    {shipment.status === "Delivered" ? "0 km" : (etaInfo?.remaining_distance_km ? `${etaInfo.remaining_distance_km} km` : (shipment.remaining_distance_km ? `${shipment.remaining_distance_km} km` : "—"))}
                  </p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Travel Duration</span>
                  <p style={{ fontSize: "16px", fontWeight: 900, color: "#4F46E5", margin: "4px 0 0" }}>
                    {shipment.status === "Delivered" ? "Completed" : (etaInfo?.duration_human || (shipment.remaining_duration_mins ? `${Math.round(shipment.remaining_duration_mins)} mins` : "—"))}
                  </p>
                </div>

                <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Traffic Condition</span>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: etaInfo?.traffic_factor >= 1.3 ? "#DC2626" : "#059669", margin: "6px 0 0" }}>
                    {etaInfo?.traffic_condition || shipment.traffic_condition || "Normal Traffic Flow"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Details Card */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(15,23,42,0.04)" }}>
            <h3 style={{ fontSize: "11px", fontWeight: 800, color: "#475569", margin: "0 0 22px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Overview & Specifications</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px" }}>
              <InfoRow label="Source Origin" icon={MapPin} iconColor="#0D9488">{shipment.source}</InfoRow>
              <InfoRow label="Destination"   icon={MapPin} iconColor="#4F46E5">{shipment.destination}</InfoRow>

              <InfoRow label="Customer" icon={User} iconColor="#059669">
                <div>
                  <span style={{ display: "block" }}>{shipment.customer_name}</span>
                  {shipment.customer_phone && <span style={{ fontSize: "11px", color: "#64748B" }}>{shipment.customer_phone}</span>}
                </div>
              </InfoRow>

              <InfoRow label="Cargo Weight" icon={Weight} iconColor="#D97706">
                {shipment.shipment_weight ? `${shipment.shipment_weight} kg` : "N/A"}
              </InfoRow>

              <InfoRow label="Expected Delivery" icon={Calendar} iconColor="#0D9488">
                <span style={{ color: shipment.is_delayed ? "#DC2626" : "#0F172A" }}>
                  {shipment.expected_delivery ? new Date(shipment.expected_delivery).toLocaleString() : "Not specified"}
                </span>
              </InfoRow>

              {/* ── Assignments — human-readable ── */}
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ color: "#475569", fontSize: "11px", fontWeight: 800, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Assigned Fleet</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {/* Vehicle */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: shipment.vehicle_id ? "linear-gradient(135deg, #0D9488, #0891B2)" : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Truck size={16} color={shipment.vehicle_id ? "white" : "#94A3B8"} />
                    </div>
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", margin: "0 0 2px", textTransform: "uppercase" }}>Vehicle</p>
                      {vehicleInfo ? (
                        <>
                          <p style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", margin: 0 }}>{vehicleInfo.registration_number}</p>
                          <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>
                            {vehicleInfo.brand} {vehicleInfo.model} · {vehicleInfo.status}
                          </p>
                        </>
                      ) : (
                        <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0, fontStyle: "italic" }}>
                          {shipment.vehicle_id ? "Loading..." : "Unassigned"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Driver */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: shipment.driver_id ? "linear-gradient(135deg, #4F46E5, #7C3AED)" : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <User size={16} color={shipment.driver_id ? "white" : "#94A3B8"} />
                    </div>
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", margin: "0 0 2px", textTransform: "uppercase" }}>Driver</p>
                      {driverInfo ? (
                        <>
                          <p style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", margin: 0 }}>{driverInfo.driver_name || "Unnamed Driver"}</p>
                          <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>
                            {driverInfo.license_number ? `Lic: ${driverInfo.license_number}` : ""}{driverInfo.status ? ` · ${driverInfo.status}` : ""}
                          </p>
                        </>
                      ) : (
                        <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0, fontStyle: "italic" }}>
                          {shipment.driver_id ? "Loading..." : "Unassigned"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {shipment.notes && (
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #E2E8F0" }}>
                <p style={{ color: "#475569", fontSize: "11px", fontWeight: 800, margin: "0 0 4px", textTransform: "uppercase" }}>Remarks / Notes</p>
                <p style={{ fontSize: "13px", color: "#0F172A", margin: 0, fontStyle: "italic" }}>"{shipment.notes}"</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(15,23,42,0.04)" }}>
            <h3 style={{ fontSize: "11px", fontWeight: 800, color: "#475569", margin: "0 0 20px", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "8px" }}>
              <History size={15} /> Audit Timeline
            </h3>
            {history.length === 0 ? (
              <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>No status changes recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingLeft: "10px", borderLeft: "2px solid #E2E8F0" }}>
                {history.map((h) => (
                  <div key={h.history_id} style={{ display: "flex", alignItems: "flex-start", gap: "14px", position: "relative" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#0D9488", border: "3px solid #FFFFFF", outline: "2px solid #0D9488", flexShrink: 0, marginTop: "3px", marginLeft: "-6px" }} />
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <span style={{ fontWeight: 800, fontSize: "12px", color: STATUS_COLORS[h.status] || "#0D9488" }}>{h.status}</span>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>{new Date(h.changed_at).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#0F172A", margin: 0 }}>{h.note || "Status updated"}</p>
                      <p style={{ fontSize: "10px", color: "#64748B", margin: "3px 0 0" }}>By: <strong>{h.changed_by_name || "System"}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(15,23,42,0.04)" }}>
            <h3 style={{ fontSize: "11px", fontWeight: 800, color: "#475569", margin: "0 0 18px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Update Delivery Status
            </h3>
            {nextActions.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>
                Marked as <strong>{shipment.status}</strong>. No further actions available.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Optional Status Note</label>
                  <input
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="e.g. Arrived at checkpoint..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                {nextActions.map((act) => (
                  <button
                    key={act.target}
                    disabled={updating}
                    onClick={() => handleStatusChange(act.target)}
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: "10px",
                      background: `${act.color}12`, border: `1px solid ${act.color}40`,
                      color: act.color, cursor: "pointer", fontSize: "12px", fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "all 0.15s", opacity: updating ? 0.6 : 1,
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = `${act.color}22`; }}
                    onMouseOut={(e)  => { e.currentTarget.style.background = `${act.color}12`; }}
                  >
                    <span>{act.label}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trip Schedule Modal */}
      {showTripModal && shipment && (
        <TripScheduleModal
          shipment={shipment}
          onClose={() => setShowTripModal(false)}
          onSuccess={() => { setShowTripModal(false); fetchData(); }}
        />
      )}
    </div>
  );
};

export default ShipmentDetail;
