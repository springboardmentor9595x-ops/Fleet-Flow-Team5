import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ShipmentModal from '../components/shipments/ShipmentModal';
import ShipmentStepper from '../components/shipments/ShipmentStepper';
import { getShipments, updateShipmentStatus, cancelShipment, getDelayedAlerts } from '../api/shipments';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Navigation, 
  Ban, 
  Clock, 
  CheckCircle2,
  User,
  Edit
} from 'lucide-react';
import './ShipmentsPage.css';

import { useSearchParams } from 'react-router-dom';

export default function ShipmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'ALL';
  const [statusFilter, setStatusFilter] = useState(currentTab);
  const [shipments, setShipments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Sync tab with URL search param
  const handleTabChange = (tab) => {
    setStatusFilter(tab);
    setSearchParams({ tab });
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);

  const canManage = user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Dispatcher';
  const canViewAlerts = user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Dispatcher';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchPromises = [getShipments(statusFilter !== 'ALL' ? { status: statusFilter } : {})];
      if (canViewAlerts) {
        fetchPromises.push(getDelayedAlerts());
      }
      const results = await Promise.all(fetchPromises);
      setShipments(results[0].data);
      if (canViewAlerts && results[1]) {
        setAlerts(results[1].data);
      }
    } catch (err) {
      toast.error('Failed to load shipments.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, canViewAlerts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdvanceStatus = async (shipment) => {
    let nextStatus = 'Assigned';
    if (shipment.status === 'Created') nextStatus = 'Assigned';
    else if (shipment.status === 'Assigned') nextStatus = 'In Transit';
    else if (shipment.status === 'In Transit' || shipment.status === 'Delayed') nextStatus = 'Delivered';
    else return;

    try {
      await updateShipmentStatus(shipment.shipment_id, nextStatus);
      toast.success(`Shipment ${shipment.tracking_number} updated to ${nextStatus}.`);
      fetchData();
    } catch (err) {
      toast.error('Failed to advance status.');
    }
  };

  const handleCancel = async (shipmentId, trackingNum) => {
    if (!window.confirm(`Cancel shipment ${trackingNum}?`)) return;
    try {
      await cancelShipment(shipmentId);
      toast.info(`Shipment ${trackingNum} cancelled.`);
      fetchData();
    } catch (err) {
      toast.error('Failed to cancel shipment.');
    }
  };

  const filteredShipments = shipments.filter((s) => {
    const term = searchTerm.toLowerCase();
    const trk = (s.tracking_number || '').toLowerCase();
    const cust = (s.customer_name || '').toLowerCase();
    const src = (s.source || '').toLowerCase();
    const dst = (s.destination || '').toLowerCase();
    const drv = (s.driver_name || '').toLowerCase();
    return trk.includes(term) || cust.includes(term) || src.includes(term) || dst.includes(term) || drv.includes(term);
  });

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase().replace(/ /g, '');
    if (s === 'delivered') return <span className="status-pill status-delivered">Delivered</span>;
    if (s === 'intransit') return <span className="status-pill status-intransit">In Transit</span>;
    if (s === 'delayed') return <span className="status-pill status-delayed">Delayed</span>;
    if (s === 'assigned') return <span className="status-pill status-assigned">Assigned</span>;
    if (s === 'cancelled') return <span className="status-pill status-cancelled">Cancelled</span>;
    return <span className="status-pill status-created">Created</span>;
  };

  return (
    <div className="shipments-page-wrapper">
      <main className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Shipment Tracking & Logistics</h1>
            <p>Track delivery stages, dispatch routes and manage freight orders</p>
          </div>

          {canManage && (
            <div className="header-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedShipment(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus size={18} />
                <span>Create Shipment</span>
              </button>
            </div>
          )}
        </div>

        {/* Delayed Shipments Alert Bar */}
        {alerts.length > 0 && (
          <div className="delayed-alert-banner">
            <div className="alert-badge-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="alert-text-body">
              <strong>{alerts.length} Shipment(s) Require Attention:</strong>
              <span> {alerts.map((a) => a.tracking_number).join(', ')} exceeded or approaching delivery window.</span>
            </div>
          </div>
        )}

        {/* Controls Card */}
        <div className="table-controls-card ff-card">
          <div className="search-box">
            <Search size={18} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Search tracking #, driver, customer, source, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="status-filter-tabs">
            {['ALL', 'Created', 'Assigned', 'In Transit', 'Delayed', 'Delivered', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                className={`filter-tab ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => handleTabChange(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Shipments List */}
        <div className="shipments-list-container">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading shipments...
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="ff-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Package size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>{searchTerm || statusFilter !== 'ALL' ? 'No shipments found matching your filters.' : 'No shipments found.'}</p>
            </div>
          ) : (
            filteredShipments.map((s) => {
              const isExpanded = expandedId === s.shipment_id;
              const isDelayed = alerts.some((a) => a.shipment_id === s.shipment_id && a.is_delayed);

              return (
                <div key={s.shipment_id} className={`shipment-card ff-card ${isDelayed ? 'border-delayed' : ''}`}>
                  <div className="shipment-card-header" onClick={() => setExpandedId(isExpanded ? null : s.shipment_id)}>
                    <div className="shipment-primary-info">
                      <div className="tracking-number-badge">
                        <Package size={16} />
                        <span>{s.tracking_number}</span>
                      </div>
                      <div className="route-preview">
                        <span className="location-name">{s.source || 'Origin'}</span>
                        <ArrowRight size={14} color="var(--text-dim)" />
                        <span className="location-name">{s.destination || 'Destination'}</span>
                      </div>
                    </div>

                    <div className="shipment-secondary-info">
                      <div className="customer-tag">
                        <span>{s.customer_name}</span>
                        {s.shipment_weight && <span className="weight-pill">{s.shipment_weight} kg</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <User size={14} color="var(--accent-primary)" />
                        <span>{s.driver_name || 'Unassigned Driver'}</span>
                      </div>

                      {getStatusBadge(s.status)}

                      <button className="expand-toggle-btn">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Stepper and Action Details */}
                  {isExpanded && (
                    <div className="shipment-card-expanded">
                      {/* Delivery Stepper */}
                      <ShipmentStepper status={s.status} isDelayed={isDelayed} />

                      <div className="shipment-meta-grid">
                        <div>
                          <span className="meta-label">Assigned Driver</span>
                          <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={13} color="var(--accent-primary)" />
                            <strong>{s.driver_name || 'Unassigned'}</strong>
                          </span>
                        </div>
                        <div>
                          <span className="meta-label">Customer Contact</span>
                          <span className="meta-val">{s.customer_phone || s.customer_email || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="meta-label">Expected Window</span>
                          <span className="meta-val">
                            {s.expected_delivery_time
                              ? new Date(s.expected_delivery_time).toLocaleString()
                              : 'Not specified'}
                          </span>
                        </div>
                        <div>
                          <span className="meta-label">Special Notes</span>
                          <span className="meta-val">{s.notes || 'Standard handling'}</span>
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div className="shipment-actions-footer">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/live-map?shipment=${s.shipment_id}`)}
                        >
                          <Navigation size={14} />
                          <span>Track on Live Map</span>
                        </button>

                        {canManage && s.status !== 'Delivered' && s.status !== 'Cancelled' && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedShipment(s);
                                setIsModalOpen(true);
                              }}
                            >
                              <User size={14} />
                              <span>{s.driver_id ? 'Edit / Reassign' : 'Assign Driver'}</span>
                            </button>

                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAdvanceStatus(s)}
                            >
                              <CheckCircle2 size={14} />
                              <span>
                                {s.status === 'Created' ? 'Mark Assigned' : s.status === 'Assigned' ? 'Start Transit' : 'Mark Delivered'}
                              </span>
                            </button>

                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleCancel(s.shipment_id, s.tracking_number)}
                            >
                              <Ban size={14} />
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Shipment Modal */}
      <ShipmentModal
        isOpen={isModalOpen}
        shipment={selectedShipment}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedShipment(null);
        }}
        onSaved={fetchData}
      />
    </div>
  );
}
