import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Terminal, LogOut, Coins, HeartPulse } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';

const developerNav = [
  { icon: Coins, label: 'AI Usage', to: '/developer/ai-observability' },
  { icon: HeartPulse, label: 'System Health', to: '/developer/system-health' },
];

export const DeveloperLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
            <Terminal className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight block">ProjectVerse</span>
            <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase block -mt-0.5">
              AI Observability
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-1.5">
          {developerNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                  isActive ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-400">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
};
