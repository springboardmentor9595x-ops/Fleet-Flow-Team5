import React, { useState } from 'react';
import { Mail, ArrowRight, X, Clock, CheckCircle } from 'lucide-react';
import { resendVerification } from '../../api/auth';
import './ResendVerificationModal.css';

export default function ResendVerificationModal({ isOpen, onClose, initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      const response = await resendVerification(email.trim().toLowerCase());
      setStatus({
        type: 'success',
        message: response.data?.message || 'Verification email has been sent if the account exists.',
      });
    } catch (err) {
      const errorDetail = err.response?.data?.detail || 'Failed to send verification email. Please try again.';
      setStatus({
        type: 'error',
        message: errorDetail,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        <div className="modal-header">
          <div className="modal-icon-badge">
            <Mail size={24} />
          </div>
          <h3>Resend Verification Email</h3>
          <p>Enter your account email address and we will send you a new verification link.</p>
        </div>

        {status && (
          <div className={`modal-alert ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={18} /> : <Clock size={18} />}
            <span>{status.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="resend-form">
          <label className="resend-field">
            <span>Email address</span>
            <div className="resend-input-wrapper">
              <Mail className="field-icon" size={18} />
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !email.trim()}>
              {loading ? 'Sending...' : 'Send Verification Email'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
