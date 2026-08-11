import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Truck,
  LayoutDashboard,
  Package,
  MapPin,
  LogOut,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  Users,
  Navigation,
  Wrench
} from "lucide-react";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["Admin", "FleetManager", "Dispatcher"],
  },
  {
    to: "/shipments",
    label: "Shipments",
    icon: Package,
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
  },
  {
    to: "/vehicles",
    label: "Fleet Vehicles",
    icon: Truck,
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
  },
  {
    to: "/drivers",
    label: "Drivers Directory",
    icon: Users,
    roles: ["Admin", "FleetManager", "Dispatcher"],
  },
  {
    to: "/trips",
    label: "Trips & Routes",
    icon: Navigation,
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
  },
  {
    to: "/tracking",
    label: "Live Tracking",
    icon: MapPin,
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
  },
  {
    to: "/maintenance",
    label: "Maintenance & Fuel",
    icon: Wrench,
    roles: ["Admin", "FleetManager"],
  },
];

const roleBadgeStyle = (role) => {
  switch (role) {
    case "Admin": return { bg: "rgba(217,119,6,0.1)", color: "#b45309", border: "rgba(217,119,6,0.3)" };
    case "FleetManager": return { bg: "rgba(13,148,136,0.1)", color: "#0F766E", border: "rgba(13,148,136,0.3)" };
    case "Driver": return { bg: "rgba(5,150,105,0.1)", color: "#047857", border: "rgba(5,150,105,0.3)" };
    case "Dispatcher": return { bg: "rgba(79,70,229,0.1)", color: "#4338ca", border: "rgba(79,70,229,0.3)" };
    default: return { bg: "rgba(100,116,139,0.1)", color: "#475569", border: "rgba(100,116,139,0.2)" };
  }
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const badge = roleBadgeStyle(user?.role);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(user?.role)
  );

  return (
    <aside style={{
      width: "240px",
      minHeight: "100vh",
      background: "#FFFFFF",
      borderRight: "1px solid #E2E8F0",
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 0,
      flexShrink: 0,
      boxShadow: "2px 0 12px rgba(15,23,42,0.02)"
    }}>
      {/* Logo Header */}
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "38px", height: "38px", borderRadius: "10px",
            background: "linear-gradient(135deg, #0D9488, #0891B2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(13,148,136,0.25)",
          }}>
            <Truck size={18} color="white" />
          </div>
          <div>
            <p style={{ color: "#0F172A", fontWeight: 800, fontSize: "16px", margin: 0, letterSpacing: "-0.02em" }}>FleetFlow</p>
            <p style={{ color: "#0D9488", fontSize: "10px", margin: 0, fontFamily: "monospace", fontWeight: 700 }}>TEAL MODE v2.0</p>
          </div>
        </div>
      </div>

      {/* User Card */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{
          padding: "12px", borderRadius: "10px",
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              background: "linear-gradient(135deg, #0D9488, #0891B2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {user?.role === "Admin"
                ? <ShieldCheck size={14} color="white" />
                : <UserCheck size={14} color="white" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#0F172A", fontWeight: 700, fontSize: "12px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name}
              </p>
              <p style={{ color: "#475569", fontSize: "10px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email}
              </p>
            </div>
          </div>
          <span style={{
            display: "inline-block",
            padding: "2px 8px", borderRadius: "6px",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em",
            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
          }}>
            {user?.role}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        <p style={{ color: "#475569", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", padding: "0 8px 8px", margin: 0 }}>
          MAIN NAVIGATION
        </p>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", borderRadius: "10px", marginBottom: "4px",
                textDecoration: "none", transition: "all 0.15s ease",
                background: isActive ? "rgba(13,148,136,0.08)" : "transparent",
                border: isActive ? "1px solid rgba(13,148,136,0.2)" : "1px solid transparent",
                color: isActive ? "#0D9488" : "#475569",
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: isActive ? 700 : 600, flex: 1 }}>
                    {item.label}
                  </span>
                  {isActive && <ChevronRight size={14} color="#0D9488" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div style={{ padding: "16px 12px", borderTop: "1px solid #E2E8F0" }}>
        <button
          onClick={handleLogout}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 12px", borderRadius: "10px",
            background: "transparent", border: "1px solid rgba(220,38,38,0.2)",
            color: "#DC2626", cursor: "pointer", fontSize: "13px", fontWeight: 700,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(220,38,38,0.06)";
            e.currentTarget.style.borderColor = "rgba(220,38,38,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(220,38,38,0.2)";
          }}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
