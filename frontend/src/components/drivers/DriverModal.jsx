import React, { useState, useEffect } from 'react';
import { registerDriver, updateDriver } from '../../api/drivers';
import { getUsers } from '../../api/users';
import { toast } from 'react-toastify';
import { X, UserCheck } from 'lucide-react';

export default function DriverModal({ isOpen, onClose, onSaved, driver = null }) {
  const isEdit = Boolean(driver);
  const [driverUsers, setDriverUsers] = useState([]);
  const [formData, setFormData] = useState({
    user_id: '',
    license_number: '',
    experience_years: '2',
    address: '',
    status: 'Active',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !isEdit) {
      // Fetch users with role = Driver to select from
      getUsers({ role: 'Driver' })
        .then((res) => {
          setDriverUsers(res.data || []);
          if (res.data && res.data.length > 0) {
            setFormData((prev) => ({ ...prev, user_id: res.data[0].user_id }));
          }
        })
        .catch(() => {});
    }

    if (driver) {
      setFormData({
        user_id: driver.user_id || '',
        license_number: driver.license_number || '',
        experience_years: driver.experience_years ?? '2',
        address: driver.address || '',
        status: driver.status || 'Active',
      });
    } else {
      setFormData({
        user_id: '',
        license_number: '',
        experience_years: '2',
        address: '',
        status: 'Active',
      });
    }
  }, [driver, isOpen, isEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !formData.user_id) {
      toast.error('Please select a driver user account.');
      return;
    }
    if (!formData.license_number.trim()) {
      toast.error('License number is required.');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await updateDriver(driver.driver_id, {
          license_number: formData.license_number,
          experience_years: formData.experience_years ? parseInt(formData.experience_years) : 0,
          address: formData.address,
          status: formData.status,
        });
        toast.success(`Driver profile for ${driver.full_name || 'driver'} updated.`);
      } else {
        await registerDriver({
          user_id: formData.user_id,
          license_number: formData.license_number,
          experience_years: formData.experience_years ? parseInt(formData.experience_years) : 0,
          address: formData.address,
          status: formData.status,
        });
        toast.success('Driver profile registered successfully.');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to save driver profile.';
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
            <UserCheck size={22} color="var(--accent-primary)" />
            <h2>{isEdit ? 'Edit Driver Profile' : 'Register Driver Profile'}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Link Driver User Account *</label>
              <select
                className="form-select"
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                required
              >
                <option value="">Select User with Role Driver</option>
                {driverUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEdit && (
            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input
                type="text"
                className="form-input"
                value={driver.full_name || driver.email || ''}
                disabled
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">License Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. DL-98765432"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Experience (Years)</label>
              <input
                type="number"
                min="0"
                max="50"
                className="form-input"
                placeholder="Years of experience"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Suspended">Suspended</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Address / Station Base</label>
              <input
                type="text"
                className="form-input"
                placeholder="City or Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Profile' : 'Register Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
