import React, { useEffect, useState } from 'react';
import {
  Bell, CheckCheck, AlertTriangle, MessageSquare,
  GitPullRequest, UserPlus, FileText, Check, Plus
} from 'lucide-react';
import { cn } from '../utils/cn';
import { notificationService } from '../services/notification.service';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

function getNotificationIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('document') || t.includes('ingest')) {
    return { Icon: FileText, color: 'text-info bg-info/10 border-info/20' };
  }
  if (t.includes('task') || t.includes('kanban') || t.includes('move')) {
    return { Icon: GitPullRequest, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
  }
  if (t.includes('comment') || t.includes('message') || t.includes('chat')) {
    return { Icon: MessageSquare, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' };
  }
  if (t.includes('error') || t.includes('blocked') || t.includes('danger') || t.includes('risk')) {
    return { Icon: AlertTriangle, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
  }
  if (t.includes('success') || t.includes('approve') || t.includes('done') || t.includes('complete')) {
    return { Icon: CheckCheck, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (t.includes('join') || t.includes('member') || t.includes('add')) {
    return { Icon: UserPlus, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  }
  return { Icon: Bell, color: 'text-primary bg-primary/10 border-primary/20' };
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'notification') {
        fetchNotifications();
      }
    };
    window.addEventListener('pv:refresh', handleRefresh);
    return () => window.removeEventListener('pv:refresh', handleRefresh);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const triggerMockNotification = async () => {
    const titles = [
      'Task assigned to you',
      'Sprint Review Scheduled',
      'Milestone Achieved',
      'System Audit Completed',
      'Database Sync Error',
    ];
    const bodies = [
      'Sarah Manager assigned you "Ingest Documents backend routes".',
      'Review scheduled for Falcon Squad next Monday at 2:00 PM.',
      'Phase 1 Coordination dashboard is 100% complete.',
      'Global security settings audited — 0 vulnerabilities found.',
      'Failed to replicate database node. Retrying connection...',
    ];

    const idx = Math.floor(Math.random() * titles.length);
    try {
      const newNotif = await notificationService.createMockNotification(titles[idx], bodies[idx]);
      setNotifications((prev) => [newNotif, ...prev]);
    } catch (err) {
      console.error('Failed to create mock notification:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay updated with your team activities, automated logs, and project metrics alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerMockNotification}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/90 text-white transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Trigger Mock Alert
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-border border-dashed bg-card p-12 text-center flex flex-col items-center justify-center gap-3">
          <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-1">
            <Bell className="h-6 w-6" />
          </span>
          <h3 className="font-semibold text-foreground">No alerts here</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            You are fully caught up! Click the "Trigger Mock Alert" button above to simulate system logs.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden shadow-sm">
          {notifications.map((n) => {
            const { Icon, color } = getNotificationIcon(n.title);
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-4 p-4 transition-colors',
                  isUnread ? 'bg-primary/5' : 'hover:bg-muted/40'
                )}
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', color)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground">{n.title}</h3>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {n.body}
                  </p>
                  <span className="text-[10px] text-muted-foreground/60 mt-2 block">
                    {formatTimeAgo(n.createdAt)}
                  </span>
                </div>
                {isUnread && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    title="Mark as read"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
