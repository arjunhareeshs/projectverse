import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Trophy,
  GraduationCap,
  GitCompareArrows,
  Rocket,
  Upload,
  ShieldCheck,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { adminService } from '../services/admin.service';

const adminNav = [
  { icon: Trophy, label: 'Top Teams', to: '/admin/top-teams' },
  { icon: GraduationCap, label: 'Top Students', to: '/admin/top-students' },
  { icon: GitCompareArrows, label: 'Overlaps', to: '/admin/overlaps', showBadge: true },
  { icon: Rocket, label: 'Standouts', to: '/admin/standouts' },
  { icon: Upload, label: 'Data Upload', to: '/admin/upload' },
];

export const AdminLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const [headerStats, setHeaderStats] = useState({
    totalTeams: 0,
    totalStudents: 0,
    openOverlaps: 0,
    openStandouts: 0,
  });
  const [isRecomputing, setIsRecomputing] = useState(false);

  const fetchStatusAndStats = async () => {
    try {
      const [stats, statusData] = await Promise.all([
        adminService.getStats().catch(() => ({ totalTeams: 0, totalStudents: 0 })),
        adminService.getInsightsStatus().catch(() => ({ counts: { openOverlaps: 0, openStandouts: 0 } })),
      ]);
      setHeaderStats({
        totalTeams: stats.totalTeams || 0,
        totalStudents: stats.totalStudents || 0,
        openOverlaps: statusData.counts?.openOverlaps || 0,
        openStandouts: statusData.counts?.openStandouts || 0,
      });
    } catch {
      // Zero state maintained on error
    }
  };

  useEffect(() => {
    fetchStatusAndStats();
  }, []);

  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      await adminService.recomputeInsights('all');
      await fetchStatusAndStats();
    } catch (err) {
      console.error('Recompute failed:', err);
    } finally {
      setIsRecomputing(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-56 flex flex-col border-r border-slate-200/80 bg-white shadow-xs">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-100 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-base font-black text-slate-900 tracking-tight block">ProjectVerse</span>
            <span className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase block -mt-0.5">
              Admin Intelligence
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={cn(
                        'h-4.5 w-4.5 shrink-0 transition-colors',
                        isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.showBadge && headerStats.openOverlaps > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-extrabold text-white shadow-xs">
                      {headerStats.openOverlaps}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Footer */}
        <div className="border-t border-slate-100 p-3 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800 leading-tight">{user?.fullName || 'Admin User'}</p>
              <p className="truncate text-[10px] text-slate-500 font-semibold leading-tight">
                Senior Auditor
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col pl-56">
        {/* Top Header Bar */}
        <header className="fixed top-0 right-0 left-56 z-30 flex h-16 items-center border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 justify-between shadow-2xs">
          {/* Real Stats Strip */}
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-900">{headerStats.totalTeams}</span>
              <span className="text-slate-500 font-semibold">Active Teams</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-900">{headerStats.totalStudents}</span>
              <span className="text-slate-500 font-semibold">Ranked Students</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className={cn('text-base font-black', headerStats.openOverlaps > 0 ? 'text-rose-600' : 'text-slate-900')}>
                {headerStats.openOverlaps}
              </span>
              <span className="text-slate-500 font-semibold">Open Overlap Flags</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-amber-600">{headerStats.openStandouts}</span>
              <span className="text-slate-500 font-semibold">Standout Projects</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleRecompute}
              disabled={isRecomputing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-2xs disabled:opacity-50"
              title="Trigger manual background intelligence recompute"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-indigo-600', isRecomputing && 'animate-spin')} />
              <span>{isRecomputing ? 'Recomputing...' : 'Recompute Insights'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden pt-16">
          <Outlet context={{ refreshStats: fetchStatusAndStats }} />
        </main>
      </div>
    </div>
  );
};
