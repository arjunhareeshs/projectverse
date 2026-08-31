import React, { useState, useEffect, useRef } from 'react';
import { Plus, Menu, User as UserIcon, Sparkles, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { NotificationsDropdown } from '../components/NotificationsDropdown';
import { AISettingsModal } from '../components/ai/AISettingsModal';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const getFormattedDate = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

export const Navbar: React.FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [dateStr, setDateStr] = useState(getFormattedDate());
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setDateStr(getFormattedDate()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const handleLogout = () => {
    setIsMenuOpen(false);
    dispatch(logout());
    navigate('/login');
  };

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <header
        className="fixed top-0 z-30 flex h-16 items-center border-b border-border bg-card/90 backdrop-blur-md transition-none"
        style={{ left: 256, right: 0 }}
      >
        <div className="flex w-full items-center gap-4 px-6">
          {/* Mobile menu button */}
          <button className="flex md:hidden items-center justify-center rounded-btn p-1.5 text-muted-foreground hover:bg-surface-subtle interactive-tap">
            <Menu className="h-5 w-5" />
          </button>

          {/* Greeting */}
          <div className="hidden md:flex flex-col min-w-0 flex-shrink-0">
            <h2 className="text-sm font-semibold text-foreground leading-tight whitespace-nowrap">
              {getGreeting()}, {firstName} 👋
            </h2>
            <p className="text-[11px] text-muted-foreground leading-tight whitespace-nowrap">
              {dateStr}
            </p>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5 ml-auto shrink-0">
            {/* New Project */}
            <button
              onClick={() => navigate('/projects/propose')}
              className="flex items-center gap-1.5 rounded-btn bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm interactive-tap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Project</span>
            </button>

            {/* Notifications */}
            <NotificationsDropdown />

            {/* Account Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-primary/20 transition-all interactive-tap focus:outline-hidden"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold ring-2 ring-primary/20">
                  {initials}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-100">
                  {/* User Profile Header */}
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {user?.fullName || 'User'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {user?.email || ''}
                    </p>
                    {user?.role && (
                      <span className="inline-block mt-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        {user.role}
                      </span>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors text-left"
                    >
                      <UserIcon className="h-4 w-4 text-slate-400" />
                      <span>Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsAiModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors text-left"
                    >
                      <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <div className="flex-1 flex items-center justify-between">
                        <span>AI Provider Settings</span>
                        <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded-md">
                          BYOK
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </>
  );
};
