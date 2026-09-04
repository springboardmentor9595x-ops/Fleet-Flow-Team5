import React, { useState, useEffect } from 'react';
import { createShipment, updateShipment } from '../../api/shipments';
import { getVehicles } from '../../api/vehicles';
import { getDrivers } from '../../api/drivers';
import { toast } from 'react-toastify';
import { X, Package, MapPin, Truck, Calendar, User } from 'lucide-react';

export default function ShipmentModal({ isOpen, onClose, onSaved, shipment = null }) {
  const isEdit = Boolean(shipment);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [fetchingDrivers, setFetchingDrivers] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    shipment_weight: '',
    vehicle_id: '',
    driver_id: '',
    expected_delivery_time: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setFetchingDrivers(true);
      Promise.all([
        getVehicles().then((res) => setVehicles(res.data || [])).catch(() => {}),
        getDrivers().then((res) => {
          const list = res.data || [];
          setDrivers(list);
          const activeList = list.filter((d) => (d.status || '').toLowerCase() === 'active');
          if (!shipment && activeList.length > 0) {
            setFormData((prev) => ({
              ...prev,
              driver_id: prev.driver_id || activeList[0].driver_id,
            }));
          }
        }).catch(() => {}),
      ]).finally(() => setFetchingDrivers(false));

      if (shipment) {
        setFormData({
          source: shipment.source || '',
          destination: shipment.destination || '',
          customer_name: shipment.customer_name || '',
          customer_phone: shipment.customer_phone || '',
          customer_email: shipment.customer_email || '',
          shipment_weight: shipment.shipment_weight ?? '',
          vehicle_id: shipment.vehicle_id || '',
          driver_id: shipment.driver_id || '',
          expected_delivery_time: shipment.expected_delivery_time
            ? new Date(shipment.expected_delivery_time).toISOString().slice(0, 16)
            : '',
          notes: shipment.notes || '',
        });
      } else {
        setFormData({
          source: '',
          destination: '',
          customer_name: '',
          customer_phone: '',
          customer_email: '',
          shipment_weight: '',
          vehicle_id: '',
          driver_id: '',
          expected_delivery_time: '',
          notes: '',
        });
      }
    }
  }, [isOpen, shipment]);

  if (!isOpen) return null;

  const activeDrivers = drivers.filter(
    (d) => ['active', 'available'].includes((d.status || '').toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.source.trim() || !formData.destination.trim()) {
      toast.error('Source and destination are required.');
      return;
    }
    if (!formData.customer_name.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    if (!formData.driver_id) {
      toast.error('Please select a driver.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        shipment_weight: formData.shipment_weight ? parseFloat(formData.shipment_weight) : 0,
        vehicle_id: formData.vehicle_id ? formData.vehicle_id : null,
        driver_id: formData.driver_id ? formData.driver_id : null,
        expected_delivery_time: formData.expected_delivery_time
          ? new Date(formData.expected_delivery_time).toISOString()
          : null,
      };

      if (isEdit) {
        await updateShipment(shipment.shipment_id, payload);
        toast.success(`Shipment ${shipment.tracking_number} updated.`);
      } else {
        const res = await createShipment(payload);
        toast.success(`Shipment created with tracking #${res.data.tracking_number}`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to save shipment.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={22} color="var(--accent-primary)" />
            <h2>{isEdit ? 'Edit Shipment Order' : 'Create New Shipment'}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Source and Destination */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">
                <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Source / Pickup *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter source location"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Destination / Dropoff *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter destination location"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Customer Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Customer / Recipient *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter customer name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Customer Phone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="Enter customer phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              />
            </div>
          </div>

          {/* Weight & Vehicle / Driver Assignment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Cargo Weight (kg)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Enter weight (kg)"
                value={formData.shipment_weight}
                onChange={(e) => setFormData({ ...formData, shipment_weight: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <User size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Driver *
              </label>
              <select
                className="form-select"
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                required
                disabled={fetchingDrivers}
              >
                <option value="">
                  {fetchingDrivers
                    ? '-- Loading Drivers... --'
                    : activeDrivers.length === 0
                    ? '-- No available drivers. --'
                    : '-- Select Driver --'}
                </option>
                {activeDrivers.map((d) => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.full_name || 'Driver'} {d.license_number ? `(${d.license_number})` : ''} - {d.email || d.status}
                  </option>
                ))}
              </select>
              {activeDrivers.length === 0 && !fetchingDrivers && (
                <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                  No available drivers.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <Truck size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Assign Fleet Vehicle
              </label>
              <select
                className="form-select"
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              >
                <option value="">-- Unassigned (Assign Later) --</option>
                {vehicles.map((v) => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.registration_number} ({v.brand || ''} {v.model || v.vehicle_type}) - {v.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expected Delivery Window */}
          <div className="form-group">
            <label className="form-label">
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Expected Delivery Window
            </label>
            <input
              type="datetime-local"
              className="form-input"
              value={formData.expected_delivery_time}
              onChange={(e) => setFormData({ ...formData, expected_delivery_time: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Special Handling Notes</label>
            <textarea
              rows={2}
              className="form-textarea"
              placeholder="Enter special handling notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : isEdit ? 'Update Shipment' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
