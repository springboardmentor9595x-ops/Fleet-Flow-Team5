import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, changePassword } from '../api/auth';
import { toast } from 'react-toastify';
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Shield,
  Key,
  CheckCircle,
  AlertCircle,
  Lock,
  Truck,
  Award,
  Calendar,
  Save,
  Loader2,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, updateUserProfile, refreshUser } = useAuth();

  // Personal Info Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Populate form with current user data
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setAddress(user.address || '');
      setEmergencyContact(user.emergency_contact || '');
      setProfilePhoto(user.profile_photo || '');
    }
  }, [user]);

  // Calculate Profile Completion %
  const calculateCompletion = () => {
    if (!user) return 0;
    const fields = [
      user.full_name,
      user.email,
      user.phone,
      user.address,
      user.emergency_contact,
      user.profile_photo,
    ];
    const completed = fields.filter((f) => f && String(f).trim().length > 0).length;
    return Math.round((completed / fields.length) * 100);
  };

  const completionPct = calculateCompletion();

  // Save Personal Info
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Full Name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        emergency_contact: emergencyContact.trim() || null,
        profile_photo: profilePhoto.trim() || null,
      });

      updateUserProfile(res.data);
      await refreshUser();
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Profile update error:', err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Failed to update profile.';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      toast.error('Please enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password change error:', err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Failed to change password.';
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-page-wrapper">
        <div className="profile-loading-state">
          <Loader2 size={36} className="spin-icon text-cyan" />
          <p>Loading authenticated user profile...</p>
        </div>
      </div>
    );
  }

  const isDriver = user.role === 'Driver';
  const driverDetails = user.driver_details;

  return (
    <div className="profile-page-wrapper">
      <main className="page-container">
        {/* Header Hero Card */}
        <div className="profile-hero-card ff-card">
          <div className="profile-hero-content">
            <div className="profile-avatar-large">
              {profilePhoto ? (
                <img src={profilePhoto} alt={user.full_name} className="avatar-img" />
              ) : (
                <div className="avatar-initials">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>

            <div className="profile-hero-meta">
              <div className="profile-name-row">
                <h1 className="profile-user-name">{user.full_name}</h1>
                <span className={`role-badge role-${user.role?.toLowerCase()}`}>
                  <Shield size={12} />
                  {user.role === 'FleetManager' ? 'Fleet Manager' : user.role}
                </span>
                <span className="status-badge active-status">
                  <UserCheck size={12} /> Active Account
                </span>
              </div>

              <p className="profile-email-sub">
                <Mail size={14} /> {user.email}
              </p>

              {/* Profile Completion Indicator */}
              <div className="completion-bar-wrapper">
                <div className="completion-bar-header">
                  <span>Profile Completion</span>
                  <strong className="completion-val">{completionPct}%</strong>
                </div>
                <div className="completion-track">
                  <div
                    className="completion-fill"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="profile-grid">
          {/* Left Column: Personal Info Form */}
          <div className="profile-col-main">
            <div className="profile-section-card ff-card">
              <div className="section-card-header">
                <div className="section-title-group">
                  <UserIcon className="section-icon text-cyan" size={20} />
                  <h2>Personal Information</h2>
                </div>
                <span className="section-subtitle">
                  Update your contact details and personal information.
                </span>
              </div>

              <form onSubmit={handleSaveProfile} className="profile-form">
                <div className="form-group">
                  <label htmlFor="full_name">Full Name</label>
                  <input
                    id="full_name"
                    type="text"
                    className="ff-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Email Address <Lock size={12} className="text-amber" title="Read-Only Account Identity" />
                  </label>
                  <div className="readonly-input-wrapper">
                    <input
                      id="email"
                      type="email"
                      className="ff-input readonly"
                      value={user.email}
                      readOnly
                      disabled
                    />
                    <span className="readonly-tag">
                      <Lock size={12} /> Read-Only Identity
                    </span>
                  </div>
                  <span className="input-hint">
                    Email address is your primary account identifier and cannot be modified.
                  </span>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <div className="input-with-icon">
                      <Phone size={16} className="input-icon" />
                      <input
                        id="phone"
                        type="text"
                        className="ff-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="emergency_contact">Emergency Contact</label>
                    <div className="input-with-icon">
                      <PhoneCall size={16} className="input-icon" />
                      <input
                        id="emergency_contact"
                        type="text"
                        className="ff-input"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        placeholder="Contact Person & Phone"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="address">Residential / Postal Address</label>
                  <div className="input-with-icon">
                    <MapPin size={16} className="input-icon" />
                    <input
                      id="address"
                      type="text"
                      className="ff-input"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address, City, Country"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="profile_photo">Profile Photo Image URL (Optional)</label>
                  <input
                    id="profile_photo"
                    type="url"
                    className="ff-input"
                    value={profilePhoto}
                    onChange={(e) => setProfilePhoto(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="save-profile-btn" disabled={savingProfile}>
                    {savingProfile ? (
                      <>
                        <Loader2 size={16} className="spin-icon" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Driver Professional Section (Driver Role Only) */}
            {isDriver && (
              <div className="profile-section-card ff-card margin-top">
                <div className="section-card-header">
                  <div className="section-title-group">
                    <Truck className="section-icon text-cyan" size={20} />
                    <h2>Driver Professional Record</h2>
                  </div>
                  <span className="section-subtitle">
                    System-managed driver license and assignment credentials.
                  </span>
                </div>

                <div className="driver-record-grid">
                  <div className="driver-record-item">
                    <span className="rec-label">
                      <Award size={14} /> License Number
                    </span>
                    <strong className="rec-val">
                      {driverDetails?.license_number || 'Not provided'}
                    </strong>
                    <span className="rec-hint">System-managed</span>
                  </div>

                  <div className="driver-record-item">
                    <span className="rec-label">Driving Experience</span>
                    <strong className="rec-val">
                      {driverDetails?.experience_years != null
                        ? `${driverDetails.experience_years} Years`
                        : 'Not provided'}
                    </strong>
                  </div>

                  <div className="driver-record-item">
                    <span className="rec-label">Duty Status</span>
                    <strong className="rec-val highlight-cyan">
                      {driverDetails?.status || 'Active'}
                    </strong>
                  </div>

                  <div className="driver-record-item">
                    <span className="rec-label">
                      <Truck size={14} /> Assigned Vehicle
                    </span>
                    <strong className="rec-val">
                      {driverDetails?.assigned_vehicle_registration ? (
                        <>
                          {driverDetails.assigned_vehicle_registration}
                          {driverDetails.assigned_vehicle_brand_model && (
                            <span className="veh-sub"> ({driverDetails.assigned_vehicle_brand_model})</span>
                          )}
                        </>
                      ) : (
                        'No vehicle currently assigned'
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Account Metadata & Security */}
          <div className="profile-col-side">
            {/* Account Details Metadata */}
            <div className="profile-section-card ff-card">
              <div className="section-card-header">
                <div className="section-title-group">
                  <Shield className="section-icon text-purple" size={20} />
                  <h2>Account Details</h2>
                </div>
              </div>

              <div className="account-meta-list">
                <div className="meta-item">
                  <span className="meta-label">Assigned Role</span>
                  <span className="meta-value-badge role-tag">
                    {user.role === 'FleetManager' ? 'Fleet Manager' : user.role}
                  </span>
                </div>

                <div className="meta-item">
                  <span className="meta-label">Account Status</span>
                  <span className="meta-value-badge active-tag">Active</span>
                </div>

                <div className="meta-item">
                  <span className="meta-label">Email Verification</span>
                  {user.is_verified || user.email_verified ? (
                    <span className="meta-value-badge verified-tag">
                      <CheckCircle size={12} /> Verified
                    </span>
                  ) : (
                    <span className="meta-value-badge unverified-tag">
                      <AlertCircle size={12} /> Unverified
                    </span>
                  )}
                </div>

                <div className="meta-item">
                  <span className="meta-label">
                    <Calendar size={13} /> Member Since
                  </span>
                  <span className="meta-value-text">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Change Password Card */}
            <div className="profile-section-card ff-card margin-top">
              <div className="section-card-header">
                <div className="section-title-group">
                  <Key className="section-icon text-amber" size={20} />
                  <h2>Security & Password</h2>
                </div>
                <span className="section-subtitle">
                  Update your account password securely.
                </span>
              </div>

              <form onSubmit={handleChangePassword} className="profile-form">
                <div className="form-group">
                  <label htmlFor="current_password">Current Password</label>
                  <input
                    id="current_password"
                    type="password"
                    className="ff-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new_password">New Password</label>
                  <input
                    id="new_password"
                    type="password"
                    className="ff-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars (A-Z, a-z, 0-9, special)"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm_password">Confirm New Password</label>
                  <input
                    id="confirm_password"
                    type="password"
                    className="ff-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                </div>

                <button type="submit" className="change-pwd-btn" disabled={changingPassword}>
                  {changingPassword ? (
                    <>
                      <Loader2 size={16} className="spin-icon" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
