import React, { useState, useEffect } from 'react';
import { createVehicle, updateVehicle } from '../../api/vehicles';
import { getMaintenance } from '../../api/maintenance';
import { getFuelRecords } from '../../api/fuel';
import { getTrips } from '../../api/trips';
import { toast } from 'react-toastify';
import { X, Truck, Wrench, Fuel as FuelIcon, Navigation, History, Info } from 'lucide-react';

export default function VehicleModal({ isOpen, onClose, onSaved, vehicle = null }) {
  const isEdit = Boolean(vehicle);
  const [detailTab, setDetailTab] = useState('Overview');

  const [formData, setFormData] = useState({
    registration_number: '',
    vehicle_type: 'Heavy Truck',
    brand: '',
    model: '',
    manufacture_year: '',
    fuel_type: 'Diesel',
    capacity: '',
    status: 'Available',
  });

  const [loading, setLoading] = useState(false);
  const [maintLogs, setMaintLogs] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [tripLogs, setTripLogs] = useState([]);

  useEffect(() => {
    if (vehicle) {
      setFormData({
        registration_number: vehicle.registration_number || '',
        vehicle_type: vehicle.vehicle_type || 'Heavy Truck',
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        manufacture_year: vehicle.manufacture_year || '',
        fuel_type: vehicle.fuel_type || 'Diesel',
        capacity: vehicle.capacity ?? '',
        status: vehicle.status || 'Available',
      });

      // Fetch linked vehicle logs for detail tabs
      Promise.all([
        getMaintenance().catch(() => ({ data: [] })),
        getFuelRecords().catch(() => ({ data: [] })),
        getTrips().catch(() => ({ data: [] }))
      ]).then(([mRes, fRes, tRes]) => {
        const vId = vehicle.vehicle_id || vehicle.id;
        const reg = vehicle.registration_number;
        setMaintLogs((mRes.data || []).filter(m => m.vehicle_id === vId || m.registration_number === reg));
        setFuelLogs((fRes.data || []).filter(f => f.vehicle_id === vId || f.registration_number === reg));
        setTripLogs((tRes.data || []).filter(t => t.vehicle_id === vId));
      });
    } else {
      setFormData({
        registration_number: '',
        vehicle_type: 'Heavy Truck',
        brand: '',
        model: '',
        manufacture_year: '',
        fuel_type: 'Diesel',
        capacity: '',
        status: 'Available',
      });
    }
  }, [vehicle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.registration_number.trim()) {
      toast.error('Registration number is required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        manufacture_year: formData.manufacture_year ? parseInt(formData.manufacture_year) : null,
        capacity: formData.capacity ? parseFloat(formData.capacity) : null,
      };

      if (isEdit) {
        await updateVehicle(vehicle.vehicle_id, payload);
        toast.success(`Vehicle ${formData.registration_number} updated.`);
      } else {
        await createVehicle(payload);
        toast.success(`Vehicle ${formData.registration_number} added.`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save vehicle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={22} color="var(--accent-primary)" />
            <h2>{isEdit ? `Vehicle Details: ${vehicle?.registration_number}` : 'Add New Vehicle'}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Internal Detail Tabs */}
        {isEdit && (
          <div className="dashboard-nav-tabs" style={{ marginBottom: '1.25rem' }}>
            {['Overview', 'Trips', 'Maintenance', 'Fuel', 'History'].map((tab) => (
              <button
                key={tab}
                className={`dash-tab-btn ${detailTab === tab ? 'active' : ''}`}
                onClick={() => setDetailTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* TAB 1: OVERVIEW & FORM */}
        {detailTab === 'Overview' && (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <label className="form-label">Registration Number / Plate *</label>
              <input
                type="text"
                className="form-input"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                >
                  <option value="Heavy Truck">Heavy Truck</option>
                  <option value="Light Cargo Van">Light Cargo Van</option>
                  <option value="Semi Trailer">Semi Trailer</option>
                  <option value="Refrigerated Van">Refrigerated Van</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Available">Available</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Out of Service">Out of Service</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Model</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : isEdit ? 'Update Vehicle' : 'Add Vehicle'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: TRIPS */}
        {detailTab === 'Trips' && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {tripLogs.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No trips logged for this vehicle yet.</p>
            ) : (
              <table className="att-table">
                <thead>
                  <tr><th>Route</th><th>Distance</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {tripLogs.map(t => (
                    <tr key={t.trip_id}>
                      <td>{t.start_location} &rarr; {t.destination}</td>
                      <td>{t.planned_distance_km} km</td>
                      <td><span className="status-badge badge-present">{t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: MAINTENANCE */}
        {detailTab === 'Maintenance' && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {maintLogs.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No maintenance records for this vehicle.</p>
            ) : (
              <table className="att-table">
                <thead>
                  <tr><th>Service</th><th>Date</th><th>Cost</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {maintLogs.map(m => (
                    <tr key={m.maintenance_id || m.id}>
                      <td>{m.service_type}</td>
                      <td>{m.service_date}</td>
                      <td>${m.cost}</td>
                      <td><span className="status-badge badge-leave">{m.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 4: FUEL */}
        {detailTab === 'Fuel' && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {fuelLogs.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No fuel logs recorded for this vehicle.</p>
            ) : (
              <table className="att-table">
                <thead>
                  <tr><th>Liters</th><th>Cost</th><th>Date</th><th>Station</th></tr>
                </thead>
                <tbody>
                  {fuelLogs.map(f => (
                    <tr key={f.fuel_id || f.id}>
                      <td>{f.liters} L</td>
                      <td>${f.cost}</td>
                      <td>{f.fuel_date ? new Date(f.fuel_date).toLocaleDateString() : '--'}</td>
                      <td>{f.fuel_station || 'Station'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 5: HISTORY */}
        {detailTab === 'History' && (
          <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '0.5rem', color: '#94a3b8' }}>
            <p><strong>Total Trips Completed:</strong> {tripLogs.filter(t => t.status === 'Completed').length}</p>
            <p><strong>Total Maintenance Services:</strong> {maintLogs.length}</p>
            <p><strong>Total Fuel Refueling Events:</strong> {fuelLogs.length}</p>
          </div>
        )}
      </div>
    </div>
  );
}
