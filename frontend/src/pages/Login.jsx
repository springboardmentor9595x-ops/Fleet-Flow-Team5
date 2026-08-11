import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import './Login.css';

function Login() {
  const { isAuthenticated, loading } = useAuth();

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <main className="auth-page-clean">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon-circle">
              <span className="auth-icon">🚚</span>
            </div>
            <h1 className="auth-title">FleetFlow</h1>
            <p className="auth-subtitle">Sign in to your account</p>
          </div>

          <LoginForm />

          <div className="auth-footer">
            <span>Don't have an account?</span>
            <Link to="/signup" className="auth-link">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Login;
