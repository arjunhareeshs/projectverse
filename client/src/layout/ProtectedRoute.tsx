import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, user, isVerifyingSession } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (isVerifyingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // DEVELOPER accounts only ever see the AI observability portal — never the student/admin app
  if (user?.role === 'DEVELOPER') {
    if (!location.pathname.startsWith('/developer')) {
      return <Navigate to="/developer/ai-observability" replace />;
    }
    return <Outlet />;
  }

  // Non-developers can never reach the developer observability portal
  if (location.pathname.startsWith('/developer')) {
    return <Navigate to={user?.role === 'ADMIN' ? '/admin/top-teams' : '/dashboard'} replace />;
  }

  // If user is ADMIN and attempting to access non-admin paths, redirect to top teams portal
  if (user?.role === 'ADMIN' && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin/top-teams" replace />;
  }

  // If user is STUDENT and attempting to access admin routes, redirect to student dashboard
  if (user?.role === 'STUDENT' && location.pathname.startsWith('/admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

