import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is ADMIN and attempting to access non-admin paths, redirect to admin upload portal
  if (user?.role === 'ADMIN' && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin/upload" replace />;
  }

  // If user is STUDENT and attempting to access admin routes, redirect to student dashboard
  if (user?.role === 'STUDENT' && location.pathname.startsWith('/admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
