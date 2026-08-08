import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './layout/AuthLayout';
import { MainLayout } from './layout/MainLayout';
import { AdminLayout } from './layout/AdminLayout';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { useAppSelector } from './app/hooks';

const TeamRedirect = () => {
  const user = useAppSelector((s) => s.auth.user);
  return <Navigate to={user?.teamId ? `/teams/${user.teamId}` : '/teams'} replace />;
};

import { NotificationProvider } from './contexts/NotificationContext';

// Public
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

import { Dashboard } from './pages/Dashboard';
import { AllProjects } from './pages/AllProjects';
import { ProjectCatalogPage } from './pages/ProjectCatalogPage';
import { ProposeProblem } from './pages/ProposeProblem';
import { MyProposals } from './pages/MyProposals';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectExecutionTemplatePage } from './pages/ProjectExecutionTemplatePage';
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
import { SettingsPage } from './pages/SettingsPage';
import { Profile } from './pages/Profile';

// Admin Pages
import { AdminUpload } from './pages/Admin/AdminUpload';
import { AdminTopTeams } from './pages/Admin/AdminTopTeams';
import { AdminTopStudents } from './pages/Admin/AdminTopStudents';
import { AdminOverlaps } from './pages/Admin/AdminOverlaps';
import { AdminStandouts } from './pages/Admin/AdminStandouts';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <NotificationProvider>
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
              <Route path="/projects" element={<AllProjects />} />
              <Route path="/projects/propose" element={<ProposeProblem />} />
              <Route path="/projects/proposals" element={<MyProposals />} />
              <Route path="/projects/catalog" element={<ProjectCatalogPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/projects/:id/execution-doc" element={<ProjectExecutionTemplatePage />} />
              <Route path="/execution-doc/:id" element={<ProjectExecutionTemplatePage />} />
              <Route path="/kanban" element={<KanbanBoard />} />
              <Route path="/timeline" element={<TimelineGantt />} />
              <Route path="/team" element={<TeamRedirect />} />
              <Route path="/teams" element={<TeamPage />} />
              <Route path="/teams/:id" element={<TeamDetailPage />} />
              <Route path="/teams/:teamId/members" element={<TeamMembers />} />
              <Route path="/teams/:id/collaborate" element={<TeamCollaborate />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/files" element={<FileManager />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Admin Portal Routes — separate layout */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/top-teams" element={<AdminTopTeams />} />
              <Route path="/admin/top-students" element={<AdminTopStudents />} />
              <Route path="/admin/overlaps" element={<AdminOverlaps />} />
              <Route path="/admin/standouts" element={<AdminStandouts />} />
              <Route path="/admin/upload" element={<AdminUpload />} />
              {/* Legacy redirects */}
              <Route path="/admin/directory" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/chat" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/ai-assistant" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/users" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/teams" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/projects" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/documents" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/analytics" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/team-trends" element={<Navigate to="/admin/top-teams" replace />} />
              <Route path="/admin/student-trends" element={<Navigate to="/admin/top-students" replace />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
