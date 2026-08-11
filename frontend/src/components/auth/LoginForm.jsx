import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { AlertCircle, Mail } from 'lucide-react';
import InputField from './InputField';
import GradientButton from './GradientButton';
import ResendVerificationModal from './ResendVerificationModal';
import './LoginForm.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isUnverified, setIsUnverified] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsUnverified(false);

    const trimmedEmail = (form.email || '').trim();
    const password = form.password || '';

    // 1. Missing email validation
    if (!trimmedEmail) {
      setError('Email address is required.');
      return;
    }

    // 2. Invalid email format validation
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    // 3. Missing password validation
    if (!password) {
      setError('Password is required.');
      return;
    }

    try {
      await login(trimmedEmail.toLowerCase(), password);
      toast.success('Signed in successfully.');
      navigate('/dashboard');
    } catch (err) {
      const statusCode = err.response?.status;
      const detail = err.response?.data?.detail;

      if (statusCode === 403) {
        const message = typeof detail === 'string' ? detail : 'Verify your email address before logging in.';
        setError(message);
        setIsUnverified(true);
      } else if (statusCode === 401) {
        const message = typeof detail === 'string' ? detail : 'Invalid email or password.';
        setError(message);
      } else if (statusCode === 400) {
        const message = typeof detail === 'string' ? detail : (detail?.[0]?.msg || 'Please check your login details.');
        setError(message);
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Unable to connect to the server. Please try again.');
      }
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    toast.info('Password reset: Please contact your fleet administrator or support team.', {
      autoClose: 5000,
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {error && (
          <div className={`auth-error-alert ${isUnverified ? 'unverified-alert' : ''}`}>
            <AlertCircle size={20} className="alert-icon" />
            <div className="alert-body">
              <p>{error}</p>
              {isUnverified && (
                <button
                  type="button"
                  className="resend-inline-btn"
                  onClick={() => setShowResendModal(true)}
                >
                  <Mail size={14} /> Resend verification email
                </button>
              )}
            </div>
          </div>
        )}

        <InputField
          label="Email"
          name="email"
          type="email"
          placeholder="Enter your email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <InputField
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <div className="auth-helpers">
          <button
            type="button"
            className="link-secondary text-btn"
            onClick={() => setShowResendModal(true)}
          >
            Didn't receive email? Resend verification
          </button>
          <a
            href="#forgot-password"
            onClick={handleForgotPassword}
            className="link-secondary"
          >
            Forgot password?
          </a>
        </div>

        <GradientButton type="submit" loading={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </GradientButton>
      </form>

      <ResendVerificationModal
        isOpen={showResendModal}
        onClose={() => setShowResendModal(false)}
        initialEmail={form.email}
      />
    </>
  );
}

export default LoginForm;
