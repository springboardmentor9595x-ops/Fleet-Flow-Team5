import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Clock, CheckCircle2, X, RefreshCw, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";

const EmailLogsModal = ({ onClose }) => {
  const { fetchEmailLogs } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [error, setError] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchEmailLogs();
      setLogs(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0 && !selectedLog) {
        setSelectedLog(data[0]);
      }
    } catch (err) {
      console.error("Failed to load email logs", err);
      setError("Could not load email logs. Make sure you are logged in as Admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const ROLE_COLORS = {
    Admin: { bg: "rgba(79,70,229,0.1)", color: "#4F46E5", border: "rgba(79,70,229,0.25)" },
    FleetManager: { bg: "rgba(13,148,136,0.1)", color: "#0D9488", border: "rgba(13,148,136,0.25)" },
    Driver: { bg: "rgba(5,150,105,0.1)", color: "#059669", border: "rgba(5,150,105,0.25)" },
    Dispatcher: { bg: "rgba(217,119,6,0.1)", color: "#D97706", border: "rgba(217,119,6,0.25)" },
  };

  const getRoleStyle = (role) =>
    ROLE_COLORS[role] || { bg: "rgba(100,116,139,0.1)", color: "#475569", border: "rgba(100,116,139,0.25)" };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#FFFFFF", borderRadius: "20px", width: "100%", maxWidth: "900px",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(15,23,42,0.18)", overflow: "hidden",
        border: "1px solid #E2E8F0",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid #E2E8F0",
          background: "linear-gradient(135deg, #0D9488, #0891B2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mail size={20} color="white" />
            </div>
            <div>
              <h2 style={{ color: "white", fontWeight: 900, fontSize: "16px", margin: 0 }}>
                Email Audit Logs
                <span style={{
                  marginLeft: "10px", fontSize: "11px", fontWeight: 700,
                  background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: "12px",
                }}>
                  {logs.length} Sent
                </span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px", margin: 0 }}>
                Welcome emails &amp; admin account provisioning notifications
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={loadLogs}
              disabled={loading}
              style={{
                padding: "7px 12px", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer",
                background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                color: "white", display: "flex", alignItems: "center", gap: "5px",
                fontSize: "12px", fontWeight: 600,
              }}
            >
              <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
              Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "7px", borderRadius: "8px", cursor: "pointer",
                background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                color: "white", display: "flex", alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: "400px" }}>
          {/* Left: Email list */}
          <div style={{
            width: "320px", minWidth: "280px", borderRight: "1px solid #E2E8F0",
            overflowY: "auto", background: "#F8FAFC",
          }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
                <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px" }} />
                <p style={{ margin: 0, fontSize: "13px" }}>Loading logs...</p>
              </div>
            ) : error ? (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <AlertCircle size={24} color="#DC2626" style={{ marginBottom: "8px" }} />
                <p style={{ color: "#DC2626", fontSize: "12px", margin: 0 }}>{error}</p>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
                <Mail size={32} style={{ opacity: 0.4, marginBottom: "10px" }} />
                <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px", color: "#475569" }}>No emails sent yet</p>
                <p style={{ fontSize: "12px", margin: 0 }}>Emails appear here when users sign up or are provisioned by Admin.</p>
              </div>
            ) : (
              logs.map((log) => {
                const roleStyle = getRoleStyle(log.role);
                const isSelected = selectedLog?.id === log.id;
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    style={{
                      padding: "14px 16px", cursor: "pointer", transition: "background 0.12s",
                      borderBottom: "1px solid #E2E8F0",
                      background: isSelected ? "rgba(13,148,136,0.06)" : "transparent",
                      borderLeft: isSelected ? "3px solid #0D9488" : "3px solid transparent",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(13,148,136,0.03)"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "10px",
                        background: roleStyle.bg, color: roleStyle.color, border: `1px solid ${roleStyle.border}`,
                      }}>
                        {log.role}
                      </span>
                      <span style={{ fontSize: "10px", color: "#64748B", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Clock size={10} />
                        {log.sent_at?.split(" ")[1] || ""}
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.recipient_name}
                    </p>
                    <p style={{ fontSize: "11px", color: "#64748B", margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.recipient}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "10px", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
                        <CheckCircle2 size={10} /> {log.status}
                      </span>
                      {log.added_by_admin && (
                        <span style={{
                          fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "6px",
                          background: "rgba(217,119,6,0.1)", color: "#D97706", border: "1px solid rgba(217,119,6,0.25)",
                        }}>
                          Admin Created
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Email preview */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#FFFFFF" }}>
            {selectedLog ? (
              <div>
                {/* Email meta card */}
                <div style={{
                  background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "14px",
                  padding: "18px", marginBottom: "16px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                      {selectedLog.subject}
                    </h3>
                    <span style={{
                      padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                      background: "rgba(5,150,105,0.1)", color: "#059669", border: "1px solid rgba(5,150,105,0.25)",
                      display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap", marginLeft: "12px",
                    }}>
                      <CheckCircle2 size={11} /> {selectedLog.status}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", color: "#475569" }}>
                    <div><span style={{ color: "#94A3B8", fontWeight: 600 }}>To: </span>{selectedLog.recipient_name} ({selectedLog.recipient})</div>
                    <div><span style={{ color: "#94A3B8", fontWeight: 600 }}>Sent: </span>{selectedLog.sent_at}</div>
                    <div><span style={{ color: "#94A3B8", fontWeight: 600 }}>Role: </span>{selectedLog.role}</div>
                    <div>
                      {selectedLog.added_by_admin && (
                        <span style={{ color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                          <ShieldCheck size={12} /> Admin Provisioned
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email body preview */}
                <div style={{
                  background: "#0F172A", border: "1px solid #1E293B", borderRadius: "14px", padding: "24px",
                }}>
                  {/* FleetFlow brand header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "16px", borderBottom: "1px solid #1E293B", marginBottom: "20px" }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: "linear-gradient(135deg, #0D9488, #0891B2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, color: "white", fontSize: "14px",
                    }}>
                      FF
                    </div>
                    <div>
                      <p style={{ color: "white", fontWeight: 800, fontSize: "14px", margin: 0 }}>FleetFlow Logistics Notification</p>
                      <p style={{ color: "#0D9488", fontSize: "11px", margin: 0 }}>Automated Dispatch System</p>
                    </div>
                  </div>

                  <div style={{ color: "#CBD5E1", fontSize: "13px", lineHeight: 1.7 }}>
                    <p style={{ color: "#F1F5F9", fontWeight: 600, marginBottom: "12px" }}>
                      Hello {selectedLog.recipient_name},
                    </p>
                    <p style={{ marginBottom: "16px" }}>{selectedLog.body_preview}</p>
                    {selectedLog.added_by_admin && (
                      <div style={{
                        padding: "12px 16px", borderRadius: "10px", marginBottom: "16px",
                        background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.3)",
                        color: "#FCD34D", fontSize: "12px",
                      }}>
                        🔑 <strong>Account Provisioned by Admin:</strong> This email contains your temporary login credentials for the FleetFlow Portal.
                      </div>
                    )}
                    <p style={{ fontSize: "11px", color: "#475569", paddingTop: "12px", borderTop: "1px solid #1E293B", marginTop: "16px" }}>
                      This is an automated email from the FleetFlow Backend Service. Please do not reply.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8", padding: "40px" }}>
                <Sparkles size={36} style={{ opacity: 0.4, marginBottom: "12px" }} />
                <p style={{ fontWeight: 600, fontSize: "14px", color: "#475569", margin: "0 0 4px" }}>No email selected</p>
                <p style={{ fontSize: "12px", margin: 0 }}>Select an email from the list to view details.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC",
        }}>
          <span style={{ fontSize: "11px", color: "#64748B" }}>
            FastAPI Background Tasks + SMTP Logger · Session logs only
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "7px 18px", borderRadius: "8px", background: "#0D9488",
              border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailLogsModal;
