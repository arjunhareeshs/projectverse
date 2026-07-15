import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bell, CheckCheck, AlertTriangle, MessageSquare,
  GitPullRequest, UserPlus, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    return { Icon: FileText, color: 'text-info bg-info/10' };
  }
  if (t.includes('task') || t.includes('kanban') || t.includes('move')) {
    return { Icon: GitPullRequest, color: 'text-amber-500 bg-amber-500/10' };
  }
  if (t.includes('comment') || t.includes('message') || t.includes('chat')) {
    return { Icon: MessageSquare, color: 'text-indigo-500 bg-indigo-500/10' };
  }
  if (t.includes('error') || t.includes('blocked') || t.includes('danger') || t.includes('risk')) {
    return { Icon: AlertTriangle, color: 'text-rose-500 bg-rose-500/10' };
  }
  if (t.includes('success') || t.includes('approve') || t.includes('done') || t.includes('complete')) {
    return { Icon: CheckCheck, color: 'text-emerald-500 bg-emerald-500/10' };
  }
  if (t.includes('join') || t.includes('member') || t.includes('add')) {
    return { Icon: UserPlus, color: 'text-emerald-500 bg-emerald-500/10' };
  }
  return { Icon: Bell, color: 'text-primary bg-primary/10' };
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

export const NotificationsDropdown: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.readAt).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications();
      setItems(data.slice(0, 5)); // only display top 5 in dropdown
    } catch (err) {
      console.error('Failed to load notifications in dropdown:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 8 seconds for a live feel
    const interval = setInterval(fetchNotifications, 8000);

    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'notification') {
        fetchNotifications();
      }
    };
    window.addEventListener('pv:refresh', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pv:refresh', handleRefresh);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleItemClick = async (n: NotificationItem) => {
    if (n.readAt) return;
    try {
      await notificationService.markRead(n.id);
      setItems((prev) =>
        prev.map((it) => (it.id === n.id ? { ...it, readAt: new Date().toISOString() } : it))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
      >
        <Bell className="h-4.5 w-4.5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-card">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => {
                const { Icon, color } = getNotificationIcon(n.title);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/60 hover:bg-muted/60',
                      !n.readAt && 'bg-primary/5 font-medium'
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground leading-snug">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">{n.body}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-1">{formatTimeAgo(n.createdAt)}</p>
                    </div>
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
            className="block w-full px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted/60 border-t border-border transition-colors"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};
