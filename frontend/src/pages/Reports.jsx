import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import reportsApi from "../api/reports";
import {
  FileText, Download, Calendar, RefreshCw, Truck, Fuel, Users, Package, Wrench,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Filter, Search, FileSpreadsheet,
  ChevronDown, CalendarDays, ArrowRight
} from "lucide-react";
import { toast } from "react-toastify";

const ALL_REPORTS = [
  {
    id: "fleet-utilization",
    label: "Fleet Utilization",
    icon: Truck,
    description: "Vehicle status breakdown, active rates, and trip distance analysis",
    roles: ["Admin", "FleetManager"],
  },
  {
    id: "fuel-consumption",
    label: "Fuel Consumption",
    icon: Fuel,
    description: "Fuel refill volume, total spend, and average cost per liter per vehicle",
    roles: ["Admin", "FleetManager"],
  },
  {
    id: "driver-performance",
    label: "Driver Performance",
    icon: Users,
    description: "Driver trip completions, on-time delivery rates, and attendance summary",
    roles: ["Admin", "FleetManager", "Driver"],
  },
  {
    id: "delivery-performance",
    label: "Delivery Performance",
    icon: Package,
    description: "Shipment on-time vs delayed metrics, delivery rates, and weight moved",
    roles: ["Admin", "FleetManager", "Dispatcher"],
  },
  {
    id: "maintenance",
    label: "Maintenance & Servicing",
    icon: Wrench,
    description: "Servicing expense per vehicle, maintenance frequency, and resolution status",
    roles: ["Admin", "FleetManager"],
  },
];

// Helper to format Date as YYYY-MM-DD
const toDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const Reports = () => {
  const { user } = useAuth();

  // Filter available reports based on role
  const allowedReports = ALL_REPORTS.filter((r) => r.roles.includes(user?.role));

  const [activeReport, setActiveReport] = useState(
    allowedReports[0]?.id || "delivery-performance"
  );

  // Generate 18-month options list for Monthly dropdown
  const monthOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const lastDay = new Date(year, month + 1, 0);
      const startStr = toDateStr(d);
      const endStr = toDateStr(lastDay);
      list.push({
        value: `${year}-${String(month + 1).padStart(2, "0")}`,
        label,
        startStr,
        endStr,
      });
    }
    return list;
  }, []);

  const [datePreset, setDatePreset] = useState("this_week");
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || "");

  // Initial date: Current Week (Monday to Today)
  const getInitialWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    return {
      start: toDateStr(monday),
      end: toDateStr(now),
    };
  };

  const initDates = getInitialWeek();
  const [startDate, setStartDate] = useState(initDates.start);
  const [endDate, setEndDate] = useState(initDates.end);

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === "today") {
      const today = toDateStr(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "this_week") {
      // Current Week: Monday of current week to today
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      setStartDate(toDateStr(monday));
      setEndDate(toDateStr(now));
    } else if (preset === "prev_week") {
      // Week-previous of current week: Monday to Sunday of previous week
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const prevMonday = new Date(now);
      prevMonday.setDate(now.getDate() + diffToMonday - 7);
      const prevSunday = new Date(now);
      prevSunday.setDate(now.getDate() + diffToMonday - 1);
      setStartDate(toDateStr(prevMonday));
      setEndDate(toDateStr(prevSunday));
    } else if (preset === "monthly") {
      // Set to selected month from dropdown
      const opt = monthOptions.find((m) => m.value === selectedMonth) || monthOptions[0];
      if (opt) {
        setStartDate(opt.startStr);
        setEndDate(opt.endStr);
      }
    } else if (preset === "30d") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(toDateStr(past));
      setEndDate(toDateStr(now));
    }
  };

  const handleMonthDropdownChange = (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
    setDatePreset("monthly");
    const opt = monthOptions.find((m) => m.value === val);
    if (opt) {
      setStartDate(opt.startStr);
      setEndDate(opt.endStr);
    }
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let data = null;
      if (activeReport === "fleet-utilization") {
        data = await reportsApi.getFleetUtilization(startDate, endDate);
      } else if (activeReport === "fuel-consumption") {
        data = await reportsApi.getFuelConsumption(startDate, endDate);
      } else if (activeReport === "driver-performance") {
        data = await reportsApi.getDriverPerformance(startDate, endDate);
      } else if (activeReport === "delivery-performance") {
        data = await reportsApi.getDeliveryPerformance(startDate, endDate);
      } else if (activeReport === "maintenance") {
        data = await reportsApi.getMaintenance(startDate, endDate);
      }
      setReportData(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [activeReport, startDate, endDate]);

  useEffect(() => {
    if (allowedReports.length > 0) {
      if (!allowedReports.some((r) => r.id === activeReport)) {
        setActiveReport(allowedReports[0].id);
      }
    }
  }, [user, allowedReports, activeReport]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await reportsApi.exportPdf(activeReport, startDate, endDate);
      toast.success("PDF report downloaded successfully!");
    } catch (err) {
      toast.error("Failed to export PDF report");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await reportsApi.exportExcel(activeReport, startDate, endDate);
      toast.success("Excel report downloaded successfully!");
    } catch (err) {
      toast.error("Failed to export Excel report");
    } finally {
      setExportingExcel(false);
    }
  };

  // Filter table rows
  const getFilteredData = () => {
    if (!reportData?.data) return [];
    if (!searchFilter.trim()) return reportData.data;
    const term = searchFilter.toLowerCase();
    return reportData.data.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(term))
    );
  };

  const filteredRows = getFilteredData();

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", padding: "28px", overflowY: "auto", color: "#0F172A" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
            Reports & Analytics Export Center
          </h1>
          <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
            Generate, preview, and export operational reports with custom date filters
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={fetchReport}
            style={{
              padding: "9px 14px", borderRadius: "10px",
              background: "#FFFFFF", border: "1px solid #E2E8F0",
              color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: 600, boxShadow: "0 2px 6px rgba(15,23,42,0.04)"
            }}
          >
            <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
            Refresh
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            style={{
              padding: "9px 16px", borderRadius: "10px",
              background: "#0D9488", border: "none", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(13,148,136,0.25)",
              opacity: exportingPdf ? 0.6 : 1,
            }}
          >
            <Download size={14} />
            {exportingPdf ? "Generating PDF..." : "Export as PDF"}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || loading}
            style={{
              padding: "9px 16px", borderRadius: "10px",
              background: "#059669", border: "none", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700,
              boxShadow: "0 4px 14px rgba(5,150,105,0.25)",
              opacity: exportingExcel ? 0.6 : 1,
            }}
          >
            <FileSpreadsheet size={14} />
            {exportingExcel ? "Generating Excel..." : "Export as Excel"}
          </button>
        </div>
      </div>

      {/* Report Types Tabs */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${allowedReports.length}, 1fr)`, gap: "10px", marginBottom: "20px" }}>
        {allowedReports.map((r) => {
          const Icon = r.icon;
          const isSelected = activeReport === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: isSelected ? "linear-gradient(135deg, #0D9488, #0F766E)" : "#FFFFFF",
                border: isSelected ? "1px solid #0D9488" : "1px solid #E2E8F0",
                color: isSelected ? "white" : "#1E293B",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isSelected ? "0 4px 14px rgba(13,148,136,0.2)" : "0 2px 6px rgba(15,23,42,0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Icon size={16} color={isSelected ? "white" : "#0D9488"} />
                <span style={{ fontWeight: 800, fontSize: "13px" }}>{r.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: isSelected ? "rgba(255,255,255,0.85)" : "#64748B", lineHeight: "1.3" }}>
                {r.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Enhanced Date Range & Filter Controls Bar */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "18px 20px",
        marginBottom: "20px", display: "flex", flexDirection: "column", gap: "14px",
        boxShadow: "0 2px 8px rgba(15,23,42,0.03)"
      }}>
        {/* Row 1: Week Presets & Monthly Dropdown */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          {/* Preset Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
              <CalendarDays size={14} color="#0D9488" />
              TIMEFRAME:
            </span>

            <button
              onClick={() => handleDatePreset("this_week")}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                background: datePreset === "this_week" ? "rgba(13,148,136,0.12)" : "#F8FAFC",
                color: datePreset === "this_week" ? "#0D9488" : "#475569",
                border: datePreset === "this_week" ? "1px solid rgba(13,148,136,0.3)" : "1px solid #E2E8F0",
                cursor: "pointer",
              }}
            >
              Current Week
            </button>

            <button
              onClick={() => handleDatePreset("prev_week")}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                background: datePreset === "prev_week" ? "rgba(13,148,136,0.12)" : "#F8FAFC",
                color: datePreset === "prev_week" ? "#0D9488" : "#475569",
                border: datePreset === "prev_week" ? "1px solid rgba(13,148,136,0.3)" : "1px solid #E2E8F0",
                cursor: "pointer",
              }}
            >
              Previous Week
            </button>

            <button
              onClick={() => handleDatePreset("today")}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                background: datePreset === "today" ? "rgba(13,148,136,0.12)" : "#F8FAFC",
                color: datePreset === "today" ? "#0D9488" : "#475569",
                border: datePreset === "today" ? "1px solid rgba(13,148,136,0.3)" : "1px solid #E2E8F0",
                cursor: "pointer",
              }}
            >
              Today
            </button>

            <button
              onClick={() => handleDatePreset("30d")}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                background: datePreset === "30d" ? "rgba(13,148,136,0.12)" : "#F8FAFC",
                color: datePreset === "30d" ? "#0D9488" : "#475569",
                border: datePreset === "30d" ? "1px solid rgba(13,148,136,0.3)" : "1px solid #E2E8F0",
                cursor: "pointer",
              }}
            >
              Last 30 Days
            </button>
          </div>

          {/* Monthly Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
              MONTHLY:
            </span>
            <div style={{ position: "relative" }}>
              <select
                value={selectedMonth}
                onChange={handleMonthDropdownChange}
                style={{
                  padding: "7px 28px 7px 12px", borderRadius: "8px",
                  border: datePreset === "monthly" ? "1px solid #0D9488" : "1px solid #CBD5E1",
                  background: datePreset === "monthly" ? "rgba(13,148,136,0.06)" : "#FFFFFF",
                  fontSize: "12px", fontWeight: 700, color: "#0F172A",
                  cursor: "pointer", outline: "none", appearance: "none",
                }}
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748B" }} />
            </div>
          </div>
        </div>

        {/* Row 2: Custom Date Range (Start Date -> End Date) Filter */}
        <div style={{
          paddingTop: "12px",
          borderTop: "1px dashed #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488", textTransform: "uppercase" }}>
              CUSTOM DATE RANGE:
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                style={{
                  padding: "6px 10px", borderRadius: "8px", border: "1px solid #CBD5E1",
                  fontSize: "12px", fontWeight: 600, color: "#0F172A", outline: "none"
                }}
              />
            </div>

            <ArrowRight size={14} color="#94A3B8" />

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                style={{
                  padding: "6px 10px", borderRadius: "8px", border: "1px solid #CBD5E1",
                  fontSize: "12px", fontWeight: 600, color: "#0F172A", outline: "none"
                }}
              />
            </div>
          </div>

          {/* Active Period Display Badge */}
          <div style={{
            background: "#F1F5F9",
            padding: "4px 10px",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: 700,
            color: "#334155",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <Calendar size={13} color="#0D9488" />
            <span>Active Range: <strong>{startDate}</strong> to <strong>{endDate}</strong></span>
          </div>
        </div>
      </div>

      {/* On-Screen Report Preview Area */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#64748B", background: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
          <RefreshCw size={24} style={{ animation: "spin 0.8s linear infinite", marginBottom: "12px" }} />
          <p style={{ fontWeight: 700, margin: 0 }}>Generating report preview...</p>
        </div>
      ) : reportData ? (
        <div>
          {/* Summary KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" }}>
            {activeReport === "fleet-utilization" && (
              <>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>TOTAL VEHICLES</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", margin: "4px 0 0" }}>{reportData.total_vehicles}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488" }}>UTILIZATION RATE</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#0D9488", margin: "4px 0 0" }}>{reportData.utilization_rate}%</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>ACTIVE VEHICLES</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#059669", margin: "4px 0 0" }}>{reportData.active_vehicles}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5" }}>TOTAL TRIPS</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#4F46E5", margin: "4px 0 0" }}>{reportData.total_trips_in_period}</p>
                </div>
              </>
            )}

            {activeReport === "fuel-consumption" && (
              <>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>TOTAL SPEND</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#059669", margin: "4px 0 0" }}>${reportData.total_fuel_cost}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488" }}>TOTAL VOLUME</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#0D9488", margin: "4px 0 0" }}>{reportData.total_fuel_liters} L</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>AVG COST / LITER</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#D97706", margin: "4px 0 0" }}>${reportData.avg_cost_per_liter}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5" }}>TOTAL REFILLS</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#4F46E5", margin: "4px 0 0" }}>{reportData.total_refills}</p>
                </div>
              </>
            )}

            {activeReport === "driver-performance" && (
              <>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>DRIVERS ANALYZED</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", margin: "4px 0 0" }}>{reportData.total_drivers_analyzed}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488" }}>COMPLETION RATE</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#0D9488", margin: "4px 0 0" }}>{reportData.overall_completion_rate}%</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5" }}>TOTAL TRIPS RUN</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#4F46E5", margin: "4px 0 0" }}>{reportData.total_trips}</p>
                </div>
              </>
            )}

            {activeReport === "delivery-performance" && (
              <>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>TOTAL SHIPMENTS</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", margin: "4px 0 0" }}>{reportData.total_shipments}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>ON-TIME RATE</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#059669", margin: "4px 0 0" }}>{reportData.on_time_delivery_rate_pct}%</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#DC2626" }}>DELAYED</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#DC2626", margin: "4px 0 0" }}>{reportData.delayed_count}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5" }}>CARGO WEIGHT</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#4F46E5", margin: "4px 0 0" }}>{reportData.total_cargo_weight_kg} kg</p>
                </div>
              </>
            )}

            {activeReport === "maintenance" && (
              <>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>TOTAL EXPENSE</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#D97706", margin: "4px 0 0" }}>${reportData.total_maintenance_expense}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669" }}>RESOLVED SERVICES</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#059669", margin: "4px 0 0" }}>{reportData.resolved_services}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#DC2626" }}>PENDING / SCHEDULED</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#DC2626", margin: "4px 0 0" }}>{reportData.pending_scheduled_services}</p>
                </div>
                <div style={{ padding: "16px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#4F46E5" }}>TOTAL RECORDS</span>
                  <p style={{ fontSize: "22px", fontWeight: 900, color: "#4F46E5", margin: "4px 0 0" }}>{reportData.total_records}</p>
                </div>
              </>
            )}
          </div>

          {/* Table Search & Preview Container */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FAFAFA" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={16} color="#0D9488" />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                  {reportData.report_title} Preview ({filteredRows.length} rows)
                </h3>
              </div>

              <div style={{ position: "relative", width: "240px" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                <input
                  placeholder="Filter rows..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 10px 7px 30px", borderRadius: "8px", border: "1px solid #CBD5E1",
                    fontSize: "12px", outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                <p style={{ fontWeight: 700, margin: 0 }}>No records found for the selected criteria.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                    {Object.keys(filteredRows[0] || {})
                      .filter((k) => !k.includes("id"))
                      .map((h) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                          {h.replace(/_/g, " ")}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                      {Object.entries(row)
                        .filter(([k]) => !k.includes("id"))
                        .map(([k, val], cIdx) => (
                          <td key={cIdx} style={{ padding: "12px 16px", fontSize: "12px", color: "#1E293B", fontWeight: cIdx === 0 ? 700 : 500 }}>
                            {String(val)}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Reports;
