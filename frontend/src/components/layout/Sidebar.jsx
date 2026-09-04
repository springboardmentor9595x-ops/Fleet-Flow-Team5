import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Truck,
  Package,
  Navigation,
  MapPin,
  Wrench,
  UserCheck,
  Fuel,
  FileText,
  Shield,
  Users,
  ChevronLeft,
  ChevronRight,
  Radio,
  X,
  Calendar,
  BarChart2,
  Layers
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Vehicles', path: '/vehicles', icon: Truck },
    { label: 'Shipments', path: '/shipments', icon: Package },
    { label: 'Trip Dispatcher', path: '/trips', icon: Navigation },
    { label: 'Live GPS Map', path: '/live-map', icon: MapPin },
    { label: 'Maintenance', path: '/maintenance', icon: Wrench },
    { label: 'Attendance', path: '/attendance', icon: UserCheck },
    { label: 'Leave Requests', path: '/leave-requests', icon: Calendar },
    { label: 'Fuel Logs', path: '/fuel', icon: Fuel },
    { label: 'Reports', path: '/reports', icon: FileText },
  ];

  if (user?.role === 'Admin') {
    navItems.push({ label: 'Users', path: '/users', icon: Users });
  }

  const handleNavClick = () => {
    if (isMobileOpen && setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <aside className={`ff-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Header with Close Button */}
      <div className="sidebar-mobile-header">
        <Link to="/dashboard" className="brand-link" onClick={handleNavClick}>
          <div className="brand-logo">
            <Radio className="brand-icon" size={20} />
          </div>
          <span className="brand-name">Fleet<span className="brand-accent">Flow</span></span>
        </Link>
        <button className="sidebar-mobile-close" onClick={() => setIsMobileOpen && setIsMobileOpen(false)} title="Close Menu">
          <X size={20} />
        </button>
      </div>

      {/* Sidebar Desktop Header */}
      <div className="sidebar-header">
        <Link to="/dashboard" className="sidebar-brand-link" onClick={handleNavClick} title="FleetFlow Dashboard">
          <div className="brand-logo">
            <Radio className="brand-icon" size={20} />
          </div>
          {!isCollapsed && (
            <span className="brand-name">Fleet<span className="brand-accent">Flow</span></span>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="sidebar-nav-container">
        {!isCollapsed && <div className="sidebar-section-label">NAVIGATION</div>}
        <nav className="sidebar-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={handleNavClick}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="nav-item-icon-wrapper">
                  <Icon size={20} />
                </div>
                {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
                {isActive && <div className="active-indicator" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer / Collapse Toggle */}
      <div className="sidebar-footer">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed && setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!isCollapsed && <span className="toggle-btn-text">Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
