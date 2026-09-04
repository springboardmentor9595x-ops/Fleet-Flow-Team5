import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { CheckCircle2, AlertCircle, Mail, ArrowRight, RefreshCw, KeyRound, Clock } from 'lucide-react';
import { verifyEmail, resendVerification } from '../api/auth';
import InputField from '../components/auth/InputField';
import GradientButton from '../components/auth/GradientButton';
import './VerifyEmail.css';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token') || searchParams.get('code');
    if (emailParam) {
      setEmail(emailParam);
    }
    if (tokenParam) {
      setCode(tokenParam.trim());
    }
  }, [searchParams]);

  // Handle resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e?.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyEmail(cleanEmail, cleanCode);
      const statusType = response.data?.status;

      setSuccess(true);
      if (statusType === 'already_verified') {
        toast.info('Email address is already verified.');
      } else {
        toast.success('Email verified successfully!');
      }

      // Redirect user to LOGIN page on successful verification
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : 'Verification failed. Please check your code and try again.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address to request a new code.');
      return;
    }

    setResending(true);
    setError('');
    try {
      const res = await resendVerification(cleanEmail);
      toast.success(res.data?.message || 'New verification code sent to your email.');
      setCooldown(60); // 60 seconds cooldown
    } catch (err) {
      const statusCode = err.response?.status;
      const detail = err.response?.data?.detail;

      if (statusCode === 429) {
        toast.warning(detail || 'Please wait before requesting another code.');
      } else {
        const message = typeof detail === 'string' ? detail : 'Failed to send new code. Please try again.';
        setError(message);
        toast.error(message);
      }
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <main className="auth-page-clean">
        <div className="auth-container">
          <div className="auth-card verify-card success-card-animate">
            <div className="state-icon-badge success">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="state-title">Email Verified!</h2>
            <p className="state-desc">
              Your email address has been verified successfully. Redirecting you to the login page...
            </p>
            <div className="verify-actions">
              <button
                type="button"
                className="btn-primary-full"
                onClick={() => navigate('/login')}
              >
                Go to Login <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page-clean">
      <div className="auth-container">
        <div className="auth-card verify-card">
          <div className="auth-header">
            <div className="auth-icon-circle">
              <KeyRound size={28} color="#38bdf8" />
            </div>
            <h1 className="auth-title">Verify Email</h1>
            <p className="auth-subtitle">Enter the 6-digit code sent to your email address</p>
          </div>

          {error && (
            <div className="auth-error-alert">
              <AlertCircle size={20} className="alert-icon" />
              <div className="alert-body">
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="verify-code-form">
            <InputField
              label="Email Address"
              name="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="code-input-group">
              <label className="input-label">6-Digit Verification Code</label>
              <div className="code-input-wrapper">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(val);
                  }}
                  className="code-digits-input"
                  autoFocus
                  required
                />
              </div>
              <div className="code-expiry-note">
                <Clock size={14} />
                <span>Code expires in <strong>10 minutes</strong></span>
              </div>
            </div>

            <GradientButton type="submit" loading={loading} disabled={code.length !== 6}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </GradientButton>

            <div className="verify-footer-actions">
              <button
                type="button"
                className="resend-code-btn"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
              >
                <RefreshCw size={15} className={resending ? 'spin-animation' : ''} />
                {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
              </button>

              <Link to="/login" className="back-login-link">
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default VerifyEmail;