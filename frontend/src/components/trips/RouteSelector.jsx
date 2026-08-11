import React from 'react';
import { Zap, Compass, ShieldAlert, Leaf, Clock, ArrowRight, Check } from 'lucide-react';
import './RouteSelector.css';

export default function RouteSelector({ routes = [], selectedType, onSelect }) {
  if (!routes || routes.length === 0) return null;

  const getRouteIcon = (type) => {
    if (type === 'fastest') return <Zap size={20} color="#38bdf8" />;
    if (type === 'shortest') return <Compass size={20} color="#a78bfa" />;
    if (type === 'traffic_avoidance') return <ShieldAlert size={20} color="#f59e0b" />;
    return <Leaf size={20} color="#34d399" />;
  };

  return (
    <div className="route-selector-wrapper">
      <div className="route-selector-heading">
        <h3>Select Optimized Route Profile</h3>
        <span className="route-notice-tag">Powered by OSRM + Simulated Traffic</span>
      </div>

      <div className="route-cards-grid">
        {routes.map((route) => {
          const isSelected = selectedType === route.route_type;
          const etaTime = route.eta ? new Date(route.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

          return (
            <div
              key={route.route_type}
              className={`route-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(route.route_type)}
            >
              <div className="route-card-top">
                <div className="route-icon-box">
                  {getRouteIcon(route.route_type)}
                </div>
                {isSelected && (
                  <span className="selected-check-badge">
                    <Check size={14} /> Selected
                  </span>
                )}
              </div>

              <h4 className="route-label">{route.label}</h4>
              <p className="route-desc">{route.description}</p>

              <div className="route-metrics-row">
                <div className="metric-item">
                  <span className="metric-sub">Distance</span>
                  <strong className="metric-main">{route.distance_km} km</strong>
                </div>

                <div className="metric-item">
                  <span className="metric-sub">Est. Duration</span>
                  <strong className="metric-main">{route.duration_min} min</strong>
                </div>

                <div className="metric-item">
                  <span className="metric-sub">ETA</span>
                  <strong className="metric-main eta-accent">{etaTime}</strong>
                </div>
              </div>

              <div className="route-footer-tags">
                <span className="route-tag traffic-tag">
                  Traffic: {route.traffic_level}
                </span>
                <span className="route-tag fuel-tag">
                  Fuel Score: {route.fuel_score}/100
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
