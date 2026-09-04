import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { CheckCircle2, Mail, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import InputField from './InputField';
import GradientButton from './GradientButton';
import ResendVerificationModal from './ResendVerificationModal';
import './SignupForm.css';

const passwordCriteria = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

function SignupForm() {
  const navigate = useNavigate();
  const { signup, loading } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    role: 'Driver',
  });
  const [error, setError] = useState('');
  const strength = passwordCriteria.filter(({ test }) => test(form.password)).length;
  const passwordsMatch = form.password === form.confirm_password;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.full_name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!form.email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (strength < passwordCriteria.length) {
      setError('Password does not meet the security requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || null,
        role: form.role,
      };

      await signup(payload);
      toast.success('Account created! Please enter your 6-digit verification code.');
      navigate(`/verify-email?email=${encodeURIComponent(payload.email)}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (detail?.[0]?.msg || 'Signup failed. Please try again.');
      setError(message);
      toast.error(message);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="signup-form" noValidate>
        {error && (
          <div className="auth-error-alert">
            <AlertCircle size={18} className="alert-icon" />
            <p>{error}</p>
          </div>
        )}

        <div className="form-fields-grid">
          <InputField
            label="Full name"
            name="full_name"
            type="text"
            placeholder="Enter your full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />

          <InputField
            label="Email"
            name="email"
            type="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />

          <InputField
            label="Phone"
            name="phone"
            type="tel"
            placeholder="Enter phone number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <div className="role-field-wrap">
            <label className="input-label">Select Role</label>
            <div className="role-selector-grid">
              {['Driver', 'FleetManager', 'Dispatcher', 'Admin'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`role-btn ${form.role === role ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, role })}
                >
                  {role === 'FleetManager' ? 'Fleet Manager' : role}
                </button>
              ))}
            </div>
          </div>

          <InputField
            label="Password"
            name="password"
            type="password"
            placeholder="Create password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          <InputField
            label="Confirm password"
            name="confirm_password"
            type="password"
            placeholder="Confirm password"
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
            required
          />
        </div>

        {form.password && (
          <div className="password-criteria-wrap">
            <div className="criteria-progress">
              <div
                className="criteria-bar"
                style={{
                  width: `${(strength / passwordCriteria.length) * 100}%`,
                  backgroundColor: strength === 5 ? '#34D399' : strength >= 3 ? '#FBBF24' : '#F87171',
                }}
              />
            </div>
            <div className="criteria-chips">
              {passwordCriteria.map(({ label, test }) => {
                const met = test(form.password);
                return (
                  <span key={label} className={`criterion-chip ${met ? 'met' : ''}`}>
                    {met ? '✓' : '•'} {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <GradientButton type="submit" loading={loading}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </GradientButton>
      </form>
    </>
  );
}

export default SignupForm;
