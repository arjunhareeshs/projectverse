import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  TrendingUp,
  GraduationCap,
  MessageSquare,
  ChevronLeft,
  ShieldCheck,
  LogOut,
  Users,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { adminService } from '../services/admin.service';

const adminNav = [
  { icon: Upload, label: 'Upload', to: '/admin/upload' },
  { icon: TrendingUp, label: 'Team Trends', to: '/admin/team-trends' },
  { icon: GraduationCap, label: 'Student Trends', to: '/admin/student-trends' },
  { icon: MessageSquare, label: 'Chat', to: '/admin/chat' },
];

interface Stats {
  totalTeams: number;
  totalStudents: number;
  totalAchievements: number;
  avgProgress: number;
}

export const AdminLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [stats, setStats] = useState<Stats>({
    totalTeams: 24,
    totalStudents: 85,
    totalAchievements: 30,
    avgProgress: 58,
  });

  useEffect(() => {
    adminService.getStats().then(setStats).catch(() => {});
  }, []);

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#f7f8fa]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-52 flex flex-col border-r border-gray-100 bg-white shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-100 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">ProjectVerse</span>
          </div>
        </div>


        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'
                    )}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 px-3 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-800 leading-tight">{user?.fullName}</p>
              <p className="truncate text-[10px] text-indigo-600 leading-tight font-medium capitalize">
                Admin Portal v1.0
              </p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col pl-52">
        {/* Top Header Bar */}
        <header className="fixed top-0 right-0 left-52 z-30 flex h-14 items-center border-b border-gray-100 bg-white px-6 gap-6">
          {/* Stats strip */}
          <div className="flex items-center gap-5">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-indigo-600">{stats.totalTeams}</span>
              <span className="text-xs text-gray-400">Teams</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-pink-500">{stats.totalStudents}</span>
              <span className="text-xs text-gray-400">Students</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-orange-500">{stats.totalAchievements}</span>
              <span className="text-xs text-gray-400">Achievements</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-green-500">{stats.avgProgress}%</span>
              <span className="text-xs text-gray-400">Avg Progress</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Overall Progress</span>
              <div className="w-28 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${stats.avgProgress}%` }}
                />
              </div>
              <span className="font-bold text-gray-700">{stats.avgProgress}%</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden pt-14">
          <Outlet context={{ stats }} />
        </main>
      </div>
    </div>
  );
};
