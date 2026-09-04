import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getFleetUtilizationReport,
  getFuelConsumptionReport,
  getDriverPerformanceReport,
  getDeliveryPerformanceReport,
  getMaintenanceReport,
  downloadReportFile,
} from '../api/reports';
import { toast } from 'react-toastify';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  CheckCircle,
  Truck,
  Fuel,
  Users,
  Package,
  Wrench,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from 'lucide-react';
import './ReportsPage.css';

import { useSearchParams } from 'react-router-dom';

export default function ReportsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'fleet';
  const [activeTab, setActiveTab] = useState(currentTab);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  // Date state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('all');

  // Selected report type
  const [selectedReportType, setSelectedReportType] = useState(null);
  
  // Data state
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);

  // Table filter search query
  const [tableSearch, setTableSearch] = useState('');

  // Define reports list per role
  const allReportOptions = [
    {
      id: 'fleet_utilization',
      title: 'Fleet Utilization & Inventory',
      description: 'Vehicle status breakdown, availability rates, and capacity allocation.',
      icon: Truck,
      color: '#22D3EE',
      allowedRoles: ['Admin', 'FleetManager'],
      fetcher: getFleetUtilizationReport,
    },
    {
      id: 'delivery_performance',
      title: 'Logistics & Delivery Performance',
      description: 'On-time delivery rates, delay frequency, and shipment lead times.',
      icon: Package,
      color: '#A855F7',
      allowedRoles: ['Admin', 'FleetManager', 'Dispatcher'],
      fetcher: getDeliveryPerformanceReport,
    },
    {
      id: 'driver_performance',
      title: user?.role === 'Driver' ? 'My Performance Report' : 'Driver Performance Summary',
      description: 'Trips completed, delivery punctuality, and attendance stats.',
      icon: Users,
      color: '#22C55E',
      allowedRoles: ['Admin', 'FleetManager', 'Driver'],
      fetcher: getDriverPerformanceReport,
    },
    {
      id: 'fuel_consumption',
      title: user?.role === 'Driver' ? 'My Vehicle Fuel Expense' : 'Fuel Consumption & Costs',
      description: 'Fuel volume logs, efficiency rates, and total fuel expenditure.',
      icon: Fuel,
      color: '#F59E0B',
      allowedRoles: ['Admin', 'FleetManager', 'Driver'],
      fetcher: getFuelConsumptionReport,
    },
    {
      id: 'maintenance',
      title: 'Maintenance & Service Expense',
      description: 'Vehicle repair logs, service type frequencies, and cost distribution.',
      icon: Wrench,
      color: '#EF4444',
      allowedRoles: ['Admin', 'FleetManager'],
      fetcher: getMaintenanceReport,
    },
  ];

  // Available options for current logged in user
  const availableReports = allReportOptions.filter((r) =>
    r.allowedRoles.includes(user?.role)
  );

  // Set default selected report on load
  useEffect(() => {
    if (availableReports.length > 0 && !selectedReportType) {
      setSelectedReportType(availableReports[0].id);
    }
  }, [availableReports, selectedReportType]);

  const extractErrorMessage = (err, fallback) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail[0]?.msg || fallback;
    }
    return fallback;
  };

  // Load report data when selection or date filter changes
  const fetchReport = async () => {
    if (!selectedReportType) return;
    const currentOpt = allReportOptions.find((r) => r.id === selectedReportType);
    if (!currentOpt) return;

    setLoading(true);
    try {
      const params = {};
      if (startDate && startDate.trim()) params.start_date = startDate.trim();
      if (endDate && endDate.trim()) params.end_date = endDate.trim();

      const res = await currentOpt.fetcher(params);
      setReportData(res.data);
    } catch (err) {
      console.error('Report fetch error:', err);
      const msg = extractErrorMessage(err, 'Failed to generate report preview.');
      toast.error(msg);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReportType, startDate, endDate]);

  // Presets handler
  const handlePreset = (preset) => {
    setActivePreset(preset);
    const today = new Date();

    if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      setStartDate(past30.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'ytd') {
      const firstJan = new Date(today.getFullYear(), 0, 1);
      setStartDate(firstJan.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Export File Download Handler
  const handleExport = async (format) => {
    if (!selectedReportType) return;
    setExportingFormat(format);
    try {
      const params = {};
      if (startDate && startDate.trim()) params.start_date = startDate.trim();
      if (endDate && endDate.trim()) params.end_date = endDate.trim();

      await downloadReportFile(selectedReportType, params, format);
      toast.success(`Successfully exported ${format.toUpperCase()} report!`);
    } catch (err) {
      console.error('Export error:', err);
      const msg = extractErrorMessage(err, 'Failed to export file. Please try again.');
      toast.error(msg);
    } finally {
      setExportingFormat(null);
    }
  };

  // Table rows filter
  const filteredRows = (reportData?.rows || []).filter((row) =>
    row.some((cell) =>
      String(cell || '').toLowerCase().includes(tableSearch.toLowerCase())
    )
  );

  return (
    <div className="reports-page-wrapper">
      <main className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <FileText className="header-icon" size={28} />
              Reports & Exports
            </h1>
            <p className="page-subtitle">
              Generate formatted operational analytics reports and export them as clean PDF documents or Excel spreadsheets.
            </p>
          </div>
        </div>

        {/* Internal Tabs (Scoped to User Role) */}
        <div className="dashboard-nav-tabs" style={{ marginBottom: '1.5rem' }}>
          {(user?.role === 'Admin' || user?.role === 'FleetManager') && (
            <button
              className={`dash-tab-btn ${activeTab === 'fleet' ? 'active' : ''}`}
              onClick={() => {
                handleTabChange('fleet');
                setSelectedReportType('fleet_utilization');
              }}
            >
              Fleet
            </button>
          )}
          {(user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Dispatcher') && (
            <button
              className={`dash-tab-btn ${activeTab === 'logistics' ? 'active' : ''}`}
              onClick={() => {
                handleTabChange('logistics');
                setSelectedReportType('delivery_performance');
              }}
            >
              Logistics
            </button>
          )}
          {(user?.role === 'Admin' || user?.role === 'FleetManager') && (
            <button
              className={`dash-tab-btn ${activeTab === 'maintenance' ? 'active' : ''}`}
              onClick={() => {
                handleTabChange('maintenance');
                setSelectedReportType('maintenance');
              }}
            >
              Maintenance
            </button>
          )}
          {(user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Driver') && (
            <button
              className={`dash-tab-btn ${activeTab === 'fuel' ? 'active' : ''}`}
              onClick={() => {
                handleTabChange('fuel');
                setSelectedReportType('fuel_consumption');
              }}
            >
              Fuel
            </button>
          )}
          {(user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Driver') && (
            <button
              className={`dash-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => {
                handleTabChange('attendance');
                setSelectedReportType('driver_performance');
              }}
            >
              Attendance
            </button>
          )}
        </div>

        {/* Global Date Range Filter Bar */}
        <div className="filter-card ff-card">
          <div className="filter-header">
            <div className="filter-title">
              <Calendar size={18} className="filter-icon" />
              <span>Report Date Range Filter</span>
            </div>
            <div className="preset-buttons">
              <button
                className={`preset-btn ${activePreset === 'all' ? 'active' : ''}`}
                onClick={() => handlePreset('all')}
              >
                All Time
              </button>
              <button
                className={`preset-btn ${activePreset === 'month' ? 'active' : ''}`}
                onClick={() => handlePreset('month')}
              >
                This Month
              </button>
              <button
                className={`preset-btn ${activePreset === '30days' ? 'active' : ''}`}
                onClick={() => handlePreset('30days')}
              >
                Last 30 Days
              </button>
              <button
                className={`preset-btn ${activePreset === 'ytd' ? 'active' : ''}`}
                onClick={() => handlePreset('ytd')}
              >
                Year to Date
              </button>
            </div>
          </div>

          <div className="date-inputs-row">
            <div className="date-field">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
              />
            </div>
            <div className="date-field">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
              />
            </div>
            {(startDate || endDate) && (
              <button className="clear-dates-btn" onClick={() => handlePreset('all')}>
                Clear Dates
              </button>
            )}
          </div>
        </div>

        {/* Report Selection Cards */}
        <div className="report-types-grid">
          {availableReports.map((opt) => {
            const IconComponent = opt.icon;
            const isSelected = selectedReportType === opt.id;
            return (
              <div
                key={opt.id}
                className={`report-type-card ff-card ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedReportType(opt.id);
                  setTableSearch('');
                }}
              >
                <div className="report-card-top">
                  <div className="report-icon-box" style={{ background: `${opt.color}1E`, color: opt.color }}>
                    <IconComponent size={24} />
                  </div>
                  {isSelected && (
                    <span className="active-badge">
                      <CheckCircle size={14} /> Selected
                    </span>
                  )}
                </div>
                <h3 className="report-card-title">{opt.title}</h3>
                <p className="report-card-desc">{opt.description}</p>
              </div>
            );
          })}
        </div>

        {/* Live Preview & Export Section */}
        <div className="preview-container ff-card">
          {/* Action Bar Header */}
          <div className="preview-action-bar">
            <div className="preview-title-area">
              <h2>{reportData?.title || 'Report Preview'}</h2>
              {reportData && (
                <span className="preview-meta">
                  Generated: {reportData.generated_at} | Period: {reportData.period?.start_date} to {reportData.period?.end_date}
                </span>
              )}
            </div>

            {/* Export Buttons */}
            <div className="export-buttons-group">
              <button
                className="export-btn pdf-btn"
                disabled={loading || exportingFormat != null || !reportData}
                onClick={() => handleExport('pdf')}
              >
                {exportingFormat === 'pdf' ? (
                  <Loader2 size={16} className="spin-icon" />
                ) : (
                  <FileText size={16} />
                )}
                <span>Export PDF</span>
              </button>

              <button
                className="export-btn excel-btn"
                disabled={loading || exportingFormat != null || !reportData}
                onClick={() => handleExport('excel')}
              >
                {exportingFormat === 'excel' ? (
                  <Loader2 size={16} className="spin-icon" />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                <span>Export Excel</span>
              </button>

              <button className="refresh-btn" onClick={fetchReport} title="Refresh Preview">
                <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="preview-loading">
              <Loader2 size={32} className="spin-icon text-cyan" />
              <p>Generating report preview...</p>
            </div>
          ) : reportData ? (
            <div className="preview-body">
              {/* Executive Summary Stat Box Grid */}
              {reportData.summary?.length > 0 && (
                <div className="summary-grid">
                  {reportData.summary.map((item, i) => (
                    <div key={i} className="summary-stat-box">
                      <span className="stat-label">{item.label}</span>
                      <strong className="stat-val">{item.value}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Data Table Search & Table */}
              <div className="table-section-header">
                <h3>Detailed Records ({filteredRows.length})</h3>
                <div className="table-search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredRows.length > 0 ? (
                <div className="table-responsive">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        {reportData.columns.map((col, idx) => (
                          <th key={idx}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-records-banner">
                  <FileText size={32} className="no-rec-icon" />
                  <p>No records found matching the filter criteria.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="no-records-banner">
              <FileText size={32} className="no-rec-icon" />
              <p>Select a report type to load preview.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
