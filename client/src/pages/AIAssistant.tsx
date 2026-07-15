import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Paperclip,
  RotateCcw,
  Copy,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Bot,
  User,
  Loader2,
} from 'lucide-react';
import { cn } from '../utils/cn';
import {
  renderMessageContent,
  QUICK_PROMPTS,
  PAST_CONVERSATIONS,
  type Message,
} from '../chat/aiResponse';
import { aiService } from '../services/ai.service';

export const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hello! I'm your AI project management assistant, powered by ProjectVerse AI. I have full context on your active projects, team capacity, and upcoming deadlines.\n\nHow can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await aiService.query(content, activeConversation || undefined);
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.response || 'I could not process that request.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error connecting to the AI service. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Sidebar */}
      <div className={cn(
        'shrink-0 border-r border-border bg-card flex flex-col transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
      )}>
        <div className="p-4 border-b border-border">
          <button
            onClick={() => {
              setMessages([{
                id: '0',
                role: 'assistant',
                content: `Hello! I'm your AI project management assistant, powered by ProjectVerse AI. I have full context on your active projects, team capacity, and upcoming deadlines.\n\nHow can I help you today?`,
                timestamp: new Date(),
              }]);
            }}
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">Recent</p>
          {PAST_CONVERSATIONS.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={cn(
                'w-full text-left rounded-lg px-3 py-2.5 transition-colors',
                activeConversation === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
              )}
            >
              <p className="text-sm font-medium truncate">{conv.title}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{conv.preview}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{conv.time}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn('h-5 w-5 transition-transform', sidebarOpen && 'rotate-180')} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/20">
              <Sparkles className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">ProjectVerse AI</p>
              <p className="text-[11px] text-success flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" /> Online · Project context loaded
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 1 && (
            // Quick start prompts
            <div className="max-w-2xl mx-auto">
              <p className="text-center text-sm text-muted-foreground mb-6">Or try one of these quick actions:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => handleSend(qp.prompt)}
                    className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                  >
                    <span className="text-xl">{qp.icon}</span>
                    <span className="text-sm font-medium text-foreground">{qp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-3 max-w-4xl', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
            >
              {/* Avatar */}
              <div className={cn(
                'shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                msg.role === 'assistant' ? 'bg-secondary/20' : 'bg-primary/20'
              )}>
                {msg.role === 'assistant'
                  ? <Sparkles className="h-4 w-4 text-secondary" />
                  : <User className="h-4 w-4 text-primary" />
                }
              </div>

              {/* Bubble */}
              <div className={cn(
                'rounded-2xl px-4 py-3 max-w-[80%]',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-card border border-border rounded-tl-sm'
              )}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <div className="space-y-0.5">
                    {renderMessageContent(msg.content)}
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                    <button className="text-muted-foreground hover:text-foreground transition-colors" title="Copy">
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

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3 max-w-4xl">
              <div className="shrink-0 h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-secondary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 text-secondary animate-spin" />
                  <span className="text-xs text-muted-foreground">ProjectVerse AI is thinking…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 border-t border-border bg-card">
          <div className="flex items-end gap-3 rounded-xl border border-border bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/50 transition-all">
            <button className="text-muted-foreground hover:text-foreground transition-colors mb-0.5">
              <Paperclip className="h-5 w-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your projects, team, or tasks…"
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
          <p className="text-center text-[10px] text-muted-foreground/60 mt-2">
            Press Enter to send · Shift+Enter for new line · AI responses are simulated for demo
          </p>
        </div>
      </div>
    </div>
  );
};
