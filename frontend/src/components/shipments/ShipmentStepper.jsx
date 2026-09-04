import React from 'react';
import { CheckCircle2, Clock, Truck, Package, AlertTriangle, XCircle } from 'lucide-react';
import './ShipmentStepper.css';

export default function ShipmentStepper({ status, isDelayed = false }) {
  const steps = [
    { key: 'Created', label: 'Order Created', icon: Package },
    { key: 'Assigned', label: 'Vehicle Assigned', icon: Clock },
    { key: 'In Transit', label: 'In Transit', icon: Truck },
    { key: 'Delivered', label: 'Delivered', icon: CheckCircle2 },
  ];

  const getStepIndex = (st) => {
    if (st === 'Created') return 0;
    if (st === 'Assigned') return 1;
    if (st === 'In Transit' || st === 'Delayed') return 2;
    if (st === 'Delivered') return 3;
    return -1;
  };

  const currentIndex = getStepIndex(status);
  const isCancelled = status === 'Cancelled';

  if (isCancelled) {
    return (
      <div className="stepper-cancelled">
        <XCircle size={18} color="#F87171" />
        <span>Shipment Cancelled</span>
      </div>
    );
  }

  return (
    <div className="shipment-stepper-container">
      {isDelayed && (
        <div className="delayed-badge-banner">
          <AlertTriangle size={14} />
          <span>Delayed Delivery Alert</span>
        </div>
      )}
      <div className="stepper-track">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isUpcoming = idx > currentIndex;

          let stepClass = 'step-upcoming';
          if (isCompleted) stepClass = 'step-completed';
          if (isCurrent) stepClass = `step-current ${isDelayed && step.key === 'In Transit' ? 'step-delayed' : ''}`;

          return (
            <div key={step.key} className={`stepper-node ${stepClass}`}>
              <div className="step-icon-wrapper">
                <Icon size={16} />
              </div>
              <span className="step-label">{step.label}</span>
              {idx < steps.length - 1 && (
                <div className={`step-connector ${idx < currentIndex ? 'connector-completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
