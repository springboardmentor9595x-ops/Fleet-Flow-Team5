import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api/notifications';
import { 
  Radio, 
  LogOut, 
  Shield, 
  Bell, 
  AlertTriangle, 
  Clock, 
  Info, 
  X, 
  CheckCheck,
  Menu
} from 'lucide-react';
import './Navbar.css';

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const fetchNotifs = async () => {
    if (!user) return;
    setLoadingNotifs(true);
    try {
      const res = await getNotifications({ limit: 15 });
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleNotifDropdown = () => {
    if (!showNotifDropdown) {
      fetchNotifs();
    }
    setShowNotifDropdown((prev) => !prev);
  };

  const handleMarkRead = async (notificationId, e) => {
    e?.stopPropagation();
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getNotifIcon = (type) => {
    if (type?.includes('overdue')) return <AlertTriangle size={16} className="notif-icon overdue" />;
    if (type?.includes('upcoming')) return <Clock size={16} className="notif-icon upcoming" />;
    return <Info size={16} className="notif-icon general" />;
  };

  return (
    <header className="ff-navbar">
      <div className="navbar-container">
        {/* Left Side: Sidebar Toggle & Brand */}
        <div className="navbar-left">
          {onToggleSidebar && (
            <button 
              className="sidebar-hamburger-btn" 
              onClick={onToggleSidebar}
              title="Toggle Sidebar Navigation"
            >
              <Menu size={20} />
            </button>
          )}
          <Link to="/dashboard" className="brand-link">
            <div className="brand-logo">
              <Radio className="brand-icon" size={20} />
            </div>
            <span className="brand-name">Fleet<span className="brand-accent">Flow</span></span>
          </Link>
        </div>

        {/* Right Side: User Info & Actions */}
        <div className="user-section">
          {/* Notifications Bell Dropdown */}
          <div className="notif-bell-wrapper">
            <button 
              className={`notif-bell-btn ${showNotifDropdown ? 'active' : ''}`} 
              onClick={toggleNotifDropdown}
              title="Delivered Maintenance Alerts & System Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notif-badge-count">{unreadCount}</span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="notif-dropdown-card">
                <div className="notif-dropdown-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={16} style={{ color: 'var(--accent-cyan)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Alerts & Notifications</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {unreadCount > 0 && (
                      <button 
                        className="notif-mark-all-btn" 
                        onClick={handleMarkAllRead}
                        title="Mark all notifications as read"
                      >
                        <CheckCheck size={14} />
                        <span>Mark all read</span>
                      </button>
                    )}
                    <button className="notif-close-btn" onClick={() => setShowNotifDropdown(false)}>
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="notif-list-body">
                  {loadingNotifs ? (
                    <div className="notif-empty-state">Loading notifications...</div>
                  ) : notifications.length === 0 ? (
                    <div className="notif-empty-state">No notifications delivered yet.</div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.notification_id} 
                        className={`notif-item ${n.notification_type} ${!n.is_read ? 'unread' : 'read'}`}
                        onClick={(e) => !n.is_read && handleMarkRead(n.notification_id, e)}
                        title={!n.is_read ? 'Click to mark as read' : ''}
                      >
                        <div className="notif-item-left">
                          {getNotifIcon(n.notification_type)}
                        </div>
                        <div className="notif-item-content">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <strong className="notif-item-title">{n.title}</strong>
                            {!n.is_read && <span className="unread-dot" title="Unread" />}
                          </div>
                          <p className="notif-item-msg">{n.message}</p>
                          <span className="notif-item-time">
                            {new Date(n.created_at || n.sent_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {user && (
            <Link to="/profile" className="user-profile-link" title="View & Edit Profile">
              <div className="user-profile">
                <div className="user-avatar">
                  {user.profile_photo ? (
                    <img src={user.profile_photo} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    user.full_name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="user-meta">
                  <span className="user-name">{user.full_name}</span>
                  <span className="user-role-tag">
                    <Shield size={10} />
                    {user.role === 'FleetManager' ? 'Fleet Manager' : user.role}
                  </span>
                </div>
              </div>
            </Link>
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
