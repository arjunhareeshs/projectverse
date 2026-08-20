import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Kanban,
  GanttChart,
  Users,
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Rocket,
  Lightbulb,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { notificationService } from '../services/notification.service';
import { teamService } from '../services/team.service';

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

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [, setActiveProjectId] = useState<string | null>(null);

  const fetchActiveProject = useCallback(async () => {
    if (!user?.teamId) {
      setActiveProjectId(null);
      return;
    }
    try {
      const projects = await teamService.getTeamProjects(user.teamId!);
      if (Array.isArray(projects) && projects.length > 0) {
        const active = projects.find((p: any) => !p.isTemplate) || projects[0];
        if (active && active.id) {
          setActiveProjectId(active.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active project for sidebar:', err);
    }
  }, [user?.teamId]);

  useEffect(() => {
    fetchActiveProject();

    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'project-selected') {
        fetchActiveProject();
      }
    };
    window.addEventListener('pv:refresh', handleRefresh);

    return () => {
      window.removeEventListener('pv:refresh', handleRefresh);
    };
  }, [fetchActiveProject]);

  const navSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' }],
    },
    {
      title: 'PROJECTS',
      items: [
        {
          icon: Rocket,
          label: 'My Projects',
          to: '/projects',
        },
        { icon: FolderOpen, label: 'All Projects', to: '/projects/catalog' },
        { icon: Lightbulb, label: 'Propose Idea', to: '/projects/propose' },
        { icon: Kanban, label: 'Kanban Board', to: '/kanban' },
        { icon: GanttChart, label: 'Timeline & Gantt', to: '/timeline' },
        { icon: Users, label: 'Team', to: user?.teamId ? `/teams/${user.teamId}` : '/teams' },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
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
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border bg-card overflow-hidden"
      style={{ width: 256 }}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-2.5 h-16 px-4 border-b border-border shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm shrink-0 interactive-tap">
          <span>PV</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-base font-bold text-foreground leading-tight tracking-tight truncate">
            ProjectVerse
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-1">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1.5">
            <button
              onClick={() => toggleSection(section.title)}
              className="flex w-full items-center gap-1 px-2 py-1 mb-1 group"
            >
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                {section.title}
              </span>
              {collapsed[section.title] ? (
                <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {!collapsed[section.title] && (
              <ul className="space-y-0.5">
                {section.items.map((rawItem) => {
                  const item = { ...rawItem };
                  if (item.to === '/notifications') {
                    item.badge = unreadCount > 0 ? String(unreadCount) : undefined;
                    item.badgeColor = 'bg-danger text-primary-foreground';
                  }
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/projects' || item.to === '/dashboard'}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-2.5 px-3 py-2 rounded-btn text-sm font-medium transition-all duration-150',
                            isActive
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={cn(
                                'h-4.5 w-4.5 transition-colors shrink-0',
                                isActive
                                  ? 'text-primary'
                                  : 'text-muted-foreground group-hover:text-foreground',
                              )}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span
                                className={cn(
                                  'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                                  item.badgeColor,
                                )}
                              >
                                {item.badge}
                              </span>
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
          <div className="mt-2 px-1">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-btn text-sm font-medium transition-all duration-150 border',
                  isActive
                    ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
                    : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground border-border/80',
                )
              }
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Admin Portal</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="border-t border-border py-3 px-3 shrink-0">
        <div className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold ring-2 ring-primary/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground leading-tight">
              {user?.fullName || 'User'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground capitalize leading-tight">
              {user?.role?.replace('_', ' ').toLowerCase() || 'Member'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors p-1.5 rounded-md interactive-tap ml-auto"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
