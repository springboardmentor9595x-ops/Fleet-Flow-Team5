import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0f1d',
          color: '#f8fafc',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'Plus Jakarta Sans, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#38bdf8' }}>
              FleetFlow Encountered an Issue
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              A display error occurred while rendering the interface.
            </p>
            {this.state.error?.message && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                fontFamily: 'JetBrains Mono, monospace',
                wordBreak: 'break-word'
              }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('fleetflow_token');
                  window.location.href = '/login';
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
