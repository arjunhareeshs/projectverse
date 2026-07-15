import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, AlertCircle, Trash2,
  Calendar, User, Tag, Clock, TrendingUp,
} from 'lucide-react';
import { ganttService, GanttTask } from '../services/gantt.service';
import { cn } from '../utils/cn';
import { useChatDock } from '../chat/ChatDockContext';
import axios from 'axios';


// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { color: string; light: string; dot: string }> = {
  Research:     { color: '#7C3AED', light: '#EDE9FE', dot: 'bg-violet-500' },
  Design:       { color: '#EC4899', light: '#FCE7F3', dot: 'bg-pink-500' },
  Development:  { color: '#F97316', light: '#FED7AA', dot: 'bg-orange-500' },
  Testing:      { color: '#10B981', light: '#D1FAE5', dot: 'bg-emerald-500' },
  Presentation: { color: '#3B82F6', light: '#DBEAFE', dot: 'bg-blue-500' },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG);

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  completed:   { label: 'Completed',   color: '#7C3AED', bg: '#EDE9FE', dot: '#7C3AED' },
  'on-track':  { label: 'On Track',    color: '#10B981', bg: '#D1FAE5', dot: '#10B981' },
  'at-risk':   { label: 'At Risk',     color: '#F59E0B', bg: '#FEF3C7', dot: '#F59E0B' },
  todo:        { label: 'Not Started', color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
  'in-progress':{ label: 'On Track',   color: '#10B981', bg: '#D1FAE5', dot: '#10B981' },
};

function getStatus(task: GanttTask) {
  if (task.status === 'completed' || task.status === 'done') return 'completed';
  if (task.status === 'at-risk') return 'at-risk';
  if (task.status === 'in-progress' || task.status === 'on-track') return 'on-track';
  return 'todo';
}

function getStatusCfg(task: GanttTask) {
  return STATUS_CONFIG[getStatus(task)] ?? STATUS_CONFIG['todo'];
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtISO(d: Date) {
  return d.toISOString().split('T')[0];
}

// ── Seed tasks (pre-populate when empty) ──────────────────────────────────────
function buildSeedTasks(projectId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = (daysAgo: number) => fmtISO(addDays(today, -daysAgo));
  const end = (daysAhead: number) => fmtISO(addDays(today, daysAhead));

  return [
    { projectId, title: 'Literature Review', category: 'Research', status: 'completed', startDate: start(25), dueDate: end(-10), progress: 100 },
    { projectId, title: 'User Surveys', category: 'Research', status: 'on-track', startDate: start(18), dueDate: end(-4), progress: 80 },
    { projectId, title: 'Wireframing', category: 'Design', status: 'on-track', startDate: start(10), dueDate: end(13), progress: 60 },
    { projectId, title: 'UI Prototype', category: 'Design', status: 'at-risk', startDate: start(3), dueDate: end(50), progress: 30 },
    { projectId, title: 'Backend API', category: 'Development', status: 'on-track', startDate: start(5), dueDate: end(25), progress: 45 },
    { projectId, title: 'Frontend Dev', category: 'Development', status: 'todo', startDate: end(5), dueDate: end(35), progress: 10 },
    { projectId, title: 'Unit Testing', category: 'Testing', status: 'todo', startDate: end(10), dueDate: end(37), progress: 0 },
    { projectId, title: 'Final Presentation', category: 'Presentation', status: 'todo', startDate: end(20), dueDate: end(47), progress: 0 },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────
export const TimelineGantt: React.FC = () => {
  const { isOpen: chatOpen } = useChatDock();
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (chatOpen) {
      setSelectedTask(null);
    }
  }, [chatOpen]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Form state
  const [form, setForm] = useState({
    projectId: '', title: '', category: 'Development', status: 'todo',
    startDate: fmtISO(new Date()), dueDate: fmtISO(addDays(new Date(), 14)),
    progress: 0, description: '', assigneeName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ganttService.getTasks();
      if (data.length === 0) {
        // Seed: need a project first
        const token = localStorage.getItem('pv_token');
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const projRes = await axios.get(`${apiBase}/projects`, { headers: { Authorization: `Bearer ${token}` } });
        const projs = projRes.data ?? [];
        if (projs.length > 0) {
          for (const seed of buildSeedTasks(projs[0].id)) {
            await ganttService.createTask(seed);
          }
          const refreshed = await ganttService.getTasks();
          setTasks(refreshed);
        }
      } else {
        setTasks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const token = localStorage.getItem('pv_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const res = await axios.get(`${apiBase}/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const list = res.data ?? [];
      setProjects(list);
      if (list.length > 0) setForm(f => ({ ...f, projectId: list[0].id }));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, [fetchTasks, fetchProjects]);

  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'task') {
        fetchTasks();
      }
    };
    window.addEventListener('pv:refresh', handleRefresh);
    return () => window.removeEventListener('pv:refresh', handleRefresh);
  }, [fetchTasks]);

  // ── Date window ─────────────────────────────────────────────────────────────
  const { gridStart, totalDays, today, weeks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (tasks.length === 0) {
      const s = addDays(today, -14);
      const weeks: { label: string; days: Date[] }[] = [];
      let cur = new Date(s);
      for (let w = 0; w < 8; w++) {
        const days: Date[] = [];
        for (let d = 0; d < 7; d++) { days.push(new Date(cur)); cur = addDays(cur, 1); }
        weeks.push({ label: fmtDate(days[0]), days });
      }
      return { gridStart: s, totalDays: 56, today, weeks };
    }

    const dates = tasks.flatMap(t => [
      t.startDate ? new Date(t.startDate) : null,
      t.dueDate ? new Date(t.dueDate) : null,
    ]).filter(Boolean) as Date[];

    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    const s = addDays(minD, -7);
    const totalDays = daysBetween(s, addDays(maxD, 14));

    const weeks: { label: string; days: Date[] }[] = [];
    let cur = new Date(s);
    while (daysBetween(s, cur) < totalDays) {
      const days: Date[] = [];
      for (let d = 0; d < 7 && daysBetween(s, cur) < totalDays; d++) {
        days.push(new Date(cur));
        cur = addDays(cur, 1);
      }
      weeks.push({ label: fmtDate(days[0]), days });
    }

    return { gridStart: s, totalDays, today, weeks };
  }, [tasks]);

  const DAY_W = 28; // px per day

  function dayOffset(date: Date | string | null) {
    if (!date) return 0;
    const d = typeof date === 'string' ? new Date(date) : date;
    d.setHours(0, 0, 0, 0);
    return Math.max(0, daysBetween(gridStart, d));
  }

  const todayOffset = daysBetween(gridStart, today);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => getStatus(t) === 'completed').length;
    const onTrack = tasks.filter(t => getStatus(t) === 'on-track').length;
    const atRisk = tasks.filter(t => getStatus(t) === 'at-risk').length;
    const avgProgress = total > 0 ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total) : 0;
    return { total, completed, onTrack, atRisk, avgProgress };
  }, [tasks]);

  // ── Filtered tasks ──────────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    if (!activeCategory) return tasks;
    return tasks.filter(t => t.category === activeCategory);
  }, [tasks, activeCategory]);

  // ── Add task ────────────────────────────────────────────────────────────────
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.projectId || !form.title) { setFormError('Project and title are required'); return; }
    setSubmitting(true);
    try {
      await ganttService.createTask({
        projectId: form.projectId,
        title: form.title,
        category: form.category,
        status: form.status,
        startDate: form.startDate,
        dueDate: form.dueDate,
        progress: Number(form.progress),
        description: form.description || undefined,
      });
      setShowModal(false);
      fetchTasks();
    } catch (e: any) {
      setFormError(e.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await ganttService.deleteTask(taskId);
      if (selectedTask?.id === taskId) setSelectedTask(null);
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-5rem)] bg-[#F8F8FF] font-sans text-[#1A1740]">

      {/* ── Top Stats ── */}
      <div className="bg-white border-b border-[#EEEDF8] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          {[
            { label: 'Total Tasks',  value: stats.total,       color: '#1A1740' },
            { label: 'Completed',    value: stats.completed,   color: '#7C3AED' },
            { label: 'On Track',     value: stats.onTrack,     color: '#10B981' },
            { label: 'At Risk',      value: stats.atRisk,      color: '#F59E0B' },
            { label: 'Avg Progress', value: `${stats.avgProgress}%`, color: '#3B82F6' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="text-2xl font-black" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[10px] font-semibold text-[#A0A0B8] whitespace-nowrap">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-1 min-w-[200px] max-w-[360px]">
          <span className="text-xs font-semibold text-[#A0A0B8] whitespace-nowrap">Overall Progress</span>
          <div className="flex-1 h-2 rounded-full bg-[#EDE9FE] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] rounded-full transition-all duration-500"
              style={{ width: `${stats.avgProgress}%` }} />
          </div>
          <span className="text-xs font-black text-[#7C3AED]">{stats.avgProgress}%</span>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-all shadow-[0_3px_10px_rgba(124,58,237,0.28)]"
        >
          <Plus className="h-3.5 w-3.5" /> Add Task
        </button>
      </div>

      {/* ── Category Legend ── */}
      <div className="bg-white border-b border-[#EEEDF8] px-6 py-2.5 flex items-center gap-6">
        <span className="text-[10px] font-black text-[#A0A0B8] uppercase tracking-wider">Categories</span>
        {CATEGORIES.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(active ? null : cat)}
              className={cn(
                'flex items-center gap-1.5 text-xs font-bold transition-all px-2.5 py-1 rounded-full',
                active ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'
              )}
              style={{ color: cfg.color, ...(active ? { ringColor: cfg.color } : {}) }}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cfg.color }} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <div className="w-[300px] shrink-0 border-r border-[#EEEDF8] bg-white flex flex-col overflow-y-auto">
          {/* Column headers */}
          <div className="grid grid-cols-2 border-b border-[#EEEDF8] px-4 py-2 bg-[#FAFAFF] sticky top-0 z-10">
            <span className="text-[9px] font-black text-[#A0A0B8] uppercase tracking-widest">Task</span>
            <span className="text-[9px] font-black text-[#A0A0B8] uppercase tracking-widest text-right">Status</span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#A0A0B8] p-6">
              <Clock className="h-8 w-8 opacity-30" />
              <p className="text-xs font-semibold">No tasks found</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const catCfg = CATEGORY_CONFIG[task.category || 'Development'] ?? CATEGORY_CONFIG.Development;
              const stCfg = getStatusCfg(task);
              const isSelected = selectedTask?.id === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(isSelected ? null : task)}
                  className={cn(
                    'border-b border-[#EEEDF8] px-4 py-3 cursor-pointer hover:bg-[#FAFAFF] transition-colors',
                    isSelected && 'bg-[#F0EBFF]'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Avatar + info */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: catCfg.color }}
                      >
                        {task.assignee ? initials(task.assignee.fullName) : task.category?.slice(0, 2).toUpperCase() ?? 'T?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#1A1740] truncate leading-tight">{task.title}</p>
                        <p className="text-[9px] text-[#A0A0B8] truncate mt-0.5">
                          {task.category ?? 'Dev'} · {task.assignee?.fullName ?? 'Unassigned'}
                        </p>
                        {task.dueDate && (
                          <p className="text-[9px] text-[#B0B0C4] mt-1 flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            Due {fmtDate(new Date(task.dueDate))}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status + % */}
                    <div className="flex flex-col items-end shrink-0 gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[8px] font-black whitespace-nowrap flex items-center gap-1"
                        style={{ color: stCfg.color, backgroundColor: stCfg.bg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stCfg.dot }} />
                        {stCfg.label}
                      </span>
                      <div className="w-20">
                        <div className="h-1.5 rounded-full bg-[#F0EFFC] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${task.progress}%`, backgroundColor: catCfg.color }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[8px] font-bold text-[#A0A0B8]">{task.progress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Gantt Grid ── */}
        <div className="flex-1 overflow-x-auto overflow-y-auto relative" ref={gridRef}>
          <div style={{ minWidth: totalDays * DAY_W + 'px' }}>
            {/* Date header */}
            <div className="sticky top-0 z-10 bg-white border-b border-[#EEEDF8]">
              {/* Week row */}
              <div className="flex border-b border-[#EEEDF8]">
                {weeks.map((w, wi) => (
                  <div
                    key={wi}
                    className="flex-shrink-0 border-r border-[#EEEDF8] px-2 py-1.5 text-[9px] font-black text-[#A0A0B8] uppercase tracking-wider"
                    style={{ width: w.days.length * DAY_W + 'px' }}
                  >
                    {w.label}
                  </div>
                ))}
              </div>

              {/* Day numbers row */}
              <div className="flex">
                {weeks.flatMap(w => w.days).map((day, di) => {
                  const isToday = day.toDateString() === today.toDateString();
                  return (
                    <div
                      key={di}
                      className={cn(
                        'flex-shrink-0 text-center py-1 text-[9px] font-bold border-r border-[#EEEDF8]/50',
                        isToday ? 'bg-[#7C3AED] text-white' : 'text-[#B0B0C4]'
                      )}
                      style={{ width: DAY_W + 'px' }}
                    >
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task rows */}
            <div className="relative">
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#7C3AED]/60 z-20 pointer-events-none"
                style={{ left: todayOffset * DAY_W + DAY_W / 2 + 'px' }}
              />

              {filteredTasks.map((task, ti) => {
                if (!task.startDate || !task.dueDate) {
                  return (
                    <div
                      key={task.id}
                      className="h-[72px] border-b border-[#EEEDF8]/60 bg-[#FAFAFF]/30"
                    />
                  );
                }

                const catCfg = CATEGORY_CONFIG[task.category || 'Development'] ?? CATEGORY_CONFIG.Development;
                const left = dayOffset(task.startDate) * DAY_W;
                const width = Math.max(DAY_W, daysBetween(new Date(task.startDate), new Date(task.dueDate)) * DAY_W);
                const dueOffset = dayOffset(task.dueDate);
                const isLate = new Date(task.dueDate) < today && getStatus(task) !== 'completed';
                const isSelected = selectedTask?.id === task.id;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'relative h-[72px] border-b border-[#EEEDF8]/60 hover:bg-[#FAFAFF] transition-colors',
                      isSelected && 'bg-[#F5F3FF]'
                    )}
                    style={{ backgroundImage: ti % 2 === 0 ? undefined : 'none' }}
                  >
                    {/* Grid lines */}
                    {weeks.flatMap(w => w.days).map((_, di) => (
                      <div
                        key={di}
                        className="absolute top-0 bottom-0 border-r border-[#EEEDF8]/40 pointer-events-none"
                        style={{ left: di * DAY_W + 'px', width: DAY_W + 'px' }}
                      />
                    ))}

                    {/* Gantt bar */}
                    <div
                      onClick={() => setSelectedTask(isSelected ? null : task)}
                      className="absolute top-1/2 -translate-y-1/2 rounded-full flex items-center px-3 cursor-pointer hover:brightness-95 transition-all shadow-sm z-10"
                      style={{
                        left: left + 'px',
                        width: width + 'px',
                        backgroundColor: catCfg.light,
                        border: `1.5px solid ${catCfg.color}22`,
                        height: '32px',
                      }}
                    >
                      {/* Fill progress overlay */}
                      <div
                        className="absolute left-0 top-0 h-full rounded-full opacity-50"
                        style={{ width: `${task.progress}%`, backgroundColor: catCfg.color }}
                      />
                      <span
                        className="text-[10px] font-extrabold truncate relative z-10"
                        style={{ color: catCfg.color }}
                      >
                        {task.title}
                      </span>

                      {/* Late badge */}
                      {isLate && (
                        <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[7px] font-black uppercase tracking-wider rounded relative z-10 shrink-0">
                          LATE
                        </span>
                      )}
                    </div>

                    {/* Diamond at due date */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                      style={{ left: dueOffset * DAY_W + DAY_W / 2 - 6 + 'px' }}
                    >
                      <div
                        className="h-3 w-3 rotate-45 border-2"
                        style={{ borderColor: isLate ? '#EF4444' : catCfg.color, backgroundColor: 'white' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Detail Drawer ── */}
        {selectedTask && (() => {
          const catCfg = CATEGORY_CONFIG[selectedTask.category || 'Development'] ?? CATEGORY_CONFIG.Development;
          const stCfg = getStatusCfg(selectedTask);
          const dur = selectedTask.startDate && selectedTask.dueDate
            ? daysBetween(new Date(selectedTask.startDate), new Date(selectedTask.dueDate))
            : null;
          const isLate = selectedTask.dueDate && new Date(selectedTask.dueDate) < today && getStatus(selectedTask) !== 'completed';

          // Donut
          const r = 32, circ = 2 * Math.PI * r;
          const dash = (selectedTask.progress / 100) * circ;

          return (
            <div className="w-[280px] shrink-0 border-l border-[#EEEDF8] bg-white flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-[#EEEDF8]">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{ color: catCfg.color, backgroundColor: catCfg.light }}
                  >
                    {selectedTask.category}
                  </span>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h2 className="text-sm font-extrabold text-[#1A1740] leading-tight mt-2">{selectedTask.title}</h2>
              </div>

              {/* Body */}
              <div className="flex-1 p-4 flex flex-col gap-4">
                {/* Donut progress */}
                <div className="flex flex-col items-center gap-1">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="40" cy="40" r={r} fill="none" stroke="#F5F4FC" strokeWidth="7" />
                      <circle
                        cx="40" cy="40" r={r} fill="none"
                        stroke={catCfg.color} strokeWidth="7"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-black text-[#1A1740]">{selectedTask.progress}%</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[#A0A0B8]">{100 - selectedTask.progress}% remaining</span>
                </div>

                {/* Status */}
                <div>
                  <span
                    className="px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 w-fit"
                    style={{ color: stCfg.color, backgroundColor: stCfg.bg }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stCfg.dot }} />
                    {stCfg.label}
                  </span>
                </div>

                {/* Start / End */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#F8F8FF] border border-[#EEEDF8] p-2.5">
                    <p className="text-[8px] font-black text-[#A0A0B8] uppercase tracking-wider mb-1">Start Date</p>
                    <p className="text-sm font-extrabold text-[#1A1740]">
                      {selectedTask.startDate ? fmtDate(new Date(selectedTask.startDate)) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F8F8FF] border border-[#EEEDF8] p-2.5">
                    <p className="text-[8px] font-black text-[#A0A0B8] uppercase tracking-wider mb-1">End Date</p>
                    <p className="text-sm font-extrabold text-[#1A1740]">
                      {selectedTask.dueDate ? fmtDate(new Date(selectedTask.dueDate)) : '—'}
                    </p>
                  </div>
                </div>

                {/* Due date */}
                <div className={cn(
                  'rounded-lg border p-2.5',
                  isLate ? 'bg-red-50 border-red-200' : 'bg-[#F8F8FF] border-[#EEEDF8]'
                )}>
                  <p className="text-[8px] font-black text-[#A0A0B8] uppercase tracking-wider mb-1">Due Date</p>
                  <p className={cn('text-sm font-extrabold', isLate ? 'text-red-500' : 'text-[#1A1740]')}>
                    {selectedTask.dueDate ? fmtDate(new Date(selectedTask.dueDate)) : '—'}
                  </p>
                  {isLate && (
                    <p className="text-[9px] text-red-500 font-bold mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Overdue
                    </p>
                  )}
                </div>

                {/* Duration */}
                {dur !== null && (
                  <div className="rounded-lg bg-[#F8F8FF] border border-[#EEEDF8] p-2.5">
                    <p className="text-[8px] font-black text-[#A0A0B8] uppercase tracking-wider mb-1">Duration</p>
                    <p className="text-sm font-extrabold text-[#1A1740]">{dur} day{dur !== 1 ? 's' : ''}</p>
                  </div>
                )}

                {/* Assignee */}
                <div>
                  <p className="text-[8px] font-black text-[#A0A0B8] uppercase tracking-wider mb-2">Assignee</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                      style={{ backgroundColor: catCfg.color }}
                    >
                      {selectedTask.assignee ? initials(selectedTask.assignee.fullName) : '??'}
                    </div>
                    <span className="text-xs font-bold text-[#1A1740]">
                      {selectedTask.assignee?.fullName ?? 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[8px] font-black text-[#A0A0B8] uppercase tracking-wider">Progress</p>
                    <span className="text-xs font-black" style={{ color: catCfg.color }}>{selectedTask.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F0EFFC] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${selectedTask.progress}%`, backgroundColor: catCfg.color }}
                    />
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(selectedTask.id)}
                  className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Task
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Add Task Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1740]/40 backdrop-blur-[4px] p-4">
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[440px] bg-white rounded-2xl border border-[#EEEDF8] shadow-[0_24px_64px_rgba(26,23,64,0.22)] p-6 flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#EEEDF8] pb-3">
              <h2 className="font-extrabold text-sm text-[#1A1740] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#7C3AED]" /> Add Gantt Task
              </h2>
              <button onClick={() => setShowModal(false)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="flex flex-col gap-3">
              {formError && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-50 p-3 flex items-center gap-2 text-rose-500 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
                </div>
              )}

              {/* Project */}
              <div>
                <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">Project</label>
                <select
                  value={form.projectId}
                  onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">Task Title</label>
                <input
                  type="text" value={form.title} required
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Backend API Integration"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              {/* Category + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  >
                    <option value="todo">Not Started</option>
                    <option value="on-track">On Track</option>
                    <option value="in-progress">In Progress</option>
                    <option value="at-risk">At Risk</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Start + Due dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">Start Date</label>
                  <input
                    type="date" value={form.startDate} required
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">Due Date</label>
                  <input
                    type="date" value={form.dueDate} required
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider">Progress</label>
                  <span className="text-xs font-black text-[#7C3AED]">{form.progress}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5}
                  value={form.progress}
                  onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
                  className="w-full accent-[#7C3AED]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-extrabold text-[#A0A0B8] uppercase tracking-wider block mb-1">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Add notes..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#EEEDF8] bg-[#FCFCFF] text-[#1A1740] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#EEEDF8]">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold border border-[#EEEDF8] rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-60">
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
