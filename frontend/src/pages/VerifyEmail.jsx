import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { verifyEmail } from '../api/auth';
import ResendVerificationModal from '../components/auth/ResendVerificationModal';
import './VerifyEmail.css';

// States: 'VERIFYING' | 'SUCCESS' | 'ALREADY_VERIFIED' | 'EXPIRED' | 'INVALID'
function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState('VERIFYING');
  const [message, setMessage] = useState('Verifying your email address...');
  const [showResendModal, setShowResendModal] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token || !token.trim()) {
      setState('INVALID');
      setMessage('Invalid verification link.');
      return;
    }

    setState('VERIFYING');
    setMessage('Verifying your email address...');

    verifyEmail(token)
      .then((res) => {
        const statusType = res.data?.status;
        if (statusType === 'already_verified') {
          setState('ALREADY_VERIFIED');
          setMessage(res.data?.message || 'Email address is already verified.');
        } else {
          setState('SUCCESS');
          setMessage(res.data?.message || 'Email verified successfully.');
        }
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || '';
        const lowerDetail = detail.toLowerCase();
        if (lowerDetail.includes('expired')) {
          setState('EXPIRED');
          setMessage(detail || 'Verification link has expired. Please request a new verification email.');
        } else if (lowerDetail.includes('already verified')) {
          setState('ALREADY_VERIFIED');
          setMessage('Email address is already verified.');
        } else {
          setState('INVALID');
          setMessage(detail || 'Invalid verification link.');
        }
      });
  }, [searchParams]);

  return (
    <main className="auth-page-clean">
      <div className="auth-container">
        <div className="auth-card verify-card">
          <div className="auth-header">
            <div className="auth-icon-circle">
              <span className="auth-icon">🚚</span>
            </div>
            <h1 className="auth-title">FleetFlow</h1>
          </div>

          {state === 'VERIFYING' && (
            <div className="verify-state-content">
              <div className="state-icon-badge verifying">
                <Loader2 size={36} className="spin-animation" />
              </div>
              <h2 className="state-title">Verifying...</h2>
              <p className="state-desc">Please wait while we confirm your email verification link.</p>
            </div>
          )}

          {state === 'SUCCESS' && (
            <div className="verify-state-content">
              <div className="state-icon-badge success">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="state-title">Email verified successfully.</h2>
              <p className="state-desc">
                Your email address has been verified. You can now log in to access your FleetFlow account.
              </p>
              <div className="verify-actions">
                <button
                  type="button"
                  className="btn-primary-full"
                  onClick={() => navigate('/login')}
                >
                  Continue to Login <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {state === 'ALREADY_VERIFIED' && (
            <div className="verify-state-content">
              <div className="state-icon-badge info">
                <Info size={36} />
              </div>
              <h2 className="state-title">Email address is already verified.</h2>
              <p className="state-desc">
                Your email address has already been verified previously. You can sign in directly.
              </p>
              <div className="verify-actions">
                <button
                  type="button"
                  className="btn-primary-full"
                  onClick={() => navigate('/login')}
                >
                  Continue to Login <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {state === 'EXPIRED' && (
            <div className="verify-state-content">
              <div className="state-icon-badge warning">
                <AlertTriangle size={36} />
              </div>
              <h2 className="state-title">Verification link has expired.</h2>
              <p className="state-desc">
                Verification link has expired. Please request a new verification email.
              </p>
              <div className="verify-actions">
                <button
                  type="button"
                  className="btn-primary-full"
                  onClick={() => setShowResendModal(true)}
                >
                  <RefreshCw size={16} /> Resend verification email
                </button>
                <Link to="/login" className="btn-secondary-link">
                  Back to Login
                </Link>
              </div>
            </div>
          )}

          {state === 'INVALID' && (
            <div className="verify-state-content">
              <div className="state-icon-badge error">
                <XCircle size={36} />
              </div>
              <h2 className="state-title">Invalid verification link.</h2>
              <p className="state-desc">
                This verification link is invalid or has already been used.
              </p>
              <div className="verify-actions">
                <button
                  type="button"
                  className="btn-primary-full"
                  onClick={() => setShowResendModal(true)}
                >
                  <RefreshCw size={16} /> Resend verification email
                </button>
                <Link to="/login" className="btn-secondary-link">
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <ResendVerificationModal
        isOpen={showResendModal}
        onClose={() => setShowResendModal(false)}
      />
    </main>
  );
}

export default VerifyEmail;