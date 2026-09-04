import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsers, updateUserRole } from '../api/users';
import { toast } from 'react-toastify';
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Truck, 
  Navigation, 
  Search, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  Shield, 
  UserCheck,
  AlertCircle
} from 'lucide-react';
import './UsersPage.css';

const ROLES = ['Admin', 'FleetManager', 'Dispatcher', 'Driver'];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState(null);

  // Security guard: Admin only
  useEffect(() => {
    if (currentUser && currentUser.role !== 'Admin') {
      toast.error('Access forbidden: User Management is restricted to Administrators.');
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter !== 'ALL') params.role = roleFilter;
      const res = await getUsers(params);
      setUsers(res.data || []);
    } catch (err) {
      toast.error('Failed to load user records.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      fetchUsers();
    }
  }, [fetchUsers, currentUser]);

  const handleRoleChange = async (userId, targetUserEmail, newRole) => {
    if (!window.confirm(`Are you sure you want to change role for ${targetUserEmail} to ${newRole === 'FleetManager' ? 'Fleet Manager' : newRole}?`)) {
      return;
    }

    setUpdatingId(userId);
    try {
      await updateUserRole(userId, newRole);
      toast.success(`Role for ${targetUserEmail} updated to ${newRole === 'FleetManager' ? 'Fleet Manager' : newRole}.`);
      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      toast.error('Failed to update user role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const term = searchTerm.toLowerCase();
      const name = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [users, searchTerm]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'Admin').length;
    const managers = users.filter((u) => u.role === 'FleetManager').length;
    const dispatchers = users.filter((u) => u.role === 'Dispatcher').length;
    const drivers = users.filter((u) => u.role === 'Driver').length;
    return { total, admins, managers, dispatchers, drivers };
  }, [users]);

  const getRoleClass = (role) => {
    if (role === 'Admin') return 'role-admin';
    if (role === 'FleetManager') return 'role-fleetmanager';
    if (role === 'Dispatcher') return 'role-dispatcher';
    return 'role-driver';
  };

  const formatRoleLabel = (role) => {
    if (role === 'FleetManager') return 'Fleet Manager';
    return role;
  };

  if (currentUser?.role !== 'Admin') {
    return null;
  }

  return (
    <div className="users-page-wrapper">
      <main className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>User & Role Management</h1>
            <p>Admin control center for user accounts, role-based authorization, and team permissions</p>
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary" onClick={fetchUsers} disabled={loading}>
              <RotateCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh Users</span>
            </button>
          </div>
        </div>

        {/* Stats Metric Cards */}
        <div className="users-stats-grid">
          <div className="stat-card">
            <div className="stat-icon total-icon">
              <Users size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Users</span>
              <span className="stat-value">{stats.total}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon admin-icon">
              <ShieldCheck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Admins</span>
              <span className="stat-value">{stats.admins}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon manager-icon">
              <Truck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Fleet Managers</span>
              <span className="stat-value">{stats.managers}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon dispatcher-icon">
              <Navigation size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Dispatchers</span>
              <span className="stat-value">{stats.dispatchers}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon driver-icon">
              <UserCheck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Drivers</span>
              <span className="stat-value">{stats.drivers}</span>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="table-controls-card ff-card">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search users by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-pill-group">
            {['ALL', 'Admin', 'FleetManager', 'Dispatcher', 'Driver'].map((f) => (
              <button
                key={f}
                className={`filter-pill ${roleFilter === f ? 'active' : ''}`}
                onClick={() => setRoleFilter(f)}
              >
                {f === 'FleetManager' ? 'Fleet Managers' : f === 'ALL' ? 'All Roles' : `${f}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="ff-table-wrapper">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading user accounts...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p>No user accounts found matching the criteria.</p>
            </div>
          ) : (
            <table className="ff-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Contact Email</th>
                  <th>Phone</th>
                  <th>Verification</th>
                  <th>Current Role</th>
                  <th style={{ textAlign: 'right' }}>Role Assignment Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.user_id === currentUser.user_id;
                  const isUpdating = updatingId === u.user_id;

                  return (
                    <tr key={u.user_id}>
                      <td>
                        <div className="user-cell-meta">
                          <div className="user-avatar-sm">
                            {u.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="user-name-title">
                              {u.full_name} {isSelf && <strong style={{ color: '#22d3ee' }}>(You)</strong>}
                            </span>
                            <span className="user-id-sub">ID: {u.user_id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{u.email}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.phone || '-'}</span>
                      </td>
                      <td>
                        <span className={`verification-pill ${u.is_verified ? 'verified' : 'unverified'}`}>
                          {u.is_verified ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {u.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className={`role-badge-pill ${getRoleClass(u.role)}`}>
                          <Shield size={11} />
                          {formatRoleLabel(u.role)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            className="role-select-box"
                            value={u.role}
                            disabled={isUpdating || isSelf}
                            onChange={(e) => handleRoleChange(u.user_id, u.email, e.target.value)}
                            title={isSelf ? 'Cannot change your own role' : 'Select new role'}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r === 'FleetManager' ? 'Fleet Manager' : r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
