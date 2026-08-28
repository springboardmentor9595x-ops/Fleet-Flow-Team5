import React, { useState, useEffect } from "react";

import {
  X, Package, Truck, User, Calendar, Weight, MapPin, FileText,
  Phone, AlertCircle, ChevronDown, Loader, Sparkles
} from "lucide-react";
import shipmentsApi from "../api/shipments";
import fleetApi from "../api/fleet";
import { toast } from "react-toastify";

/* ── Design tokens ─────────────────────────────────────────────────────── */
const C = {
  bg: "#FFFFFF",
  surface: "#F8FAFC",
  border: "#E2E8F0",
  primary: "#0D9488",
  primaryDark: "#0F766E",
  text: "#0F172A",
  muted: "#475569",
  subtle: "#64748B",
  error: "#DC2626",
};

const BASE_INPUT = {
  width: "100%",
  padding: "10px 14px",
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: "10px",
  color: C.text,
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};
const FOCUS = { borderColor: C.primary, boxShadow: "0 0 0 3px rgba(13,148,136,0.12)" };
const BLUR  = { borderColor: C.border,  boxShadow: "none" };

const Label = ({ children, icon: Icon, optional }) => (
  <label style={{
    display: "flex", alignItems: "center", gap: "5px",
    fontSize: "11px", fontWeight: 800, color: C.muted,
    marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em",
  }}>
    {Icon && <Icon size={10} />}
    {children}
    {optional && (
      <span style={{ fontWeight: 600, textTransform: "none", color: C.subtle, letterSpacing: 0 }}>
        (optional)
      </span>
    )}
  </label>
);

const SelectField = ({ value, onChange, disabled, children, loading }) => (
  <div style={{ position: "relative" }}>
    <select
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      style={{
        ...BASE_INPUT,
        paddingRight: "36px",
        appearance: "none",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        background: loading ? C.surface : C.bg,
      }}
      onFocus={(e) => Object.assign(e.target.style, FOCUS)}
      onBlur={(e)  => Object.assign(e.target.style, BLUR)}
    >
      {children}
    </select>
    <div style={{
      position: "absolute", right: "12px", top: "50%",
      transform: "translateY(-50%)", pointerEvents: "none", color: C.muted,
    }}>
      {loading
        ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} />
        : <ChevronDown size={13} />}
    </div>
  </div>
);

const ShipmentForm = ({ onClose, onSuccess, editData = null }) => {
  const isEdit = !!editData;
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [drivers,  setDrivers]  = useState([]);
  const [dropLoad, setDropLoad] = useState(true);

  const [form, setForm] = useState({
    tracking_number:   editData?.tracking_number || "",
    source:            editData?.source          || "",
    destination:       editData?.destination     || "",
    customer_name:     editData?.customer_name   || "",
    customer_phone:    editData?.customer_phone  || "",
    shipment_weight:   editData?.shipment_weight || "",
    vehicle_id:        editData?.vehicle_id      || "",
    driver_id:         editData?.driver_id       || "",
    notes:             editData?.notes           || "",
    expected_delivery: editData?.expected_delivery
      ? new Date(editData.expected_delivery).toISOString().slice(0, 16)
      : "",
  });

  useEffect(() => {
    setDropLoad(true);
    Promise.all([
      fleetApi.getVehicles().catch(() => []),
      fleetApi.getDrivers().catch(() => []),
    ]).then(([v, d]) => {
      setVehicles(v);
      setDrivers(d);
    }).finally(() => setDropLoad(false));
  }, []);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const payload = {
      tracking_number:   form.tracking_number.trim() || null,
      source:            form.source.trim(),
      destination:       form.destination.trim(),
      customer_name:     form.customer_name.trim(),
      customer_phone:    form.customer_phone.trim() || null,
      shipment_weight:   form.shipment_weight ? parseFloat(form.shipment_weight) : null,
      vehicle_id:        form.vehicle_id || null,
      driver_id:         form.driver_id  || null,
      notes:             form.notes.trim() || null,
      expected_delivery: form.expected_delivery
        ? new Date(form.expected_delivery).toISOString() : null,
    };
    try {
      let result;
      if (isEdit) {
        result = await shipmentsApi.update(editData.shipment_id, payload);
        toast.success(`✅ Shipment ${result.tracking_number} updated!`);
      } else {
        result = await shipmentsApi.create(payload);
        toast.success(`🚀 Shipment ${result.tracking_number} created!`);
      }
      onSuccess && onSuccess(result);
      onClose   && onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || "Operation failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose && onClose()}
    >
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: "20px",
        width: "100%", maxWidth: "660px", maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(15,23,42,0.18)", color: C.text,
        animation: "slideInUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
          position: "sticky", top: 0, background: C.bg, zIndex: 10,
          borderRadius: "20px 20px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "10px",
              background: "linear-gradient(135deg, #0D9488, #0891B2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(13,148,136,0.3)",
            }}>
              <Package size={18} color="white" />
            </div>
            <div>
              <h3 style={{ color: C.text, fontWeight: 800, fontSize: "16px", margin: 0 }}>
                {isEdit ? "Edit Shipment" : "Create New Shipment"}
              </h3>
              <p style={{ color: C.muted, fontSize: "11px", margin: 0 }}>
                {isEdit ? `Editing ${editData.tracking_number}` : "Fill in the shipment details below"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "7px", borderRadius: "8px", background: C.surface,
              border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = C.error; }}
            onMouseOut={(e)  => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.muted; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 14px", borderRadius: "10px", marginBottom: "18px",
              background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.25)",
              color: C.error, fontSize: "12px",
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

            {/* Tracking Number — full width, optional */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Label icon={Sparkles} optional>Tracking Number</Label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...BASE_INPUT, fontFamily: "monospace", paddingRight: isEdit ? "14px" : "120px" }}
                  value={form.tracking_number}
                  onChange={set("tracking_number")}
                  placeholder="Leave blank to auto-generate  (e.g. FF-2026-A3F1E2B4)"
                  onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                  onBlur={(e)  => Object.assign(e.target.style, BLUR)}
                />
                {!isEdit && !form.tracking_number && (
                  <span style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)", fontSize: "10px", fontWeight: 700,
                    color: C.primary, background: "rgba(13,148,136,0.08)",
                    padding: "3px 8px", borderRadius: "6px", whiteSpace: "nowrap",
                    border: "1px solid rgba(13,148,136,0.2)", pointerEvents: "none",
                  }}>
                    AUTO-GENERATE
                  </span>
                )}
              </div>
            </div>

            {/* Source */}
            <div>
              <Label icon={MapPin}>Source / Origin</Label>
              <input
                style={BASE_INPUT} required value={form.source} onChange={set("source")}
                placeholder="e.g. Kollam Logistics Hub"
                onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                onBlur={(e)  => Object.assign(e.target.style, BLUR)}
              />
            </div>

            {/* Destination */}
            <div>
              <Label icon={MapPin}>Destination</Label>
              <input
                style={BASE_INPUT} required value={form.destination} onChange={set("destination")}
                placeholder="e.g. Mumbai Depot"
                onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                onBlur={(e)  => Object.assign(e.target.style, BLUR)}
              />
            </div>

            {/* Customer Name */}
            <div>
              <Label icon={User}>Customer Name</Label>
              <input
                style={BASE_INPUT} required value={form.customer_name} onChange={set("customer_name")}
                placeholder="Full customer name"
                onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                onBlur={(e)  => Object.assign(e.target.style, BLUR)}
              />
            </div>

            {/* Customer Phone */}
            <div>
              <Label icon={Phone} optional>Customer Phone</Label>
              <input
                style={BASE_INPUT} value={form.customer_phone} onChange={set("customer_phone")}
                placeholder="+91 98765 43210"
                onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                onBlur={(e)  => Object.assign(e.target.style, BLUR)}
              />
            </div>

            {/* Weight */}
            <div>
              <Label icon={Weight} optional>Weight (kg)</Label>
              <input
                type="number" min="0" step="0.01"
                style={BASE_INPUT} value={form.shipment_weight} onChange={set("shipment_weight")}
                placeholder="0.00"
                onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                onBlur={(e)  => Object.assign(e.target.style, BLUR)}
              />
            </div>

            {/* Expected Delivery */}
            <div>
              <Label icon={Calendar} optional>Expected Delivery</Label>
              <input
                type="datetime-local"
                style={BASE_INPUT} value={form.expected_delivery} onChange={set("expected_delivery")}
                onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                onBlur={(e)  => Object.assign(e.target.style, BLUR)}
              />
            </div>

            {/* Vehicle Dropdown */}
            <div>
              <Label icon={Truck} optional>Assign Vehicle</Label>
              <SelectField value={form.vehicle_id} onChange={set("vehicle_id")} loading={dropLoad}>
                <option value="">— No vehicle assigned —</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.registration_number}
                    {v.brand ? ` · ${v.brand}` : ""}
                    {v.model ? ` ${v.model}` : ""}
                    {` (${v.status || "Unknown"})`}
                  </option>
                ))}
              </SelectField>
              {vehicles.length === 0 && !dropLoad && (
                <p style={{ fontSize: "11px", color: C.subtle, margin: "4px 0 0" }}>
                  No vehicles in fleet yet.
                </p>
              )}
            </div>

            {/* Driver Dropdown */}
            <div>
              <Label icon={User} optional>Assign Driver</Label>
              <SelectField value={form.driver_id} onChange={set("driver_id")} loading={dropLoad}>
                <option value="">— No driver assigned —</option>
                {drivers.map((d) => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.full_name || "Unnamed Driver"}
                    {d.license_number ? ` · ${d.license_number}` : ""}
                    {d.status ? ` (${d.status})` : ""}
                  </option>
                ))}
              </SelectField>
              {drivers.length === 0 && !dropLoad && (
                <p style={{ fontSize: "11px", color: C.subtle, margin: "4px 0 0" }}>
                  No drivers in fleet yet.
                </p>
              )}
            </div>

            {/* Notes — full width */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Label icon={FileText} optional>Notes</Label>
              <textarea
                style={{ ...BASE_INPUT, resize: "vertical", minHeight: "76px" }}
                value={form.notes} onChange={set("notes")}
                placeholder="Optional notes about this shipment..."
                onFocus={(e) => Object.assign(e.target.style, FOCUS)}
                onBlur={(e)  => Object.assign(e.target.style, BLUR)}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: "10px",
            marginTop: "22px", paddingTop: "18px", borderTop: `1px solid ${C.border}`,
          }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: "10px 22px", borderRadius: "10px",
                background: "transparent", border: `1px solid ${C.border}`,
                color: C.muted, cursor: "pointer", fontSize: "13px", fontWeight: 700,
                transition: "all 0.15s",
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.background = C.surface; }}
              onMouseOut={(e)  => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.background = "transparent"; }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              style={{
                padding: "10px 26px", borderRadius: "10px",
                background: loading ? "#94A3B8" : "linear-gradient(135deg, #0D9488, #0891B2)",
                border: "none", color: "white", cursor: loading ? "not-allowed" : "pointer",
                fontSize: "13px", fontWeight: 700,
                display: "flex", alignItems: "center", gap: "7px",
                boxShadow: loading ? "none" : "0 4px 14px rgba(13,148,136,0.3)",
                transition: "all 0.2s",
              }}
            >
              {loading
                ? <><Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving...</>
                : isEdit ? "Save Changes" : "Create Shipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShipmentForm;
