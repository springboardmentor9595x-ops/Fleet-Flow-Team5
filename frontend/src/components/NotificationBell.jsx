import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, X, AlertTriangle, Wrench, Package, Info, Clock } from "lucide-react";
import notificationsApi from "../api/notifications";
import { toast } from "react-toastify";

const NotificationBell = ({ align = "right" }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const prevCountRef = useRef(0);

  const fetchNotifications = useCallback(async (isInitial = false) => {
    try {
      const data = await notificationsApi.getMyNotifications(false, 30);
      const list = data || [];
      const unreadCount = list.filter((n) => !n.is_read).length;

      // Trigger pop-up toast if a new unread critical notification arrives after initial load
      if (!isInitial && unreadCount > prevCountRef.current && list.length > 0) {
        const newest = list[0];
        if (!newest.is_read) {
          if (newest.type?.includes("MAINTENANCE") || newest.type?.includes("DELAY")) {
            toast.warning(`🔔 ${newest.title}: ${newest.message.slice(0, 70)}...`, {
              position: "top-right",
              autoClose: 5000,
            });
          }
        }
      }

      prevCountRef.current = unreadCount;
      setNotifications(list);
    } catch (err) {
      console.error("Error fetching notifications", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 15000); // Polling every 15s for live updates
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getIcon = (type) => {
    if (type?.includes("MAINTENANCE")) {
      return <Wrench size={14} color="#D97706" />;
    }
    if (type?.includes("DELAY") || type?.includes("OVERDUE")) {
      return <AlertTriangle size={14} color="#DC2626" />;
    }
    if (type?.includes("SHIPMENT")) {
      return <Package size={14} color="#0D9488" />;
    }
    return <Info size={14} color="#3B82F6" />;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: isOpen ? "rgba(13,148,136,0.12)" : "#FFFFFF",
          border: isOpen ? "1px solid #0D9488" : "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: isOpen ? "#0D9488" : "#475569",
          transition: "all 0.15s ease",
          boxShadow: "0 2px 6px rgba(15,23,42,0.04)",
        }}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              borderRadius: "10px",
              background: "#DC2626",
              color: "white",
              fontSize: "10px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(220,38,38,0.4)",
              border: "2px solid #FFFFFF",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "44px",
            ...(align === "left" ? { left: "0px" } : { right: "0px" }),
            width: "360px",
            maxWidth: "calc(100vw - 20px)",
            maxHeight: "480px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            boxShadow: "0 20px 45px rgba(15,23,42,0.18)",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#F8FAFC",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                Notifications
              </h4>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "rgba(13,148,136,0.12)",
                    color: "#0D9488",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#0D9488",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1, maxHeight: "380px" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center", color: "#64748B" }}>
                <Bell size={28} style={{ opacity: 0.3, marginBottom: "8px" }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>No notifications yet</p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94A3B8" }}>
                  Alerts and service notices will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => !n.is_read && handleMarkRead(n.notification_id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #F1F5F9",
                    background: n.is_read ? "#FFFFFF" : "rgba(13,148,136,0.03)",
                    cursor: n.is_read ? "default" : "pointer",
                    transition: "background 0.15s ease",
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                  onMouseEnter={(e) => {
                    if (!n.is_read) e.currentTarget.style.background = "rgba(13,148,136,0.07)";
                  }}
                  onMouseLeave={(e) => {
                    if (!n.is_read) e.currentTarget.style.background = "rgba(13,148,136,0.03)";
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: n.is_read ? "#F1F5F9" : "rgba(13,148,136,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {getIcon(n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          fontWeight: n.is_read ? 600 : 800,
                          color: n.is_read ? "#475569" : "#0F172A",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {n.title}
                      </p>
                      <span style={{ fontSize: "10px", color: "#94A3B8", flexShrink: 0 }}>
                        {formatTime(n.created_at)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "11px",
                        color: "#64748B",
                        lineHeight: "1.4",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {n.message}
                    </p>
                  </div>

                  {!n.is_read && (
                    <div
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#0D9488",
                        flexShrink: 0,
                        marginTop: "6px",
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
