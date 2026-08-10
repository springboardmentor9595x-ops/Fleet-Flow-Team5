import React from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";

const DelayAlert = ({ delayedShipments, onDismiss, onRefresh }) => {
  if (!delayedShipments || delayedShipments.length === 0) return null;

  return (
    <div style={{
      padding: "14px 18px",
      borderRadius: "12px",
      background: "rgba(220,38,38,0.06)",
      border: "1px solid rgba(220,38,38,0.25)",
      marginBottom: "16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1 }}>
          <div style={{
            padding: "6px", borderRadius: "8px",
            background: "rgba(220,38,38,0.12)",
            flexShrink: 0, marginTop: "1px"
          }}>
            <AlertTriangle size={16} color="#DC2626" />
          </div>
          <div>
            <p style={{ color: "#DC2626", fontWeight: 800, fontSize: "13px", margin: "0 0 4px" }}>
              ⚠️ {delayedShipments.length} Delayed Shipment{delayedShipments.length > 1 ? "s" : ""} Detected
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {delayedShipments.slice(0, 4).map((s) => (
                <span key={s.shipment_id} style={{
                  padding: "2px 8px", borderRadius: "5px", fontSize: "11px", fontWeight: 700,
                  background: "rgba(220,38,38,0.1)", color: "#DC2626",
                  border: "1px solid rgba(220,38,38,0.2)",
                }}>
                  {s.tracking_number}
                </span>
              ))}
              {delayedShipments.length > 4 && (
                <span style={{ color: "#DC2626", fontSize: "11px", fontWeight: 700 }}>
                  +{delayedShipments.length - 4} more
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {onRefresh && (
            <button onClick={onRefresh} style={{
              padding: "4px 8px", borderRadius: "6px",
              background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)",
              color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
              fontSize: "10px", fontWeight: 700
            }}>
              <RefreshCw size={10} />
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} style={{
              padding: "4px", borderRadius: "6px",
              background: "transparent", border: "none",
              color: "#64748B", cursor: "pointer",
            }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DelayAlert;
