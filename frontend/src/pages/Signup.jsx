import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SignupForm from '../components/auth/SignupForm';
import './Signup.css';

function Signup() {
  const { isAuthenticated, loading } = useAuth();

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <main className="auth-page-clean">
      <div className="auth-container signup-container">
        <div className="auth-card signup-card">
          <div className="auth-header">
            <div className="auth-icon-circle">
              <span className="auth-icon">🚚</span>
            </div>
            <h1 className="auth-title">FleetFlow</h1>
            <p className="auth-subtitle">Create your account</p>
          </div>

          <SignupForm />

          <div className="auth-footer">
            <span>Already have an account?</span>
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Signup;
