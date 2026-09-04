import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import VehiclesPage from './pages/VehiclesPage';
import ShipmentsPage from './pages/ShipmentsPage';
import TripsPage from './pages/TripsPage';
import LiveMap from './pages/LiveMap';
import UsersPage from './pages/UsersPage';
import MaintenancePage from './pages/MaintenancePage';
import FuelPage from './pages/FuelPage';
import AttendancePage from './pages/AttendancePage';
import ReportsPage from './pages/ReportsPage';
import LeaveRequestsPage from './pages/LeaveRequestsPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './routes/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="status" style={{ color: '#94a3b8' }}>Loading FleetFlow...</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/fleet-dashboard" element={<Navigate to="/dashboard?tab=fleet_analytics" replace />} />
        <Route path="/logistics-dashboard" element={<Navigate to="/dashboard?tab=logistics_dashboard" replace />} />
        <Route path="/admin-dashboard" element={<Navigate to="/dashboard?tab=admin_insights" replace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/leave-requests" element={<LeaveRequestsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/drivers" element={<Navigate to="/attendance" replace />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/shipments" element={<ShipmentsPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/fuel" element={<FuelPage />} />
        <Route path="/live-map" element={<LiveMap />} />
      </Route>

      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
