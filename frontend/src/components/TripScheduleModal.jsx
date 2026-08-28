import React, { useState, useEffect } from "react";
import { fleetApi } from "../api/fleet";
import tripsApi from "../api/trips";
import { toast } from "react-toastify";
import {
  X, Truck, User, Route, Zap, Clock, MapPin,
  Navigation, CheckCircle2, AlertCircle, Fuel, RefreshCw,
} from "lucide-react";

const ROUTE_TYPES = [
  {
    key: "fastest",
    label: "Fastest Route",
    icon: Zap,
    color: "#4F46E5",
    description: "Minimum travel time — open road speeds",
  },
  {
    key: "shortest",
    label: "Shortest Route",
    icon: Route,
    color: "#0D9488",
    description: "Minimum physical distance via local roads",
  },
  {
    key: "other",
    label: "Other",
    icon: Navigation,
    color: "#8B5CF6",
    description: "Alternative customizable or balanced route strategy",
  },
];

const TripScheduleModal = ({ shipment, onClose, onSuccess }) => {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(shipment?.vehicle_id || "");
  const [selectedDriver, setSelectedDriver] = useState(shipment?.driver_id || "");
  const [routeType, setRouteType] = useState("fastest");
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);

  useEffect(() => {
    // Load available vehicles & drivers
    Promise.all([
      fleetApi.getVehicles("Available").catch(() => []),
      fleetApi.getDrivers().catch(() => []),
    ]).then(([v, d]) => {
      setVehicles(Array.isArray(v) ? v : []);
      setDrivers(Array.isArray(d) ? d : []);
    });
  }, []);

  const handleSchedule = async () => {
    if (!selectedVehicle) { toast.error("Please select a vehicle."); return; }
    if (!selectedDriver)  { toast.error("Please select a driver.");  return; }

    const selDrv = drivers.find((d) => String(d.driver_id) === String(selectedDriver));
    if (selDrv && selDrv.status === "Inactive") {
      toast.error(`Cannot assign trip to '${selDrv.driver_name || "Driver"}'. Driver is currently Inactive / Off-Duty.`);
      return;
    }

    setLoading(true);
    try {
      const newTrip = await tripsApi.schedule({
        vehicle_id: selectedVehicle,
        driver_id: selectedDriver,
        shipment_id: shipment?.shipment_id,
        start_location: shipment?.source,
        destination: shipment?.destination,
        planned_route_type: routeType,
      });

      toast.success(`Trip scheduled! Route: ${routeType.replace("_", " ")}`);
      onSuccess?.(newTrip);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to schedule trip.");
    } finally {
      setLoading(false);
    }
  };

  const overlayStyle = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: "20px",
  };
  const modalStyle = {
    background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "560px",
    boxShadow: "0 25px 80px rgba(15,23,42,0.25)", overflow: "hidden",
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #0D9488, #0891B2)", color: "white" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Route size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900 }}>Schedule Trip</h2>
              {shipment && (
                <p style={{ margin: 0, fontSize: "12px", opacity: 0.85 }}>
                  {shipment.tracking_number} · {shipment.source} → {shipment.destination}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "8px", padding: "6px", cursor: "pointer", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px", maxHeight: "75vh", overflowY: "auto" }}>
          {/* Vehicle Select */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Truck size={12} style={{ display: "inline", marginRight: "5px" }} /> Assign Vehicle
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", fontSize: "13px", fontWeight: 600, outline: "none", cursor: "pointer" }}
            >
              <option value="">-- Select Vehicle --</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.registration_number} · {v.brand} {v.model} ({v.vehicle_type}) [{v.status}]
                </option>
              ))}
            </select>
          </div>

          {/* Driver Select */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <User size={12} style={{ display: "inline", marginRight: "5px" }} /> Assign Driver
            </label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F172A", fontSize: "13px", fontWeight: 600, outline: "none", cursor: "pointer" }}
            >
              <option value="">-- Select Driver --</option>
              {drivers.map((d) => {
                const isInactive = d.status === "Inactive";
                return (
                  <option key={d.driver_id} value={d.driver_id} disabled={isInactive}>
                    {d.driver_name || "Unnamed Driver"} · Lic: {d.license_number || "N/A"} {isInactive ? " 🚫 [INACTIVE - OFF DUTY]" : " 🟢 [ACTIVE]"}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Route Type Selection */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Route Strategy
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
              {ROUTE_TYPES.map((rt) => {
                const isSelected = routeType === rt.key;
                return (
                  <button
                    key={rt.key}
                    onClick={() => setRouteType(rt.key)}
                    style={{
                      padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
                      background: isSelected ? `${rt.color}12` : "#F8FAFC",
                      border: isSelected ? `1.5px solid ${rt.color}` : "1px solid #E2E8F0",
                      textAlign: "left", transition: "all 0.15s",
                      boxShadow: isSelected ? `0 4px 14px ${rt.color}25` : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <rt.icon size={14} color={isSelected ? rt.color : "#94A3B8"} />
                      <span style={{ fontSize: "12px", fontWeight: 800, color: isSelected ? rt.color : "#475569" }}>
                        {rt.label}
                      </span>
                      {isSelected && <CheckCircle2 size={12} color={rt.color} style={{ marginLeft: "auto" }} />}
                    </div>
                    <p style={{ fontSize: "10px", color: "#64748B", margin: 0, lineHeight: 1.4 }}>
                      {rt.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: "10px", color: "#94A3B8", margin: "8px 0 0", fontStyle: "italic" }}>
              OSRM route planning with dynamic distance, travel duration, and route geometry calculation.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "12px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={loading}
            style={{
              flex: 2, padding: "10px", borderRadius: "10px",
              background: "linear-gradient(135deg, #0D9488, #0891B2)",
              border: "none", color: "white", cursor: loading ? "wait" : "pointer",
              fontWeight: 800, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              boxShadow: "0 4px 14px rgba(13,148,136,0.35)", opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Route size={14} />}
            {loading ? "Scheduling..." : "Schedule Trip"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripScheduleModal;
