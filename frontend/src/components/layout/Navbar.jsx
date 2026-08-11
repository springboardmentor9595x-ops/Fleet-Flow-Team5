import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Truck, 
  Package, 
  Navigation, 
  MapPin, 
  LogOut, 
  Shield, 
  Radio
} from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Vehicles', path: '/vehicles', icon: Truck },
    { label: 'Shipments', path: '/shipments', icon: Package },
    { label: 'Trip Dispatcher', path: '/trips', icon: Navigation },
    { label: 'Live GPS Map', path: '/live-map', icon: MapPin },
  ];

  return (
    <header className="ff-navbar">
      <div className="navbar-container">
        {/* Brand */}
        <Link to="/dashboard" className="brand-link">
          <div className="brand-logo">
            <Radio className="brand-icon" size={20} />
          </div>
          <span className="brand-name">Fleet<span className="brand-accent">Flow</span></span>
        </Link>

        {/* Navigation Links */}
        <nav className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Actions */}
        <div className="user-section">
          {user && (
            <div className="user-profile">
              <div className="user-avatar">
                {user.full_name?.charAt(0) || 'U'}
              </div>
              <div className="user-meta">
                <span className="user-name">{user.full_name}</span>
                <span className="user-role-tag">
                  <Shield size={10} />
                  {user.role}
                </span>
              </div>
            </div>
          )}

          <button onClick={handleLogout} className="logout-btn" title="Log Out">
            <LogOut size={18} />
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
