import React, { useState, useEffect } from 'react';
import { Search, Plus, Sparkles, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { useChatDock } from '../chat/ChatDockContext';
import { NotificationsDropdown } from '../components/NotificationsDropdown';

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
  const navigate = useNavigate();
  const { toggle: toggleChat, contentLeft, contentRight } = useChatDock();
  const [searchFocused, setSearchFocused] = useState(false);
  const [dateStr, setDateStr] = useState(getFormattedDate());

  useEffect(() => {
    const t = setInterval(() => setDateStr(getFormattedDate()), 60_000);
    return () => clearInterval(t);
  }, []);

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

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
    <header
      className="fixed top-0 z-30 flex h-16 items-center border-b border-border bg-card/90 backdrop-blur-sm transition-[left,right] duration-300 ease-out"
      style={{ left: contentLeft, right: contentRight }}
    >
      <div className="flex w-full items-center gap-4 px-6">
        {/* Mobile menu button */}
        <button className="flex md:hidden items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
          <Menu className="h-5 w-5" />
        </button>

        {/* Greeting */}
        <div className="hidden md:flex flex-col min-w-0 flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground leading-tight whitespace-nowrap">
            {getGreeting()}, {firstName} 👋
          </h2>
          <p className="text-[11px] text-muted-foreground leading-tight whitespace-nowrap">
            {dateStr} · 3 approvals waiting on you
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* New Project */}
          <button
            onClick={() => navigate('/projects/recommend')}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Project</span>
          </button>

          {/* Notifications */}
          <NotificationsDropdown />

          {/* Avatar */}
          <button
            onClick={() => navigate('/profile')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity ring-2 ring-primary/20"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
};
