import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  MoreHorizontal,
  AlertTriangle,
  ChevronDown,
  Filter,
  User,
  Tag,
  Loader2,
  Circle,
  CheckCircle2,
  ArrowRight,
  Eye,
  X,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { cn } from '../utils/cn';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { authService } from '../services/auth.service';

interface TaskCard {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  projectId: string;
  projectName?: string;
}

interface Project {
  id: string;
  name: string;
  initials: string;
  color: string;
}

type KanbanStatus = 'todo' | 'in-progress' | 'in-review' | 'done';

interface Column {
  id: KanbanStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  headerBg: string;
}

const COLUMNS: Column[] = [
  { id: 'todo', label: 'To Do', icon: Circle, color: 'border-muted-foreground/30', headerBg: 'bg-muted/50' },
  { id: 'in-progress', label: 'In Progress', icon: ArrowRight, color: 'border-primary/30', headerBg: 'bg-primary/5' },
  { id: 'in-review', label: 'In Review', icon: Eye, color: 'border-warning/30', headerBg: 'bg-warning/5' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'border-success/30', headerBg: 'bg-success/5' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-red-500', dot: 'bg-red-500' },
  high: { label: 'High', color: 'text-orange-500', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-500', dot: 'bg-yellow-500' },
  low: { label: 'Low', color: 'text-success', dot: 'bg-success' },
};

const PROJECT_COLORS = ['bg-primary', 'bg-warning', 'bg-secondary', 'bg-success'];

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export const KanbanBoard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanStatus | null>(null);

  // Task creation states
  const [users, setUsers] = useState<any[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskStatus, setTaskStatus] = useState<KanbanStatus>('todo');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadTasks = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    try {
      const data = await taskService.getProjectTasks(selectedProjectId);
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await projectService.getActiveProjects();
        const colored = data.map((p: Project, i: number) => ({
          ...p,
          color: PROJECT_COLORS[i % PROJECT_COLORS.length],
        }));
        setProjects(colored);
        if (colored.length > 0) {
          setSelectedProjectId(colored[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [selectedProjectId, loadTasks]);

  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'task') {
        loadTasks();
      }
    };
    window.addEventListener('pv:refresh', handleRefresh);
    return () => window.removeEventListener('pv:refresh', handleRefresh);
  }, [loadTasks]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const u = await authService.getUsers();
        setUsers(u);
      } catch (err) {
        console.error('Failed to load users for assignment:', err);
      }
    };
    loadUsers();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!taskTitle.trim() || !selectedProjectId) {
      setCreateError('Task Title and selected project are required');
      return;
    }
    setCreating(true);
    try {
      const newTask = await taskService.createTask({
        projectId: selectedProjectId,
        title: taskTitle,
        description: taskDesc || undefined,
        priority: taskPriority,
        status: taskStatus,
        assigneeId: taskAssigneeId || undefined,
        dueDate: taskDueDate || undefined,
      });

      // Reload tasks to get the fully populated assignee user fields
      await loadTasks();

      // Reset form & close
      setTaskTitle('');
      setTaskDesc('');
      setTaskPriority('medium');
      setTaskAssigneeId('');
      setTaskDueDate('');
      setCreateModalOpen(false);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const getTasksByStatus = useCallback(
    (status: KanbanStatus) => tasks.filter((t) => t.status === status),
    [tasks]
  );

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };

  const handleDrop = async (e: React.DragEvent, colId: KanbanStatus) => {
    e.preventDefault();
    if (!draggingId) return;

    // Optimistically update UI
    setTasks((prev) =>
      prev.map((t) => (t.id === draggingId ? { ...t, status: colId } : t))
    );
    setDraggingId(null);
    setDragOverCol(null);

    // Persist to backend
    try {
      await taskService.updateTaskStatus(draggingId, colId);
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const openForStatus = (status: KanbanStatus) => {
    setTaskStatus(status);
    setCreateModalOpen(true);
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">Kanban Board</h1>
            {selectedProject && (
              <p className="text-xs text-muted-foreground">{selectedProject.name}</p>
            )}
          </div>

          {/* Project Selector */}
          <div className="relative">
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-background pl-3 pr-8 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button
            onClick={() => openForStatus('todo')}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-4 p-6 h-full min-w-max">
            {COLUMNS.map((col) => {
              const colTasks = getTasksByStatus(col.id);
              const isOver = dragOverCol === col.id;

              return (
                <div
                  key={col.id}
                  className={cn(
                    'flex flex-col w-72 shrink-0 rounded-xl border-2 transition-all duration-200',
                    col.color,
                    isOver && 'border-primary/60 shadow-md'
                  )}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  onDragLeave={() => setDragOverCol(null)}
                >
                  {/* Column Header */}
                  <div className={cn('flex items-center justify-between px-4 py-3 rounded-t-[10px]', col.headerBg)}>
                    <div className="flex items-center gap-2">
                      <col.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{col.label}</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {colTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => openForStatus(col.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {colTasks.length === 0 && (
                      <div className={cn(
                        'rounded-lg border-2 border-dashed p-4 text-center transition-colors',
                        isOver ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                      )}>
                        <p className="text-xs text-muted-foreground">Drop tasks here</p>
                      </div>
                    )}

                    {colTasks.map((task) => {
                      const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                      const isDragging = draggingId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            'group rounded-xl border border-border bg-card p-3.5 cursor-grab active:cursor-grabbing',
                            'hover:shadow-md hover:border-border/80 transition-all duration-200',
                            isDragging && 'opacity-40 scale-95'
                          )}
                        >
                          {/* Priority & Menu */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('h-2 w-2 rounded-full', priorityInfo.dot)} />
                              <span className={cn('text-[10px] font-semibold uppercase tracking-wider', priorityInfo.color)}>
                                {priorityInfo.label}
                              </span>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Title */}
                          <p className="text-sm font-semibold text-foreground mb-3 leading-snug">
                            {task.title}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            {task.assignee ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-[9px] font-bold text-primary">
                                    {getInitials(task.assignee.fullName)}
                                  </span>
                                </div>
                                <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                                  {task.assignee.fullName.split(' ')[0]}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground/60">
                                <User className="h-3.5 w-3.5" />
                                <span className="text-[11px]">Unassigned</span>
                              </div>
                            )}

                            {task.priority === 'critical' && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add card CTA */}
                    <button
                      onClick={() => openForStatus(col.id)}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add task
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Creation Modal Dialog */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Create New Task
              </h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 flex flex-col gap-4">
              {createError && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 flex items-start gap-2 text-rose-500 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Design Landing Page"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Description
                </label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Provide more context..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Column / Status
                  </label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as KanbanStatus)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="in-review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="border-t border-border/60 pt-4 mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-colors flex items-center gap-1"
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
