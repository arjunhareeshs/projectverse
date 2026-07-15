import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './layout/AuthLayout';
import { MainLayout } from './layout/MainLayout';
import { AdminLayout } from './layout/AdminLayout';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { useAppSelector } from './app/hooks';

const TeamRedirect = () => {
  const user = useAppSelector((s) => s.auth.user);
  return <Navigate to={`/teams/${user?.teamId || '1'}`} replace />;
};

// Public
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Main App Pages
import { Dashboard } from './pages/Dashboard';
import { AIAssistant } from './pages/AIAssistant';
import { AllProjects } from './pages/AllProjects';
import { KanbanBoard } from './pages/KanbanBoard';
import { TimelineGantt } from './pages/TimelineGantt';
import { TeamPage } from './pages/TeamPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { TeamMembers } from './pages/TeamMembers';
import { TeamCollaborate } from './pages/TeamCollaborate';
import { Documents } from './pages/Documents';
import { FileManager } from './pages/FileManager';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { Notifications } from './pages/Notifications';
import { Schedule } from './pages/Schedule';
import { SettingsPage } from './pages/SettingsPage';
import { Profile } from './pages/Profile';

// Admin Pages
import { UserManagement } from './pages/Admin/UserManagement';
import { TeamManagement } from './pages/Admin/TeamManagement';
import { ProjectManagement } from './pages/Admin/ProjectManagement';
import { DocumentManagement } from './pages/Admin/DocumentManagement';
import { AdminAnalytics } from './pages/Admin/AdminAnalytics';
import { AdminUpload } from './pages/Admin/AdminUpload';
import { AdminTeamTrends } from './pages/Admin/AdminTeamTrends';
import { AdminStudentTrends } from './pages/Admin/AdminStudentTrends';
import { AdminChat } from './pages/Admin/AdminChat';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected Main App Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/projects" element={<AllProjects />} />
            <Route path="/kanban" element={<KanbanBoard />} />
            <Route path="/timeline" element={<TimelineGantt />} />
            <Route path="/team" element={<TeamRedirect />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
            <Route path="/teams/:teamId/members" element={<TeamMembers />} />
            <Route path="/teams/:id/collaborate" element={<TeamCollaborate />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/files" element={<FileManager />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Admin Portal Routes — separate layout */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/upload" replace />} />
            <Route path="/admin/upload" element={<AdminUpload />} />
            <Route path="/admin/team-trends" element={<AdminTeamTrends />} />
            <Route path="/admin/student-trends" element={<AdminStudentTrends />} />
            <Route path="/admin/chat" element={<AdminChat />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/teams" element={<TeamManagement />} />
            <Route path="/admin/projects" element={<ProjectManagement />} />
            <Route path="/admin/documents" element={<DocumentManagement />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
