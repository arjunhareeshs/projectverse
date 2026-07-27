import React, { useState } from 'react';
import { Github, CheckCircle2, User as UserIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setUser } from '../features/auth/authSlice';
import { authService } from '../services/auth.service';

export const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [githubUsername, setGithubUsername] = useState(user?.githubUsername || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await authService.updateGithubUsername(githubUsername.trim() || null);
      dispatch(setUser({ ...user!, githubUsername: result.githubUsername }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save GitHub username');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{user?.fullName || 'Profile'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Registration No.</span>
            <span className="font-semibold text-foreground">{user?.regNo || 'Not set'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Team</span>
            <span className="font-semibold text-foreground">{user?.team?.name || 'No team'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Department</span>
            <span className="font-semibold text-foreground">{user?.department || user?.deptCode || 'Not set'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Domain</span>
            <span className="font-semibold text-foreground">{user?.ssgDomain || 'Not set'}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Github className="w-4.5 h-4.5 text-foreground" />
          <h2 className="text-sm font-bold text-foreground">GitHub Account</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Link your GitHub username so your commits and contributions on your team's repository
          count toward your individual performance ranking.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
            <span className="text-muted-foreground text-sm">github.com/</span>
            <input
              type="text"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="your-username"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saved && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> GitHub username saved.
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <UserIcon className="w-3.5 h-3.5" />
        More profile settings are coming soon.
      </div>
    </div>
  );
};
