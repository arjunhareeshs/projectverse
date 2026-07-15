import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Kanban,
  GanttChart,
  Users,
  FileText,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { useChatDock } from '../chat/ChatDockContext';
import { notificationService } from '../services/notification.service';

interface NavItem {
  icon: React.ElementType;
  label: string;
  to: string;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// navSections moved inside component

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { sidebarWidth, sidebarCollapsed: mini } = useChatDock();
  const [unreadCount, setUnreadCount] = useState(0);

  const navSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' }],
    },
    {
      title: 'PROJECTS',
      items: [
        { icon: FolderOpen, label: 'All Projects', to: '/projects' },
        { icon: Kanban, label: 'Kanban Board', to: '/kanban' },
        { icon: GanttChart, label: 'Timeline & Gantt', to: '/timeline' },
        { icon: Users, label: 'Team', to: `/teams/${user?.teamId || '1'}` },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        { icon: FileText, label: 'Documents', to: '/documents' },
        { icon: Calendar, label: 'Schedule', to: '/schedule' },
        { icon: Bell, label: 'Notifications', to: '/notifications' },
      ],
    },
  ];

  const fetchUnreadCount = useCallback(async () => {
    try {
      const notifications = await notificationService.getNotifications();
      const unread = notifications.filter((n: any) => !n.readAt).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to fetch unread notifications count:', err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 8000);

    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'notification') {
        fetchUnreadCount();
      }
    };
    window.addEventListener('pv:refresh', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pv:refresh', handleRefresh);
    };
  }, [fetchUnreadCount]);

  const toggleSection = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border bg-card transition-[width] duration-300 ease-out"
      style={{ width: sidebarWidth }}
    >
      {/* Logo & Org Switcher */}
      <div className={cn('flex items-center gap-2 h-16 border-b border-border shrink-0', mini ? 'justify-center px-2' : 'px-4')}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm shrink-0">
          <span className="text-white font-bold text-sm">PV</span>
        </div>
        {!mini && (
          <>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground leading-tight truncate">ProjectVerse</span>
              <span className="text-[10px] text-muted-foreground truncate leading-tight">
                {user?.organizationId ? 'Consulting Group' : 'Personal Workspace'}
              </span>
            </div>
            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0 cursor-pointer hover:text-foreground transition-colors" />
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-1', mini ? 'px-2' : 'px-2')}>
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            {mini ? (
              <div className="my-1.5 mx-2 border-t border-border/60" />
            ) : (
              <button
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center gap-1 px-2 py-1 mb-1 group"
              >
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  {section.title}
                </span>
                {collapsed[section.title] ? (
                  <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )}

            {(mini || !collapsed[section.title]) && (
              <ul className="space-y-0.5">
                {section.items.map((rawItem) => {
                  const item = { ...rawItem };
                  if (item.to === '/notifications') {
                    item.badge = unreadCount > 0 ? String(unreadCount) : undefined;
                    item.badgeColor = 'bg-danger text-white';
                  }
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        title={mini ? item.label : undefined}
                        className={({ isActive }) =>
                        cn(
                          'group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                          mini ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted hover:text-foreground'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative shrink-0">
                            <item.icon
                              className={cn(
                                'h-4.5 w-4.5 transition-colors',
                                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                              )}
                            />
                            {mini && item.badge && (
                              <span className={cn('absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full', item.badgeColor)} />
                            )}
                          </span>
                          {!mini && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badge && (
                                <span className={cn('ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none', item.badgeColor)}>
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}

        {/* Admin Portal Link */}
        {isAdmin && (
          <div className={cn('mt-2', mini ? 'px-2' : 'px-2')}>
            <NavLink
              to="/admin"
              title={mini ? 'Admin Portal' : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-sm font-medium transition-all duration-150 border',
                  mini ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2',
                  isActive
                    ? 'bg-secondary/10 text-secondary border-secondary/30'
                    : 'text-muted-foreground hover:bg-secondary/5 hover:text-secondary border-border'
                )
              }
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {!mini && <span>Admin Portal</span>}
            </NavLink>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className={cn('border-t border-border py-3 shrink-0', mini ? 'px-2' : 'px-3')}>
        <div className={cn('flex items-center group', mini ? 'flex-col gap-2' : 'gap-2.5')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {initials}
          </div>
          {!mini && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground leading-tight">{user?.fullName || 'User'}</p>
              <p className="truncate text-[11px] text-muted-foreground capitalize leading-tight">
                {user?.role?.replace('_', ' ').toLowerCase() || 'Member'}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sign out"
            className={cn('text-muted-foreground hover:text-danger transition-colors p-1 rounded', !mini && 'ml-auto')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
