import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import attendanceApi from "../api/attendance";
import {
  CalendarCheck, Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Search, Plus, UserCheck, Users, Filter, Download,
  Check, X, FileText, ChevronLeft, ChevronRight, FileSpreadsheet, CalendarDays,
  Send, ShieldCheck, ArrowRight
} from "lucide-react";
import { toast } from "react-toastify";

const toDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const Attendance = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const isFleetManager = user?.role === "FleetManager";
  const isDispatcher = user?.role === "Dispatcher";
  const isDriver = user?.role === "Driver";
  const canManage = isAdmin || isFleetManager;

  const [activeTab, setActiveTab] = useState(isDriver ? "my-history" : "daily");
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Daily roster state
  const [rosterData, setRosterData] = useState(null);
  const [markingId, setMarkingId] = useState(null);

  // Driver Personal History State
  const [mySummary, setMySummary] = useState(null);
  const [myHistoryLoading, setMyHistoryLoading] = useState(false);

  // Leave Management State
  const [leaves, setLeaves] = useState([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("All");
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    start_date: toDateStr(new Date()),
    end_date: toDateStr(new Date()),
    leave_type: "Casual",
    reason: "",
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [reviewingLeaveId, setReviewingLeaveId] = useState(null);
  const [managerRemark, setManagerRemark] = useState("");
  const [activeReviewModal, setActiveReviewModal] = useState(null);

  // 1. Fetch Daily Roster
  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const data = await attendanceApi.getAttendance({
        target_date: selectedDate,
        status_filter: statusFilter !== "All" ? statusFilter : undefined,
      });
      setRosterData(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load attendance roster.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter]);

  // 2. Fetch Driver Personal History
  const fetchMyHistory = useCallback(async () => {
    setMyHistoryLoading(true);
    try {
      const data = await attendanceApi.getMyAttendanceHistory();
      setMySummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setMyHistoryLoading(false);
    }
  }, []);

  // 3. Fetch Leaves
  const fetchLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const data = await attendanceApi.getLeaves(leaveStatusFilter);
      setLeaves(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLeavesLoading(false);
    }
  }, [leaveStatusFilter]);

  useEffect(() => {
    if (activeTab === "daily") {
      fetchRoster();
    } else if (activeTab === "my-history") {
      fetchMyHistory();
    } else if (activeTab === "leaves") {
      fetchLeaves();
    }
  }, [activeTab, fetchRoster, fetchMyHistory, fetchLeaves]);

  // Quick Date Navigation
  const shiftDate = (days) => {
    const parts = selectedDate.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateStr(d));
  };

  // Mark Single Driver Attendance
  const handleMarkAttendance = async (driverId, nextStatus, remarks = null) => {
    setMarkingId(driverId);
    try {
      await attendanceApi.markAttendance({
        driver_id: driverId,
        date: selectedDate,
        status: nextStatus,
        remarks: remarks || `Marked ${nextStatus} by ${user?.full_name}`,
      });
      toast.success(`Marked driver as ${nextStatus}.`);
      fetchRoster();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to mark attendance.");
    } finally {
      setMarkingId(null);
    }
  };

  // Mark All Unmarked as Present
  const handleMarkAllPresent = async () => {
    try {
      const res = await attendanceApi.markAllPresent(selectedDate);
      toast.success(res.message || "All unmarked drivers marked as Present!");
      fetchRoster();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Operation failed.");
    }
  };

  // Driver Self Check-in
  const handleDriverCheckIn = async () => {
    try {
      await attendanceApi.checkInToday();
      toast.success("Successfully checked in for today!");
      fetchMyHistory();
      if (activeTab === "daily") fetchRoster();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Check-in failed.");
    }
  };

  // Submit Leave Request
  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    if (leaveForm.end_date < leaveForm.start_date) {
      toast.error("End date cannot be earlier than start date.");
      return;
    }
    setSubmittingLeave(true);
    try {
      await attendanceApi.applyLeave(leaveForm);
      toast.success("Leave application submitted successfully!");
      setShowApplyLeaveModal(false);
      setLeaveForm({
        start_date: toDateStr(new Date()),
        end_date: toDateStr(new Date()),
        leave_type: "Casual",
        reason: "",
      });
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit leave request.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Review Leave (Approve / Reject)
  const handleReviewLeave = async (leaveId, reviewStatus, remarks) => {
    setReviewingLeaveId(leaveId);
    try {
      await attendanceApi.reviewLeave(leaveId, {
        status: reviewStatus,
        manager_remarks: remarks || `Reviewed by ${user?.full_name}`,
      });
      toast.success(`Leave request ${reviewStatus}! Attendance automatically synced.`);
      setActiveReviewModal(null);
      fetchLeaves();
      if (activeTab === "daily") fetchRoster();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Review failed.");
    } finally {
      setReviewingLeaveId(null);
    }
  };

  // Cancel Leave
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm("Cancel this leave request?")) return;
    try {
      await attendanceApi.cancelLeave(leaveId);
      toast.success("Leave request cancelled.");
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to cancel leave.");
    }
  };

  // Filtered Roster
  const filteredRoster = (rosterData?.roster || []).filter((r) => {
    const q = search.toLowerCase();
    return (
      (r.driver_name && r.driver_name.toLowerCase().includes(q)) ||
      (r.license_number && r.license_number.toLowerCase().includes(q)) ||
      (r.remarks && r.remarks.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px", display: "flex", alignItems: "center", gap: "8px" }}>
            <CalendarCheck size={22} color="#0D9488" />
            Driver Attendance & Leave Management
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            {isDriver
              ? "Track your daily attendance history and manage leave applications"
              : isDispatcher
              ? "Operational view of driver presence and availability for trip dispatching"
              : "Fleet-wide attendance tracking, daily roster management, and leave approval workflows"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isDriver && (
            <button
              onClick={handleDriverCheckIn}
              style={{
                padding: "9px 18px", borderRadius: "10px", background: "linear-gradient(135deg, #059669, #047857)",
                border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(5,150,105,0.25)"
              }}
            >
              <CheckCircle2 size={15} /> Check In Today
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === "daily") fetchRoster();
              else if (activeTab === "my-history") fetchMyHistory();
              else if (activeTab === "leaves") fetchLeaves();
            }}
            style={{
              padding: "9px 14px", borderRadius: "10px", background: "#FFFFFF",
              border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600,
              boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
            }}
          >
            <RefreshCw size={13} style={loading || leavesLoading ? { animation: "spin 0.8s linear infinite" } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
        {!isDriver && (
          <button
            onClick={() => setActiveTab("daily")}
            style={{
              padding: "8px 16px", borderRadius: "10px", border: "none",
              background: activeTab === "daily" ? "#0D9488" : "#FFFFFF",
              color: activeTab === "daily" ? "white" : "#475569",
              fontWeight: 700, fontSize: "13px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              boxShadow: activeTab === "daily" ? "0 4px 12px rgba(13,148,136,0.2)" : "0 1px 4px rgba(15,23,42,0.02)",
            }}
          >
            <Calendar size={15} /> Daily Attendance Roster
          </button>
        )}

        <button
          onClick={() => setActiveTab("leaves")}
          style={{
            padding: "8px 16px", borderRadius: "10px", border: "none",
            background: activeTab === "leaves" ? "#0D9488" : "#FFFFFF",
            color: activeTab === "leaves" ? "white" : "#475569",
            fontWeight: 700, fontSize: "13px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            boxShadow: activeTab === "leaves" ? "0 4px 12px rgba(13,148,136,0.2)" : "0 1px 4px rgba(15,23,42,0.02)",
          }}
        >
          <Clock size={15} /> Leave Management & Requests
        </button>

        {isDriver && (
          <button
            onClick={() => setActiveTab("my-history")}
            style={{
              padding: "8px 16px", borderRadius: "10px", border: "none",
              background: activeTab === "my-history" ? "#0D9488" : "#FFFFFF",
              color: activeTab === "my-history" ? "white" : "#475569",
              fontWeight: 700, fontSize: "13px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              boxShadow: activeTab === "my-history" ? "0 4px 12px rgba(13,148,136,0.2)" : "0 1px 4px rgba(15,23,42,0.02)",
            }}
          >
            <UserCheck size={15} /> My Attendance History
          </button>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: DAILY ATTENDANCE ROSTER (Admin, FleetManager, Dispatcher)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "daily" && (
        <div>
          {/* Date Selector & Controls */}
          <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "16px 20px",
            marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.03)"
          }}>
            {/* Date Pickers */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                ATTENDANCE DATE:
              </span>
              <button
                onClick={() => shiftDate(-1)}
                style={{
                  padding: "6px 10px", borderRadius: "8px", background: "#F8FAFC",
                  border: "1px solid #CBD5E1", cursor: "pointer", display: "flex", alignItems: "center"
                }}
                title="Previous Day"
              >
                <ChevronLeft size={16} color="#475569" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: "6px 12px", borderRadius: "8px", border: "1px solid #0D9488",
                  fontWeight: 700, fontSize: "13px", color: "#0F172A", outline: "none", background: "rgba(13,148,136,0.04)"
                }}
              />
              <button
                onClick={() => shiftDate(1)}
                style={{
                  padding: "6px 10px", borderRadius: "8px", background: "#F8FAFC",
                  border: "1px solid #CBD5E1", cursor: "pointer", display: "flex", alignItems: "center"
                }}
                title="Next Day"
              >
                <ChevronRight size={16} color="#475569" />
              </button>
              <button
                onClick={() => setSelectedDate(toDateStr(new Date()))}
                style={{
                  padding: "6px 12px", borderRadius: "8px", background: selectedDate === toDateStr(new Date()) ? "rgba(13,148,136,0.12)" : "#F8FAFC",
                  border: "1px solid #E2E8F0", color: "#0D9488", fontSize: "12px", fontWeight: 700, cursor: "pointer"
                }}
              >
                Today
              </button>
            </div>

            {/* Quick Actions */}
            {canManage && (
              <button
                onClick={handleMarkAllPresent}
                style={{
                  padding: "8px 16px", borderRadius: "10px", background: "#059669",
                  border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                  display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(5,150,105,0.2)"
                }}
              >
                <Check size={14} /> Mark All Unmarked as Present
              </button>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" }}>
            <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>TOTAL DRIVERS</span>
              <p style={{ fontSize: "24px", fontWeight: 900, color: "#0F172A", margin: "4px 0 0" }}>
                {rosterData ? rosterData.total_drivers : "—"}
              </p>
            </div>
            <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid rgba(5,150,105,0.2)" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>PRESENT / AVAILABLE</span>
              <p style={{ fontSize: "24px", fontWeight: 900, color: "#059669", margin: "4px 0 0" }}>
                {rosterData ? rosterData.present_count : "—"}
              </p>
            </div>
            <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid rgba(217,119,6,0.2)" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>ON LEAVE</span>
              <p style={{ fontSize: "24px", fontWeight: 900, color: "#D97706", margin: "4px 0 0" }}>
                {rosterData ? rosterData.leave_count : "—"}
              </p>
            </div>
            <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid rgba(220,38,38,0.2)" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#DC2626" }}>ABSENT</span>
              <p style={{ fontSize: "24px", fontWeight: 900, color: "#DC2626", margin: "4px 0 0" }}>
                {rosterData ? rosterData.absent_count : "—"}
              </p>
            </div>
            <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>UNMARKED</span>
              <p style={{ fontSize: "24px", fontWeight: 900, color: "#64748B", margin: "4px 0 0" }}>
                {rosterData ? rosterData.unmarked_count : "—"}
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search driver name, license #, remarks..."
                style={{
                  width: "100%", padding: "9px 14px 9px 36px", background: "#FFFFFF",
                  border: "1px solid #CBD5E1", borderRadius: "10px", color: "#0F172A",
                  fontSize: "13px", outline: "none", boxSizing: "border-box"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {["All", "Present", "Leave", "Absent", "Unmarked"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "7px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                    cursor: "pointer",
                    background: statusFilter === s ? "#0D9488" : "#FFFFFF",
                    border: statusFilter === s ? "1px solid #0D9488" : "1px solid #CBD5E1",
                    color: statusFilter === s ? "#FFFFFF" : "#475569"
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Table */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px", color: "#0D9488" }} />
                <p style={{ margin: 0 }}>Loading daily roster...</p>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                <UserCheck size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
                <p style={{ fontWeight: 700, margin: 0 }}>No drivers match the filter criteria.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Driver Name</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>CDL License</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Duty Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Attendance Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Remarks / Notes</th>
                    {canManage && (
                      <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Quick Mark</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map((row) => {
                    const isMarking = markingId === row.driver_id;
                    const stColor = row.status === "Present" ? "#059669" : row.status === "Leave" ? "#D97706" : row.status === "Absent" ? "#DC2626" : "#64748B";
                    const stBg = row.status === "Present" ? "rgba(5,150,105,0.1)" : row.status === "Leave" ? "rgba(217,119,6,0.1)" : row.status === "Absent" ? "rgba(220,38,38,0.1)" : "rgba(100,116,139,0.1)";

                    return (
                      <tr key={row.driver_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>
                          {row.driver_name}
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: "#0D9488", fontWeight: 700 }}>
                          {row.license_number || "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "10px",
                            background: row.duty_status === "Active" ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
                            color: row.duty_status === "Active" ? "#059669" : "#DC2626"
                          }}>
                            ● {row.duty_status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: "8px",
                            fontSize: "11px", fontWeight: 800, background: stBg, color: stColor
                          }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B" }}>
                          {row.remarks || "—"}
                        </td>
                        {canManage && (
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button
                                disabled={isMarking}
                                onClick={() => handleMarkAttendance(row.driver_id, "Present")}
                                style={{
                                  padding: "5px 9px", borderRadius: "6px", border: "none",
                                  background: row.status === "Present" ? "#059669" : "rgba(5,150,105,0.1)",
                                  color: row.status === "Present" ? "#FFFFFF" : "#059669",
                                  fontWeight: 700, fontSize: "11px", cursor: isMarking ? "not-allowed" : "pointer"
                                }}
                              >
                                Present
                              </button>
                              <button
                                disabled={isMarking}
                                onClick={() => handleMarkAttendance(row.driver_id, "Leave")}
                                style={{
                                  padding: "5px 9px", borderRadius: "6px", border: "none",
                                  background: row.status === "Leave" ? "#D97706" : "rgba(217,119,6,0.1)",
                                  color: row.status === "Leave" ? "#FFFFFF" : "#D97706",
                                  fontWeight: 700, fontSize: "11px", cursor: isMarking ? "not-allowed" : "pointer"
                                }}
                              >
                                Leave
                              </button>
                              <button
                                disabled={isMarking}
                                onClick={() => handleMarkAttendance(row.driver_id, "Absent")}
                                style={{
                                  padding: "5px 9px", borderRadius: "6px", border: "none",
                                  background: row.status === "Absent" ? "#DC2626" : "rgba(220,38,38,0.1)",
                                  color: row.status === "Absent" ? "#FFFFFF" : "#DC2626",
                                  fontWeight: 700, fontSize: "11px", cursor: isMarking ? "not-allowed" : "pointer"
                                }}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: LEAVE MANAGEMENT & REQUESTS (Driver & Management Workflow)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "leaves" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {["All", "Pending", "Approved", "Rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setLeaveStatusFilter(s)}
                  style={{
                    padding: "7px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                    cursor: "pointer",
                    background: leaveStatusFilter === s ? "#0D9488" : "#FFFFFF",
                    border: leaveStatusFilter === s ? "1px solid #0D9488" : "1px solid #CBD5E1",
                    color: leaveStatusFilter === s ? "#FFFFFF" : "#475569"
                  }}
                >
                  {s} Leaves
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowApplyLeaveModal(true)}
              style={{
                padding: "9px 18px", borderRadius: "10px", background: "#0D9488",
                border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(13,148,136,0.25)"
              }}
            >
              <Plus size={15} /> Apply for Leave
            </button>
          </div>

          {/* Leave Requests Table */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
            {leavesLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px", color: "#0D9488" }} />
                <p style={{ margin: 0 }}>Loading leave applications...</p>
              </div>
            ) : leaves.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                <Clock size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
                <p style={{ fontWeight: 700, margin: 0 }}>No leave applications found.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Driver</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Type</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Leave Period</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Reason</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Manager Remarks</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => {
                    const stBg = l.status === "Approved" ? "rgba(5,150,105,0.12)" : l.status === "Rejected" ? "rgba(220,38,38,0.12)" : "rgba(217,119,6,0.12)";
                    const stColor = l.status === "Approved" ? "#059669" : l.status === "Rejected" ? "#DC2626" : "#D97706";

                    return (
                      <tr key={l.leave_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>
                          {l.driver_name}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "6px", background: "#F1F5F9", color: "#334155" }}>
                            {l.leave_type}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#0F172A", fontWeight: 600 }}>
                          {l.start_date} <span style={{ color: "#94A3B8" }}>→</span> {l.end_date}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569", maxWidth: "200px" }}>
                          {l.reason || "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 9px", borderRadius: "8px",
                            fontSize: "11px", fontWeight: 800, background: stBg, color: stColor
                          }}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B" }}>
                          {l.manager_remarks || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          {canManage && l.status === "Pending" && (
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button
                                onClick={() => handleReviewLeave(l.leave_id, "Approved", "Approved by Management")}
                                style={{
                                  padding: "5px 10px", borderRadius: "6px", border: "none",
                                  background: "#059669", color: "white", fontWeight: 700, fontSize: "11px", cursor: "pointer"
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setActiveReviewModal(l);
                                  setManagerRemark("");
                                }}
                                style={{
                                  padding: "5px 10px", borderRadius: "6px", border: "none",
                                  background: "#DC2626", color: "white", fontWeight: 700, fontSize: "11px", cursor: "pointer"
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {isDriver && l.status === "Pending" && (
                            <button
                              onClick={() => handleCancelLeave(l.leave_id)}
                              style={{
                                padding: "5px 10px", borderRadius: "6px", border: "1px solid rgba(220,38,38,0.2)",
                                background: "rgba(220,38,38,0.06)", color: "#DC2626", fontWeight: 700, fontSize: "11px", cursor: "pointer"
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: DRIVER PERSONAL HISTORY (Driver Dashboard Integrated)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "my-history" && (
        <div>
          {mySummary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              <div style={{ padding: "18px", borderRadius: "16px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488" }}>ATTENDANCE RATE</span>
                <p style={{ fontSize: "26px", fontWeight: 900, color: "#0D9488", margin: "6px 0 2px" }}>
                  {mySummary.attendance_rate_pct}%
                </p>
                <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Overall attendance score</p>
              </div>

              <div style={{ padding: "18px", borderRadius: "16px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>PRESENT DAYS</span>
                <p style={{ fontSize: "26px", fontWeight: 900, color: "#059669", margin: "6px 0 2px" }}>
                  {mySummary.present_days} <span style={{ fontSize: "13px", color: "#94A3B8" }}>/ {mySummary.total_records} Days</span>
                </p>
                <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Total recorded presence</p>
              </div>

              <div style={{ padding: "18px", borderRadius: "16px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>LEAVE DAYS</span>
                <p style={{ fontSize: "26px", fontWeight: 900, color: "#D97706", margin: "6px 0 2px" }}>
                  {mySummary.leave_days} Days
                </p>
                <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Approved leaves taken</p>
              </div>

              <div style={{ padding: "18px", borderRadius: "16px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#DC2626" }}>ABSENT DAYS</span>
                <p style={{ fontSize: "26px", fontWeight: 900, color: "#DC2626", margin: "6px 0 2px" }}>
                  {mySummary.absent_days} Days
                </p>
                <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Unexcused absences</p>
              </div>
            </div>
          )}

          {/* History Records Table */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", background: "#FAFAFA" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                My Detailed Attendance History
              </h3>
            </div>

            {myHistoryLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px", color: "#0D9488" }} />
                <p style={{ margin: 0 }}>Loading personal attendance records...</p>
              </div>
            ) : !mySummary || mySummary.records.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                <Calendar size={36} style={{ opacity: 0.4, marginBottom: "8px" }} />
                <p style={{ fontWeight: 700, margin: 0 }}>No attendance records found yet.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Date</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Remarks / Log</th>
                  </tr>
                </thead>
                <tbody>
                  {mySummary.records.map((r) => {
                    const stColor = r.status === "Present" ? "#059669" : r.status === "Leave" ? "#D97706" : "#DC2626";
                    const stBg = r.status === "Present" ? "rgba(5,150,105,0.1)" : r.status === "Leave" ? "rgba(217,119,6,0.1)" : "rgba(220,38,38,0.1)";

                    return (
                      <tr key={r.attendance_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>
                          {r.date}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: "8px",
                            fontSize: "11px", fontWeight: 800, background: stBg, color: stColor
                          }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B" }}>
                          {r.remarks || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Apply Leave Modal ── */}
      {showApplyLeaveModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: "16px", maxWidth: "440px", width: "100%", padding: "24px",
            color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.2)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Apply for Leave</h3>
              <button onClick={() => setShowApplyLeaveModal(false)} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Leave Type *</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none" }}
                >
                  <option value="Casual">Casual Leave</option>
                  <option value="Sick">Sick / Medical Leave</option>
                  <option value="Emergency">Emergency Leave</option>
                  <option value="Vacation">Annual Vacation</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Start Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>End Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Reason / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Provide reason for leave request..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none", boxSizing: "border-box", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowApplyLeaveModal(false)}
                  style={{ padding: "8px 14px", borderRadius: "8px", background: "transparent", border: "1px solid #CBD5E1", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  style={{ padding: "8px 18px", borderRadius: "8px", background: "#0D9488", border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                >
                  {submittingLeave ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reject / Review Modal with Comments ── */}
      {activeReviewModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: "16px", maxWidth: "420px", width: "100%", padding: "24px",
            color: "#0F172A", boxShadow: "0 20px 50px rgba(15,23,42,0.2)"
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 12px", color: "#DC2626" }}>Reject Leave Request</h3>
            <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 12px" }}>
              Rejecting leave for <strong>{activeReviewModal.driver_name}</strong> ({activeReviewModal.start_date} to {activeReviewModal.end_date})
            </p>

            <label style={{ fontSize: "11px", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>
              Rejection Reason / Manager Comments
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Schedule conflicts on high-volume shipping day..."
              value={managerRemark}
              onChange={(e) => setManagerRemark(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none", boxSizing: "border-box", resize: "none", marginBottom: "14px" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setActiveReviewModal(null)}
                style={{ padding: "8px 14px", borderRadius: "8px", background: "transparent", border: "1px solid #CBD5E1", color: "#475569", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewLeave(activeReviewModal.leave_id, "Rejected", managerRemark || "Rejected by Management")}
                style={{ padding: "8px 18px", borderRadius: "8px", background: "#DC2626", border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
