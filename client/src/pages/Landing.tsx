import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Bot, LayoutDashboard, BarChart3, Zap, Shield, Sparkles, Activity, Layers, Trophy, Code2, ExternalLink, Calendar, Tag } from 'lucide-react';
import { useAppSelector } from '../app/hooks';
import { landingService, PublicHackathon, PublicLeetCodeContest } from '../services/landing.service';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

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

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Parallax and 3D effects for Hero
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.8]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, 100]);
  const heroRotateX = useTransform(scrollYProgress, [0, 0.15], [0, 20]);

  // Features Section transformations
  const featuresOpacity = useTransform(scrollYProgress, [0.1, 0.25], [0, 1]);
  const featuresY = useTransform(scrollYProgress, [0.1, 0.25], [100, 0]);
  
  // Feature Cards Staggered Animation — inlined to satisfy rules-of-hooks
  const card1 = {
    opacity: useTransform(scrollYProgress, [0.20, 0.30], [0, 1]),
    y:       useTransform(scrollYProgress, [0.20, 0.30], [50, 0]),
    scale:   useTransform(scrollYProgress, [0.20, 0.30], [0.8, 1]),
    rotateY: useTransform(scrollYProgress, [0.20, 0.30], [-15, 0]),
    rotateX: useTransform(scrollYProgress, [0.20, 0.30], [15, 0]),
  };
  const card2 = {
    opacity: useTransform(scrollYProgress, [0.25, 0.35], [0, 1]),
    y:       useTransform(scrollYProgress, [0.25, 0.35], [50, 0]),
    scale:   useTransform(scrollYProgress, [0.25, 0.35], [0.8, 1]),
    rotateY: useTransform(scrollYProgress, [0.25, 0.35], [-15, 0]),
    rotateX: useTransform(scrollYProgress, [0.25, 0.35], [15, 0]),
  };
  const card3 = {
    opacity: useTransform(scrollYProgress, [0.30, 0.40], [0, 1]),
    y:       useTransform(scrollYProgress, [0.30, 0.40], [50, 0]),
    scale:   useTransform(scrollYProgress, [0.30, 0.40], [0.8, 1]),
    rotateY: useTransform(scrollYProgress, [0.30, 0.40], [-15, 0]),
    rotateX: useTransform(scrollYProgress, [0.30, 0.40], [15, 0]),
  };

  // CTA Section — pushed down to scroll past the inserted Hackathons / Contests
  // sections (each ~1 viewport tall). The container is min-h-[300vh] so the
  // new sections shift every subsequent range downward.
  const ctaOpacity = useTransform(scrollYProgress, [0.85, 1.0], [0, 1]);
  const ctaScale = useTransform(scrollYProgress, [0.85, 1.0], [0.8, 1]);

  // Public landing content — fetched from /api/public/* so unauthenticated
  // visitors see them too. Empty arrays just hide the section, no errors.
  const [hackathons, setHackathons] = useState<PublicHackathon[]>([]);
  const [contests, setContests] = useState<PublicLeetCodeContest[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([landingService.getHackathons(), landingService.getLeetCodeContests()])
      .then(([h, c]) => {
        if (cancelled) return;
        setHackathons(h);
        setContests(c);
      })
      .catch((err) => console.error('Failed to load landing opportunities:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const statusTone = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('live') || s.includes('ongoing')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    }
    if (s.includes('register') || s.includes('upcoming')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    }
    if (s.includes('closed') || s.includes('over') || s.includes('past')) {
      return 'bg-slate-500/15 text-slate-300 border-slate-400/30';
    }
    return 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30';
  };

  return (
    <div ref={containerRef} className="bg-slate-950 min-h-[500vh] text-slate-100 overflow-clip font-sans selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-slate-950/50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            ProjectVerse
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleAction}
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden md:block"
          >
            {isAuthenticated ? 'Go to Workspace' : 'Sign In'}
          </button>
          <button 
            onClick={handleAction}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all shadow-[0_0_15px_rgba(79,70,229,0.5)] hover:shadow-[0_0_25px_rgba(79,70,229,0.7)]"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
      </nav>

      {/* Grid Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e510_1px,transparent_1px),linear-gradient(to_bottom,#4f46e510_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Hero Section */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden perspective-[1000px]">
        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY, rotateX: heroRotateX }}
          className="relative z-10 flex flex-col items-center text-center px-4 max-w-5xl transform-gpu"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-6 font-medium"
          >
            <Sparkles className="w-4 h-4" />
            <span>The Future of Work is Here</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8"
          >
            Manage projects with <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Agentic Intelligence
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed"
          >
            ProjectVerse combines advanced AI with powerful project management tools to help your team ship faster, smarter, and with unprecedented clarity.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            className="flex items-center gap-4"
          >
            <button 
              onClick={handleAction}
              className="group flex items-center gap-2 px-8 py-4 bg-white text-slate-950 font-semibold rounded-full hover:bg-slate-200 transition-all"
            >
              {isAuthenticated ? 'Open Workspace' : 'Start Building'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </motion.div>
        
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      </div>

      {/* Features Section */}
      <div className="h-screen flex items-center justify-center perspective-[1200px] relative z-10 px-4 md:px-8">
        <motion.div 
          style={{ opacity: featuresOpacity, y: featuresY }}
          className="max-w-6xl w-full"
        >
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything you need. <span className="text-indigo-400">And more.</span></h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">A fully integrated suite of tools designed to enhance productivity and bring your ideas to life.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <motion.div 
              style={{ ...card1 }}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl transform-gpu hover:border-indigo-500/50 transition-colors group"
            >
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Bot className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Assistant</h3>
              <p className="text-slate-400 leading-relaxed">
                Your personal AI co-pilot. Automate tasks, generate reports, and get instant insights into your project's health.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              style={{ ...card2 }}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl transform-gpu hover:border-purple-500/50 transition-colors group"
            >
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Dynamic Workspaces</h3>
              <p className="text-slate-400 leading-relaxed">
                From Kanban boards to Gantt charts, visualize your work exactly how you want. Adaptable to any workflow.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              style={{ ...card3 }}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl transform-gpu hover:border-pink-500/50 transition-colors group"
            >
              <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Analytics</h3>
              <p className="text-slate-400 leading-relaxed">
                Make data-driven decisions with powerful, customizable dashboards that track velocity, bottlenecks, and success.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Opportunities Section — Hackathons */}
      {hackathons.length > 0 && (
        <div className="relative z-10 px-4 md:px-8 py-24 max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-4">
              <Trophy className="w-3.5 h-3.5" />
              <span>Hackathons</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Build. Compete. Ship.</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Curated hackathons across the campus — solve real problems, win prizes, and grow your network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hackathons.map((h) => (
              <div
                key={h.id}
                className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-amber-400/40 transition-colors group flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trophy className="w-6 h-6 text-amber-300" />
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusTone(h.status)}`}>
                    <Tag className="w-3 h-3" />
                    {h.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{h.name}</h3>
                {h.description && (
                  <p className="text-sm text-slate-400 mb-4 line-clamp-3 leading-relaxed">{h.description}</p>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-300 mb-5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{h.dateRange}</span>
                </div>

                {h.url && (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-semibold transition-colors"
                  >
                    View Hackathon <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities Section — Coding Contests */}
      {contests.length > 0 && (
        <div className="relative z-10 px-4 md:px-8 py-12 max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-4">
              <Code2 className="w-3.5 h-3.5" />
              <span>Coding Contests</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Sharpen your skills.</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Weekly LeetCode-style contests recommended for your campus. Practice DSA, climb the leaderboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contests.map((c) => (
              <div
                key={c.id}
                className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-indigo-400/40 transition-colors group flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Code2 className="w-6 h-6 text-indigo-300" />
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusTone(c.status)}`}>
                    <Tag className="w-3 h-3" />
                    {c.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{c.name}</h3>
                {c.description && (
                  <p className="text-sm text-slate-400 mb-4 line-clamp-3 leading-relaxed">{c.description}</p>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-300 mb-5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.time}</span>
                </div>

                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold transition-colors"
                  >
                    Join Contest <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA Section */}
      <div className="h-screen flex items-center justify-center relative z-10 px-4">
        <motion.div 
          style={{ opacity: ctaOpacity, scale: ctaScale }}
          className="max-w-4xl w-full text-center bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 p-12 md:p-24 rounded-[3rem] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900/0 to-slate-900/0" />
          
          <div className="relative z-10">
            <h2 className="text-5xl md:text-6xl font-extrabold mb-6">Ready to transcend?</h2>
            <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
              Join thousands of teams already building the future with ProjectVerse.
            </p>
            <button 
              onClick={handleAction}
              className="px-10 py-5 bg-white text-slate-950 font-bold rounded-full text-lg hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)]"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Create Free Account'}
            </button>
          </div>
        </motion.div>
      </div>

    </div>
  );
};
