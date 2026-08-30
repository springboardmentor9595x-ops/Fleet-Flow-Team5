import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import fleetApi from "../api/fleet";
import NotificationBell from "./NotificationBell";
import ChangePasswordModal from "./ChangePasswordModal";
import UserManagementModal from "./UserManagementModal";
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
  Wrench,
  FileText,
  ToggleLeft,
  ToggleRight,
  Activity,
  CalendarCheck,
  KeyRound,
  UserCog
} from "lucide-react";
import { toast } from "react-toastify";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
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
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
  },
  {
    to: "/attendance",
    label: "Driver Attendance",
    icon: CalendarCheck,
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
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
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
  },
  {
    to: "/reports",
    label: "Reports & Export",
    icon: FileText,
    roles: ["Admin", "FleetManager", "Dispatcher", "Driver"],
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

  const [driverStatus, setDriverStatus] = useState("Active");
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [showUserMgmtModal, setShowUserMgmtModal] = useState(false);

  useEffect(() => {
    if (user?.role === "Driver") {
      fleetApi.getMyDriver()
        .then((res) => {
          if (res?.status) setDriverStatus(res.status);
        })
        .catch((err) => console.error("Error fetching driver profile:", err));
    }
  }, [user]);

  const handleToggleDriverStatus = async () => {
    const nextStatus = driverStatus === "Active" ? "Inactive" : "Active";
    setTogglingStatus(true);
    try {
      const res = await fleetApi.setMyStatus(nextStatus);
      setDriverStatus(res.status);
      toast.success(`Duty status updated to ${res.status}`);
      // Dispatch a custom event so other components (like Drivers page) update live
      window.dispatchEvent(new Event("driver_status_changed"));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  };

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
      <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #0D9488, #0891B2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(13,148,136,0.25)",
          }}>
            <Truck size={18} color="white" />
          </div>
          <div>
            <p style={{ color: "#0F172A", fontWeight: 800, fontSize: "15px", margin: 0, letterSpacing: "-0.02em" }}>FleetFlow</p>
            <p style={{ color: "#0D9488", fontSize: "9px", margin: 0, fontFamily: "monospace", fontWeight: 700 }}>TEAL MODE v2.0</p>
          </div>
        </div>
        <NotificationBell align="left" />
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{
              display: "inline-block",
              padding: "2px 8px", borderRadius: "6px",
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em",
              background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
            }}>
              {user?.role}
            </span>

            <button
              onClick={() => setShowChangePassModal(true)}
              title="Change Password"
              style={{
                background: "transparent", border: "none", color: "#64748B",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "3px",
                fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#0D9488"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748B"; }}
            >
              <KeyRound size={12} /> Key
            </button>
          </div>

          {/* Admin User Management Button */}
          {user?.role === "Admin" && (
            <button
              onClick={() => setShowUserMgmtModal(true)}
              style={{
                width: "100%", marginTop: "8px", padding: "6px 10px",
                borderRadius: "6px", border: "1px solid rgba(217,119,6,0.3)",
                background: "rgba(217,119,6,0.08)", color: "#B45309",
                fontSize: "11px", fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                transition: "all 0.15s ease"
              }}
            >
              <UserCog size={13} /> Manage User Roles
            </button>
          )}

          {/* Driver Duty Status Toggle inside Sidebar User Card */}
          {user?.role === "Driver" && (
            <div style={{
              marginTop: "10px",
              paddingTop: "8px",
              borderTop: "1px dashed #CBD5E1",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                  DUTY STATUS
                </span>
                <span style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: driverStatus === "Active" ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.15)",
                  color: driverStatus === "Active" ? "#059669" : "#DC2626",
                }}>
                  ● {driverStatus}
                </span>
              </div>
              <button
                onClick={handleToggleDriverStatus}
                disabled={togglingStatus}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: togglingStatus ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  color: "#FFFFFF",
                  background: driverStatus === "Active"
                    ? "linear-gradient(135deg, #DC2626, #B91C1C)"
                    : "linear-gradient(135deg, #059669, #047857)",
                  boxShadow: driverStatus === "Active"
                    ? "0 2px 6px rgba(220,38,38,0.25)"
                    : "0 2px 6px rgba(5,150,105,0.25)",
                  opacity: togglingStatus ? 0.6 : 1,
                  transition: "all 0.15s ease",
                }}
              >
                {driverStatus === "Active" ? (
                  <><ToggleLeft size={14} /> Go Off-Duty (Inactive)</>
                ) : (
                  <><ToggleRight size={14} /> Go On-Duty (Active)</>
                )}
              </button>
            </div>
          )}
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

      {/* Modals */}
      <ChangePasswordModal
        isOpen={showChangePassModal}
        onClose={() => setShowChangePassModal(false)}
      />
      <UserManagementModal
        isOpen={showUserMgmtModal}
        onClose={() => setShowUserMgmtModal(false)}
      />
    </aside>
  );
};

export default Sidebar;
