import React from "react";
import { CheckCircle2, Circle, Clock, Truck, Package, XCircle, AlertTriangle } from "lucide-react";

const STEPS = [
  { key: "Created", label: "Created", icon: Package, color: "#64748B" },
  { key: "Assigned", label: "Assigned", icon: Truck, color: "#0D9488" },
  { key: "In Transit", label: "In Transit", icon: Truck, color: "#4F46E5" },
  { key: "Delivered", label: "Delivered", icon: CheckCircle2, color: "#059669" },
];

const STATUS_ORDER = {
  Created: 0,
  Assigned: 1,
  "In Transit": 2,
  Delayed: 2.5,
  Delivered: 3,
  Cancelled: -1,
};

const DeliveryProgressStepper = ({ status }) => {
  if (status === "Cancelled") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "14px 18px", borderRadius: "12px",
        background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)",
      }}>
        <XCircle size={20} color="#DC2626" />
        <span style={{ color: "#DC2626", fontWeight: 800, fontSize: "14px" }}>
          Shipment Cancelled
        </span>
      </div>
    );
  }

  const currentIndex = STATUS_ORDER[status] ?? 0;
  const isDelayed = status === "Delayed";

  return (
    <div style={{ padding: "6px 0" }}>
      {isDelayed && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 14px", borderRadius: "8px", marginBottom: "16px",
          background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)",
        }}>
          <AlertTriangle size={14} color="#DC2626" />
          <span style={{ color: "#DC2626", fontSize: "12px", fontWeight: 800 }}>
            Shipment Delayed — past expected delivery window
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = currentIndex > idx;
          const isCurrent = Math.floor(currentIndex) === idx || (isDelayed && idx === 2);

          const dotColor = isCompleted ? "#059669"
            : isCurrent ? (isDelayed ? "#DC2626" : step.color)
            : "#CBD5E1";

          const dotBorder = isCompleted ? "#059669"
            : isCurrent ? (isDelayed ? "#DC2626" : step.color)
            : "#E2E8F0";

          return (
            <React.Fragment key={step.key}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  border: `2px solid ${dotBorder}`,
                  background: isCompleted ? "rgba(5,150,105,0.12)"
                    : isCurrent ? `${dotColor}15`
                    : "#F8FAFC",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s ease",
                  boxShadow: isCurrent ? `0 0 0 4px ${dotColor}15` : "none",
                }}>
                  {isCompleted
                    ? <CheckCircle2 size={16} color="#059669" />
                    : isCurrent && isDelayed
                    ? <AlertTriangle size={16} color="#DC2626" />
                    : <Icon size={16} color={isCurrent ? dotColor : "#94A3B8"} />}
                </div>
                <p style={{
                  fontSize: "11px", fontWeight: isCurrent ? 800 : 600,
                  color: isCompleted ? "#059669"
                    : isCurrent ? (isDelayed ? "#DC2626" : dotColor)
                    : "#64748B",
                  margin: "6px 0 0", whiteSpace: "nowrap",
                }}>
                  {step.label}
                </p>
              </div>

              {idx < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: "3px", margin: "0 4px",
                  marginTop: "-20px",
                  background: currentIndex > idx
                    ? "#059669"
                    : "#E2E8F0",
                  borderRadius: "2px",
                  transition: "background 0.3s ease",
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default DeliveryProgressStepper;
