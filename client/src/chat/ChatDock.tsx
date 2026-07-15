import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Send,
  Plus,
  Paperclip,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Loader2,
  User,
  X,
  Maximize2,
  Minimize2,
  Wrench,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import { AuroraIcon } from '../components/AuroraIcon';
import { useChatDock, CHAT_NORMAL, CHAT_EXPANDED } from './ChatDockContext';
import {
  renderMessageContent,
  QUICK_PROMPTS,
  WELCOME_MESSAGE,
  type Message,
} from './aiResponse';
import { aiService, type AiStreamEvent } from '../services/ai.service';

// Route map for nav.to events
const ROUTE_MAP: Record<string, string> = {
  project: '/projects',
  projects: '/projects',
  tasks: '/tasks',
  team: '/team',
  schedule: '/schedule',
  dashboard: '/dashboard',
  notifications: '/notifications',
  documents: '/documents',
};

interface ToolEvent {
  tool: string;
  args?: Record<string, unknown>;
  done?: boolean;
}

interface BrowserStep {
  step_type: string;
  target: string;
  status: 'running' | 'done' | 'failed';
}

const STEP_ICONS: Record<string, string> = {
  navigate: '🌐',
  click:    '🖱️',
  fill:     '✍️',
  select:   '📋',
  submit:   '📤',
  wait_for: '⏳',
  read_text:'📖',
  screenshot:'📸',
  wait_ms:  '⏱️',
  verify:   '✅',
  retry:    '🔄',
};

export const ChatDock: React.FC = () => {
  const { isOpen, isExpanded, toggle, close, toggleExpand, chatWidth } = useChatDock();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('pv_chat_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch {
        // fallback
      }
    }
    return [{ id: '0', role: 'assistant', content: WELCOME_MESSAGE, timestamp: new Date() }];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeTools, setActiveTools] = useState<ToolEvent[]>([]);
  const [browserSteps, setBrowserSteps] = useState<BrowserStep[]>([]);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const doneRef = useRef<boolean>(false); // guard: 'done' event processed only once per turn

  useEffect(() => {
    localStorage.setItem('pv_chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingContent, activeTools]);

  // Close on Escape while open
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  const resetConversation = () => {
    if (abortRef.current) abortRef.current.abort();
    const welcome = [{ id: '0', role: 'assistant', content: WELCOME_MESSAGE, timestamp: new Date() }];
    setMessages(welcome);
    localStorage.setItem('pv_chat_messages', JSON.stringify(welcome));
    setStreamingContent('');
    setActiveTools([]);
    setIsTyping(false);
  };

  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);
    setStreamingContent('');
    setActiveTools([]);

    // Abort any existing stream
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    doneRef.current = false; // reset for this turn

    let accumulated = '';
    const assistantId = (Date.now() + 1).toString();

    const onEvent = (evt: AiStreamEvent) => {
      switch (evt.event) {
        case 'text.delta':
          accumulated += evt.text;
          setStreamingContent(accumulated);
          break;

        case 'tool.call':
          setActiveTools((prev) => [...prev, { tool: evt.tool, args: evt.args }]);
          break;

        case 'tool.result':
          setActiveTools((prev) =>
            prev.map((t) => t.tool === evt.tool ? { ...t, done: true } : t)
          );
          break;

        case 'nav.to': {
          // AI triggered navigation
          const route = evt.route || '';
          const destination = ROUTE_MAP[route] || (route.startsWith('/') ? route : `/${route}`);
          setTimeout(() => navigate(destination), 800);
          break;
        }

        case 'state.refresh': {
          // Agent completed a write action — tell the page to refresh its data
          window.dispatchEvent(new CustomEvent('pv:refresh', { detail: { type: (evt as any).type } }));
          break;
        }

        case 'done': {
          if (doneRef.current) return; // guard against duplicate done events
          doneRef.current = true;
          const finalContent = accumulated || 'Done.';
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: finalContent, timestamp: new Date() },
          ]);
          setStreamingContent('');
          setActiveTools([]);
          setBrowserSteps([]);
          setIsTyping(false);
          break;
        }

        case 'tool.progress': {
          const { step_type, target, status } = evt as any;
          setBrowserSteps(prev => {
            const idx = prev.findIndex(s => s.step_type === step_type && s.target === target && s.status === 'running');
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { step_type, target, status };
              return next;
            }
            return [...prev, { step_type, target, status }];
          });
          break;
        }

        case 'error': {
          if (doneRef.current) return;
          doneRef.current = true;
          const errorContent = accumulated
            ? accumulated
            : `Sorry, I encountered an error: ${evt.detail}`;
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: errorContent, timestamp: new Date() },
          ]);
          setStreamingContent('');
          setActiveTools([]);
          setBrowserSteps([]);
          setIsTyping(false);
          break;
        }
      }
    };

    aiService.stream(content, sessionId, onEvent, controller.signal);
  }, [input, isTyping, navigate, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const TOOL_LABELS: Record<string, string> = {
    list_team_members: 'Fetching team members…',
    list_teams: 'Fetching all teams…',
    broadcast_notification: 'Sending notifications…',
    create_notification: 'Creating notification…',
    create_task: 'Creating task…',
    update_task: 'Updating task…',
    assign_task: 'Assigning task…',
    list_tasks: 'Fetching tasks…',
    post_team_message: 'Posting team message…',
    navigate_to: 'Navigating…',
    get_project: 'Fetching project…',
    create_document: 'Creating document…',
    create_schedule_event: 'Scheduling event…',
    web_search: 'Searching the web…',
    rag_search: 'Searching knowledge base…',
    ui_action: '🤖 Automating browser…',
  };

  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        'fixed right-0 top-0 z-50 h-screen flex flex-col border-l border-border bg-card shadow-xl',
        'transition-[width,transform] duration-300 ease-out',
        isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      )}
      style={{ width: isOpen ? chatWidth : isExpanded ? CHAT_EXPANDED : CHAT_NORMAL }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0">
        <button
          onClick={toggle}
          title="Close assistant"
          className="rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <AuroraIcon size={34} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-tight">ProjectVerse AI</p>
          <p className="text-[11px] text-success flex items-center gap-1 leading-tight">
            <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" /> Online · Agent ready
          </p>
        </div>

        <button
          onClick={resetConversation}
          title="New conversation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={toggleExpand}
          title={isExpanded ? 'Collapse' : 'Expand'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button
          onClick={close}
          title="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.length === 1 && (
          <div className={cn('mx-auto', isExpanded ? 'max-w-2xl' : '')}>
            <p className="text-center text-xs text-muted-foreground mb-4">Try one of these quick actions:</p>
            <div className={cn('grid gap-2.5', isExpanded ? 'grid-cols-3' : 'grid-cols-2')}>
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => handleSend(qp.prompt)}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                >
                  <span className="text-lg">{qp.icon}</span>
                  <span className="text-xs font-medium text-foreground">{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : '')}>
            <div
              className={cn(
                'shrink-0 h-7 w-7 rounded-full flex items-center justify-center',
                msg.role === 'assistant' ? 'bg-secondary/20' : 'bg-primary/20'
              )}
            >
              {msg.role === 'assistant' ? <AuroraIcon size={26} /> : <User className="h-4 w-4 text-primary" />}
            </div>

            <div
              className={cn(
                'rounded-2xl px-3.5 py-2.5 max-w-[85%]',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-muted/50 border border-border rounded-tl-sm'
              )}
            >
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="space-y-0.5">{renderMessageContent(msg.content)}</div>
              )}

              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-border">
                  <button className="text-muted-foreground hover:text-foreground transition-colors" title="Copy"
                    onClick={() => navigator.clipboard.writeText(msg.content)}>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button className="text-muted-foreground hover:text-success transition-colors" title="Good response">
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button className="text-muted-foreground hover:text-danger transition-colors" title="Bad response">
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  <button className="text-muted-foreground hover:text-foreground transition-colors" title="Regenerate">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Tool call indicators */}
        {isTyping && activeTools.length > 0 && (
          <div className="flex flex-col gap-1.5 pl-9">
            {activeTools.map((tool, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium w-fit transition-all duration-300',
                  tool.done
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-primary/10 text-primary border border-primary/20 animate-pulse'
                )}
              >
                {tool.done ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                ) : (
                  <Wrench className="h-3 w-3 shrink-0" />
                )}
                <span>{TOOL_LABELS[tool.tool] || `${tool.tool}…`}</span>
              </div>
            ))}
          </div>
        )}

        {/* Browser automation step breadcrumbs */}
        {isTyping && browserSteps.length > 0 && (
          <div className="flex flex-col gap-1 pl-9">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Browser steps</p>
            {browserSteps.map((step, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-medium w-fit transition-all duration-200',
                  step.status === 'done'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : step.status === 'failed'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse'
                )}
              >
                <span className="text-sm">{STEP_ICONS[step.step_type] || '⚙️'}</span>
                <span className="capitalize">{step.step_type}</span>
                <span className="text-[10px] opacity-70 truncate max-w-[120px]">{step.target}</span>
                {step.status === 'done' && <span className="ml-auto text-emerald-400">✓</span>}
                {step.status === 'failed' && <span className="ml-auto text-red-400">✗</span>}
                {step.status === 'running' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400 animate-ping" />}
              </div>
            ))}
          </div>
        )}

        {/* Live streaming bubble */}
        {isTyping && streamingContent && (
          <div className="flex gap-2.5">
            <div className="shrink-0 h-7 w-7 rounded-full bg-secondary/20 flex items-center justify-center">
              <AuroraIcon size={26} />
            </div>
            <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
              <div className="space-y-0.5">{renderMessageContent(streamingContent)}</div>
              <span className="inline-block h-4 w-0.5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
            </div>
          </div>
        )}

        {/* Thinking indicator (no content yet) */}
        {isTyping && !streamingContent && activeTools.length === 0 && (
          <div className="flex gap-2.5">
            <div className="shrink-0 h-7 w-7 rounded-full bg-secondary/20 flex items-center justify-center">
              <AuroraIcon size={26} />
            </div>
            <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 text-secondary animate-spin" />
                <span className="text-xs text-muted-foreground">ProjectVerse AI is thinking…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-border bg-card">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/50 transition-all">
          <button className="text-muted-foreground hover:text-foreground transition-colors mb-0.5" title="Attach">
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your projects, team, or tasks… or say 'notify my team'"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '160px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 mb-0.5',
              input.trim() && !isTyping
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/60 mt-1.5">
          Enter to send · Shift+Enter for new line · Esc to close
        </p>
      </div>
    </aside>
  );
};
