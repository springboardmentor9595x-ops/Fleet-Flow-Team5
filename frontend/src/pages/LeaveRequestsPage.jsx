import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getLeaveRequests,
  submitLeaveRequest,
  reviewLeaveRequest,
  cancelLeaveRequest,
} from '../api/leave';
import { getDrivers } from '../api/drivers';
import { toast } from 'react-toastify';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  X,
  Filter,
  Check,
  Ban,
  FileText,
  Eye,
  AlertCircle
} from 'lucide-react';
import './LeaveRequestsPage.css';

import { useSearchParams } from 'react-router-dom';

export default function LeaveRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = (user?.role || '').trim().toLowerCase();
  const isDriver = userRole === 'driver';
  const isAdmin = userRole === 'admin';
  const isFleetManager = userRole === 'fleetmanager';
  const isDispatcher = userRole === 'dispatcher';
  const canApproveReject = isAdmin || isFleetManager;

  const currentTab = searchParams.get('tab') || (isDriver ? 'My Requests' : 'All');
  const [statusFilter, setStatusFilter] = useState(currentTab);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleTabChange = (tabName) => {
    setStatusFilter(tabName);
    setSearchParams({ tab: tabName });
  };

  // Request Leave Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [driversList, setDriversList] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [formData, setFormData] = useState({
    leave_type: 'Casual Leave',
    start_date: '',
    end_date: '',
    reason: '',
  });

  // Reject Modal State (Admin/Manager)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // View Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'All') {
        params.status = statusFilter;
      }
      const res = await getLeaveRequests(params);
      setRequests(res.data || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Failed to load leave requests.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchRequests();
    }
  }, [authLoading, user, fetchRequests]);

  // Load drivers list when Admin or FleetManager opens create modal
  useEffect(() => {
    if (showCreateModal && canApproveReject) {
      getDrivers()
        .then((res) => setDriversList(res.data || []))
        .catch((err) => console.error('Failed to load drivers for selection:', err));
    }
  }, [showCreateModal, canApproveReject]);

  // Handle Submit New Leave Request
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!isDriver && !selectedDriverId) {
      toast.error('Please select a driver.');
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error('Please select both start date and end date.');
      return;
    }
    if (formData.start_date > formData.end_date) {
      toast.error('End date cannot be before start date.');
      return;
    }
    if (!formData.reason.trim()) {
      toast.error('Please enter a reason for the leave request.');
      return;
    }

    setSubmitting(true);
    try {
      await submitLeaveRequest(formData, isDriver ? null : selectedDriverId);
      toast.success('Leave request submitted successfully!');
      setShowCreateModal(false);
      setSelectedDriverId('');
      setFormData({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: '',
      });
      fetchRequests();
    } catch (err) {
      console.error('Create leave error:', err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.[0]?.msg || 'Failed to submit leave request.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Approve Request (Admin / FleetManager only)
  const handleApprove = async (leaveId) => {
    if (!canApproveReject) {
      toast.error('Access forbidden: Only Admin and Fleet Manager can approve leave requests.');
      return;
    }
    try {
      await reviewLeaveRequest(leaveId, { status: 'Approved' });
      toast.success('Leave request approved! Attendance updated to Leave.');
      fetchRequests();
    } catch (err) {
      console.error('Approve error:', err);
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to approve leave request.');
    }
  };

  // Open Reject Modal
  const openRejectModal = (leaveId) => {
    if (!canApproveReject) {
      toast.error('Access forbidden: Only Admin and Fleet Manager can reject leave requests.');
      return;
    }
    setRejectingLeaveId(leaveId);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  // Open Details Modal
  const openDetailsModal = (leaveItem) => {
    setSelectedLeave(leaveItem);
    setShowDetailsModal(true);
  };

  // Submit Reject Request (Admin / FleetManager only)
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!canApproveReject) {
      toast.error('Access forbidden: Only Admin and Fleet Manager can reject leave requests.');
      return;
    }
    if (!rejectingLeaveId) return;

    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }

    setRejecting(true);
    try {
      await reviewLeaveRequest(rejectingLeaveId, {
        status: 'Rejected',
        rejection_reason: rejectionReason.trim(),
      });
      toast.success('Leave request rejected.');
      setShowRejectModal(false);
      setRejectingLeaveId(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err) {
      console.error('Reject error:', err);
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to reject leave request.');
    } finally {
      setRejecting(false);
    }
  };

  // Cancel Pending Request (Driver only)
  const handleCancelOwn = async (leaveId) => {
    if (!isDriver) {
      toast.error('Access forbidden: Only Drivers can cancel their own pending leave requests.');
      return;
    }
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await cancelLeaveRequest(leaveId);
      toast.success('Leave request cancelled.');
      fetchRequests();
    } catch (err) {
      console.error('Cancel error:', err);
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to cancel leave request.');
    }
  };

  if (authLoading) {
    return (
      <div className="leave-page-container">
        <div className="empty-state-box" style={{ padding: '60px', textAlign: 'center' }}>
          Loading leave request page...
        </div>
      </div>
    );
  }

  // Calculate statistics
  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'Rejected').length;
  const totalCount = requests.length;

  return (
    <div className="leave-page-container">
      {/* Page Header */}
      <div className="leave-page-header">
        <div className="leave-header-title">
          <Calendar size={28} style={{ color: 'var(--accent-cyan)' }} />
          <div>
            <h1>
              {isDriver
                ? 'My Leave Requests'
                : isDispatcher
                ? 'Fleet Leave Schedule Overview'
                : 'Driver Leave Requests'}
            </h1>
            <p className="leave-header-subtitle">
              {isDriver
                ? 'Submit and track your own leave requests.'
                : isDispatcher
                ? 'View driver leave schedules for route and dispatch operational planning'
                : 'Review, approve, or reject fleet driver leave applications'}
            </p>
          </div>
        </div>

        {isDriver ? (
          <button className="btn-request-leave" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            <span>Request Leave</span>
          </button>
        ) : canApproveReject ? (
          <button className="btn-request-leave" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            <span>Submit Leave for Driver</span>
          </button>
        ) : (
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '8px 14px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
            Read-only schedule view for Dispatchers. Only Drivers can submit leave requests.
          </div>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="leave-stats-grid">
        <div className="leave-stat-card">
          <div className="leave-stat-info">
            <h3>Pending Requests</h3>
            <div className="leave-stat-number">{pendingCount}</div>
          </div>
          <div className="leave-stat-icon pending">
            <Clock size={24} />
          </div>
        </div>

        <div className="leave-stat-card">
          <div className="leave-stat-info">
            <h3>Approved Leaves</h3>
            <div className="leave-stat-number">{approvedCount}</div>
          </div>
          <div className="leave-stat-icon approved">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="leave-stat-card">
          <div className="leave-stat-info">
            <h3>Rejected</h3>
            <div className="leave-stat-number">{rejectedCount}</div>
          </div>
          <div className="leave-stat-icon rejected">
            <XCircle size={24} />
          </div>
        </div>

        <div className="leave-stat-card">
          <div className="leave-stat-info">
            <h3>Total Applications</h3>
            <div className="leave-stat-number">{totalCount}</div>
          </div>
          <div className="leave-stat-icon total">
            <FileText size={24} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="leave-control-bar">
        <div className="leave-filter-group">
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} /> Filter Status:
          </span>
          {(isDriver ? ['My Requests', 'Pending', 'Approved', 'Rejected', 'Cancelled'] : ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled']).map((st) => (
            <button
              key={st}
              className={`leave-status-tab ${statusFilter === st ? 'active' : ''}`}
              onClick={() => handleTabChange(st === 'My Requests' ? 'All' : st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table Card */}
      <div className="leave-table-card">
        {loading ? (
          <div className="empty-state-box">Loading leave requests...</div>
        ) : requests.length === 0 ? (
          <div className="empty-state-box">
            No leave requests found {statusFilter !== 'All' ? `with status "${statusFilter}"` : ''}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="leave-table">
              <thead>
                <tr>
                  {!isDriver && <th>Driver</th>}
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted / Reviewed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.leave_id}>
                    {!isDriver && (
                      <td>
                        <div className="driver-cell-info">
                          <span className="driver-cell-name">{r.driver_name || 'Driver'}</span>
                          {r.driver_email && <span className="driver-cell-email">{r.driver_email}</span>}
                        </div>
                      </td>
                    )}
                    <td>
                      <strong style={{ color: '#f8fafc' }}>{r.leave_type}</strong>
                    </td>
                    <td>
                      <div>
                        {r.start_date} <span style={{ color: '#64748b' }}>to</span> {r.end_date}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                        {r.days_count} {r.days_count === 1 ? 'Day' : 'Days'}
                      </span>
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#cbd5e1' }} title={r.reason}>
                        {r.reason}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${r.status.toLowerCase()}`}>
                        {r.status === 'Pending' && <Clock size={12} />}
                        {r.status === 'Approved' && <Check size={12} />}
                        {r.status === 'Rejected' && <X size={12} />}
                        {r.status === 'Cancelled' && <Ban size={12} />}
                        {r.status}
                      </span>
                      {r.status === 'Rejected' && r.rejection_reason && (
                        <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>
                          Reason: {r.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        <div>Submitted: {new Date(r.created_at).toLocaleDateString()}</div>
                        {r.reviewed_at && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Reviewed by {r.reviewer_name || 'Admin'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        {canApproveReject && r.status === 'Pending' && (
                          <>
                            <button className="btn-approve" onClick={() => handleApprove(r.leave_id)}>
                              <Check size={14} /> Approve
                            </button>
                            <button className="btn-reject" onClick={() => openRejectModal(r.leave_id)}>
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                        {isDriver && r.status === 'Pending' && (
                          <button className="btn-cancel-own" onClick={() => handleCancelOwn(r.leave_id)}>
                            Cancel Request
                          </button>
                        )}
                        <button className="btn-view-details" onClick={() => openDetailsModal(r)}>
                          <Eye size={14} /> View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave Request Creation Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="leave-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leave-modal-header">
              <h2>{isDriver ? 'Request Leave Application' : 'Submit Leave Application for Driver'}</h2>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="leave-modal-body">
                {!isDriver && (
                  <div className="form-group">
                    <label>Select Driver *</label>
                    <select
                      className="form-select"
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Driver --</option>
                      {driversList.map((d) => (
                        <option key={d.driver_id} value={d.driver_id}>
                          {d.full_name || d.email} {d.license_number ? `(${d.license_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Leave Type *</label>
                  <select
                    className="form-select"
                    value={formData.leave_type}
                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Vacation">Vacation</option>
                    <option value="Emergency Leave">Emergency Leave</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason *</label>
                  <textarea
                    rows={4}
                    className="form-textarea"
                    placeholder="Provide details for leave request..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="leave-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-request-leave" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin / Manager Reject Reason Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="leave-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leave-modal-header">
              <h2>Reject Leave Request</h2>
              <button className="modal-close-btn" onClick={() => setShowRejectModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="leave-modal-body">
                <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                  Please specify the reason for rejecting this driver's leave request:
                </p>
                <div className="form-group">
                  <label>Rejection Reason *</label>
                  <textarea
                    rows={3}
                    className="form-textarea"
                    placeholder="e.g. High shipment volume or conflicting schedule..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="leave-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-reject" disabled={rejecting}>
                  {rejecting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailsModal && selectedLeave && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="leave-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leave-modal-header">
              <h2>Leave Request Details</h2>
              <button className="modal-close-btn" onClick={() => setShowDetailsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="leave-modal-body">
              {!isDriver && (
                <div className="form-group">
                  <label>Driver Information</label>
                  <div className="detail-box">
                    <strong>{selectedLeave.driver_name || 'Driver'}</strong>
                    {selectedLeave.driver_email && (
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        {selectedLeave.driver_email}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Leave Type</label>
                  <div className="detail-box" style={{ fontWeight: 600, color: '#38bdf8' }}>
                    {selectedLeave.leave_type}
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`status-badge ${selectedLeave.status.toLowerCase()}`}>
                      {selectedLeave.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date Range</label>
                  <div className="detail-box">
                    {selectedLeave.start_date} to {selectedLeave.end_date}
                  </div>
                </div>
                <div className="form-group">
                  <label>Total Duration</label>
                  <div className="detail-box">
                    {selectedLeave.days_count} {selectedLeave.days_count === 1 ? 'Day' : 'Days'}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Reason</label>
                <div className="detail-box" style={{ whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
                  {selectedLeave.reason}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Submitted On</label>
                  <div className="detail-box" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    {new Date(selectedLeave.created_at).toLocaleString()}
                  </div>
                </div>
                {selectedLeave.reviewed_at && (
                  <div className="form-group">
                    <label>Reviewed By</label>
                    <div className="detail-box" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      {selectedLeave.reviewer_name || 'Admin'} ({new Date(selectedLeave.reviewed_at).toLocaleDateString()})
                    </div>
                  </div>
                )}
              </div>

              {selectedLeave.status === 'Rejected' && selectedLeave.rejection_reason && (
                <div className="form-group">
                  <label style={{ color: '#f87171' }}>Rejection Reason</label>
                  <div className="detail-box" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                    {selectedLeave.rejection_reason}
                  </div>
                </div>
              )}
            </div>

            <div className="leave-modal-footer">
              {canApproveReject && selectedLeave.status === 'Pending' && (
                <>
                  <button className="btn-approve" onClick={() => { handleApprove(selectedLeave.leave_id); setShowDetailsModal(false); }}>
                    <Check size={14} /> Approve
                  </button>
                  <button className="btn-reject" onClick={() => { setShowDetailsModal(false); openRejectModal(selectedLeave.leave_id); }}>
                    <X size={14} /> Reject
                  </button>
                </>
              )}
              <button type="button" className="btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
