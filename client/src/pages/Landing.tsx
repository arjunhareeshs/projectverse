import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Kanban,
  Users2,
  GitBranch,
  Trophy,
  Code2,
  Calendar,
  ExternalLink,
  CheckCircle2,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { useAppSelector } from '../app/hooks';
import { landingService, PublicHackathon, PublicLeetCodeContest } from '../services/landing.service';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const [hackathons, setHackathons] = useState<PublicHackathon[]>([]);
  const [contests, setContests] = useState<PublicLeetCodeContest[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'hackathons' | 'contests'>('all');

  useEffect(() => {
    let isMounted = true;
    Promise.all([landingService.getHackathons(), landingService.getLeetCodeContests()])
      .then(([h, c]) => {
        if (!isMounted) return;
        setHackathons(h || []);
        setContests(c || []);
      })
      .catch((err) => {
        console.error('Failed to load landing opportunities:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAction = () => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        navigate('/admin/top-teams');
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/login');
    }
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('live') || s.includes('ongoing') || s.includes('active')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (s.includes('register') || s.includes('upcoming')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-purple-100 selection:text-purple-900">
      {/* ─── Navigation ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Exact Brand Logo matching Login Page */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7B2CBF] via-[#3A0CA3] to-[#4361EE] flex items-center justify-center shadow-[0_4px_12px_rgba(123,44,191,0.35)]">
              <span className="text-white font-extrabold text-base tracking-tighter">P</span>
            </div>
            <span className="text-xl font-bold text-[#0F172A] tracking-tight">
              Project<span className="text-[#6D28D9]">Verse</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-[#6D28D9] transition-colors">
              Features
            </a>
            <a href="#workspace" className="hover:text-[#6D28D9] transition-colors">
              Workspace
            </a>
            <a href="#opportunities" className="hover:text-[#6D28D9] transition-colors">
              Opportunities
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#6D28D9] hover:bg-[#5B21B6] rounded-xl transition-all shadow-sm shadow-purple-200 active:scale-95"
            >
              <span>{isAuthenticated ? 'Dashboard' : 'Login'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-22 lg:pb-26 bg-gradient-to-b from-slate-50/70 via-white to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-6 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
            <span>Modern Project Workspace for Innovators</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
            Build, collaborate, and ship{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B2CBF] via-[#6D28D9] to-[#3A0CA3]">
              standout projects
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            ProjectVerse unifies roadmaps, agile Kanban boards, GitHub activity, and performance
            tracking into one seamless, fast, and light-themed workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-bold shadow-md shadow-purple-200 hover:shadow-purple-300 transition-all active:scale-95"
            >
              <span>{isAuthenticated ? 'Open Dashboard' : 'Login'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold border border-slate-200 transition-colors shadow-2xs"
            >
              <span>Explore Features</span>
            </a>
          </div>

          {/* ─── Hero Product Showcase Card ────────────────────────────────────── */}
          <div
            id="workspace"
            className="mt-14 relative rounded-2xl border border-slate-200/90 bg-white p-2 sm:p-4 shadow-xl shadow-slate-200/50"
          >
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-6 text-left">
              {/* Card Topbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  <div className="h-4 w-px bg-slate-200 ml-1" />
                  <span className="text-xs font-bold text-slate-800">
                    Project Alpha • Sprint 4 Live Workspace
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    94% On Track
                  </span>
                </div>
              </div>

              {/* Showcase Content Grid */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Column 1: Task Progress */}
                <div className="rounded-xl bg-white p-4 border border-slate-200/70 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">Sprint Progress</span>
                    <span className="text-xs font-bold text-[#6D28D9]">18 / 20 Done</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                    <div className="bg-[#6D28D9] h-2 rounded-full w-[90%]" />
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Auth & Security Flow
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">Done</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Kanban Drag & Drop
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">Done</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Team Activity */}
                <div className="rounded-xl bg-white p-4 border border-slate-200/70 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">GitHub Sync</span>
                    <span className="text-[11px] text-slate-400">Live Webhook</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5 text-[#6D28D9]" />
                        <span className="font-semibold text-slate-800">feat: analytics-v2</span>
                      </div>
                      <span className="text-[10px] text-slate-400">12m ago</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-semibold text-slate-800">fix: token-refresh</span>
                      </div>
                      <span className="text-[10px] text-slate-400">1h ago</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Team Standings */}
                <div className="rounded-xl bg-white p-4 border border-slate-200/70 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">Team Score</span>
                      <span className="text-xs font-extrabold text-emerald-600">Rank #2</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Continuous evaluation based on commit velocity, milestone completion, and code
                      quality.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-[#6D28D9]">
                    <span>Explore Leaderboard</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-slate-50/60 border-t border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#6D28D9] mb-2">
              Built for Impact
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Everything your team needs to execute
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Streamline project workflows, maintain momentum, and build verifiable proof of work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-[#6D28D9] mb-5">
                <Kanban className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Agile Task Management</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Visual Kanban boards with intuitive status transitions, milestone deadlines, and
                priority tagging tailored for team collaboration.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-[#4361EE] mb-5">
                <Users2 className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Daily Scrums & Logs</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Keep every team member aligned with structured daily updates, blockers, and shared
                meeting summaries.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-5">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">Contribution Heatmaps</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track individual and team velocity with GitHub integration, streak analytics, and
                objective performance metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Opportunities (Hackathons & Contests) ──────────────────────────────── */}
      {(hackathons.length > 0 || contests.length > 0) && (
        <section id="opportunities" className="py-20 bg-white border-t border-slate-200/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#6D28D9] mb-2">
                  Ecosystem & Growth
                </h2>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Curated Hackathons & Contests
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Participate in external challenges, sharpen technical skills, and build real-world
                  experience.
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('hackathons')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'hackathons'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hackathons
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('contests')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'contests'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Contests
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Hackathons */}
              {(activeTab === 'all' || activeTab === 'hackathons') &&
                hackathons.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-slate-300 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(
                            h.status
                          )}`}
                        >
                          {h.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 mb-1.5 line-clamp-1">{h.name}</h4>
                      {h.description && (
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                          {h.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 pt-3 border-t border-slate-100">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{h.dateRange}</span>
                      </div>

                      {h.url && (
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors"
                        >
                          <span>View Event</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

              {/* Contests */}
              {(activeTab === 'all' || activeTab === 'contests') &&
                contests.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-slate-300 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#6D28D9]">
                          <Code2 className="h-5 w-5" />
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 mb-1.5 line-clamp-1">{c.name}</h4>
                      {c.description && (
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 pt-3 border-t border-slate-100">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{c.time}</span>
                      </div>

                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors"
                        >
                          <span>Participate</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Call to Action ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50/70 border-t border-slate-200/70">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-[#7B2CBF] via-[#6D28D9] to-[#3A0CA3] p-8 sm:p-12 text-center text-white shadow-xl shadow-purple-200/50">
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
              Ready to elevate your project execution?
            </h3>
            <p className="mt-3 text-xs sm:text-sm text-purple-100 max-w-xl mx-auto leading-relaxed">
              Join your team on ProjectVerse to collaborate on tasks, track milestone velocity, and
              build standout projects together.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleAction}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#6D28D9] text-xs sm:text-sm font-bold hover:bg-slate-100 transition-all shadow-md active:scale-95"
              >
                <span>{isAuthenticated ? 'Go to Dashboard' : 'Login'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="py-8 bg-white border-t border-slate-200/80 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7B2CBF] via-[#3A0CA3] to-[#4361EE] flex items-center justify-center shadow-xs">
              <span className="text-white font-extrabold text-xs tracking-tighter">P</span>
            </div>
            <span className="font-bold text-slate-800">
              Project<span className="text-[#6D28D9]">Verse</span>
            </span>
            <span>•</span>
            <span>All-in-one Project Workspace</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} ProjectVerse. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
