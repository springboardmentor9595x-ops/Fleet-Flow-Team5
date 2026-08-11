import React, { useState, useEffect } from 'react';
import { createVehicle, updateVehicle } from '../../api/vehicles';
import { toast } from 'react-toastify';
import { X, Truck } from 'lucide-react';

export default function VehicleModal({ isOpen, onClose, onSaved, vehicle = null }) {
  const isEdit = Boolean(vehicle);
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
        toast.success(`Vehicle ${formData.registration_number} updated successfully.`);
      } else {
        await createVehicle(payload);
        toast.success(`Vehicle ${formData.registration_number} added to fleet.`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to save vehicle.';
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
            <Truck size={22} color="var(--accent-primary)" />
            <h2>{isEdit ? 'Edit Fleet Vehicle' : 'Add New Vehicle'}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Registration Number / Plate *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter registration number"
              value={formData.registration_number}
              onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Vehicle Type</label>
              <select
                className="form-select"
                value={formData.vehicle_type}
                onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
              >
                <option value="Semi-Truck">Semi-Truck</option>
                <option value="Heavy Truck">Heavy Truck</option>
                <option value="Box Truck">Box Truck</option>
                <option value="Cargo Van">Cargo Van</option>
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
                <option value="In Transit">In Transit</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Out of Service">Out of Service</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Brand / Make</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter vehicle brand / make"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Model</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter vehicle model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input
                type="number"
                className="form-input"
                placeholder="Enter year"
                value={formData.manufacture_year}
                onChange={(e) => setFormData({ ...formData, manufacture_year: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fuel Type</label>
              <select
                className="form-select"
                value={formData.fuel_type}
                onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
              >
                <option value="Diesel">Diesel</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Gasoline">Gasoline</option>
                <option value="CNG">CNG</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Capacity (kg)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Enter capacity (kg)"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
