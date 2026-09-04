import React, { useState, useEffect } from 'react';
import { markAttendance } from '../../api/attendance';
import { getDrivers } from '../../api/drivers';
import { toast } from 'react-toastify';
import { X, CalendarCheck } from 'lucide-react';

export default function AttendanceModal({ isOpen, onClose, onSaved, preselectedDriver = null }) {
  const [drivers, setDrivers] = useState([]);
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const [formData, setFormData] = useState({
    driver_id: '',
    date: todayStr,
    status: 'Present',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (preselectedDriver) {
        setFormData({
          driver_id: preselectedDriver.driver_id,
          date: todayStr,
          status: 'Present',
        });
      } else {
        getDrivers()
          .then((res) => {
            setDrivers(res.data || []);
            if (res.data && res.data.length > 0) {
              setFormData((prev) => ({
                ...prev,
                driver_id: res.data[0].driver_id,
                date: todayStr,
                status: 'Present',
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, preselectedDriver, todayStr]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.driver_id) {
      toast.error('Please select a driver.');
      return;
    }
    if (!formData.date) {
      toast.error('Please select a date.');
      return;
    }

    setLoading(true);
    try {
      await markAttendance({
        driver_id: formData.driver_id,
        date: formData.date,
        status: formData.status,
      });
      toast.success(`Attendance marked as '${formData.status}' for date ${formData.date}.`);
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to mark attendance.';
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
            <CalendarCheck size={22} color="var(--accent-primary)" />
            <h2>Mark Driver Attendance</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {preselectedDriver ? (
            <div className="form-group">
              <label className="form-label">Selected Driver</label>
              <input
                type="text"
                className="form-input"
                value={`${preselectedDriver.full_name || 'Driver'} (${preselectedDriver.license_number || 'No license'})`}
                disabled
              />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Select Driver *</label>
              <select
                className="form-select"
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                required
              >
                <option value="">Select Driver</option>
                {drivers.map((d) => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.full_name || 'Driver'} — {d.license_number || 'No License'} ({d.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Attendance Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attendance Status *</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Present">Present</option>
                <option value="Leave">On Leave</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
