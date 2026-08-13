import React, { useEffect, useState } from 'react';
import {
  Bell, CheckCheck, AlertTriangle, MessageSquare,
  GitPullRequest, UserPlus, FileText, Check, Plus, X, BellRing
} from 'lucide-react';
import { cn } from '../utils/cn';
import { notificationService } from '../services/notification.service';
import axios from 'axios';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

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

  const handleCreateNotification = async () => {
    const title = createTitle.trim();
    const body = createBody.trim();
    if (!title || !body) return;

    setCreating(true);
    try {
      const newNotif = await notificationService.createNotification(title, body);
      setNotifications((prev) => [newNotif, ...prev]);
      setCreateTitle('');
      setCreateBody('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create notification:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeadlineAlert = async () => {
    setAlerting(true);
    setAlertMessage(null);
    try {
      const newNotif = await notificationService.createDeadlineAlert();
      setNotifications((prev) => [newNotif, ...prev]);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setAlertMessage('No upcoming task deadlines found.');
      } else {
        console.error('Failed to create deadline alert:', err);
        setAlertMessage('Failed to check deadlines.');
      }
    } finally {
      setAlerting(false);
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
            onClick={() => setShowCreateModal(true)}
            title="Write your own notification"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Create
          </button>
          <button
            onClick={handleDeadlineAlert}
            disabled={alerting}
            title="Alert me about my nearest upcoming task deadline"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/90 text-white transition-colors shadow-sm disabled:opacity-60"
          >
            <BellRing className="h-3.5 w-3.5" /> {alerting ? 'Checking...' : 'Alert'}
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

      {alertMessage && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
          <span>{alertMessage}</span>
          <button onClick={() => setAlertMessage(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
            You are fully caught up. New alerts will appear here as your team progresses.
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">New Notification</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Title"
                maxLength={120}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                placeholder="Message"
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNotification}
                disabled={creating || !createTitle.trim() || !createBody.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
              >
                {creating ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
