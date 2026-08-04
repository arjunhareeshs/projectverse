import React, { useState } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Mail, 
  Terminal, 
  Clipboard, 
  Check, 
  Calendar, 
  Users, 
  BarChart3, 
  Clock, 
  Info 
} from 'lucide-react';
import { cn } from '../utils/cn';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  time: string;
}

export const QUICK_PROMPTS = [
  { icon: '📊', label: 'Draft status report', prompt: 'Draft a project status report for the Customer Relationship Portal this week.' },
  { icon: '⚠️', label: 'Summarize blockers', prompt: 'Summarize all current blockers across active projects and suggest resolutions.' },
  { icon: '📅', label: 'Plan next sprint', prompt: 'Help me plan the next 2-week sprint for the Inventory Management System project.' },
  { icon: '📧', label: 'Write client email', prompt: 'Write a professional email to ABC Retail Ltd. with a project progress update.' },
  { icon: '🔍', label: 'Risk analysis', prompt: 'Perform a risk analysis on current projects and highlight top concerns.' },
  { icon: '💡', label: 'Budget insights', prompt: 'Provide budget utilization insights and suggest optimization opportunities.' },
];

export const PAST_CONVERSATIONS: Conversation[] = [
  { id: '1', title: 'Sprint planning session', preview: 'Helped plan Sprint 7 tasks...', time: 'Today' },
  { id: '2', title: 'Risk assessment', preview: 'Analyzed project risks for...', time: 'Yesterday' },
  { id: '3', title: 'Client report draft', preview: 'Drafted ABC Retail status...', time: '3 days ago' },
];

export const WELCOME_MESSAGE = `Hello! I'm your AI project management assistant, powered by ProjectVerse AI. I have full context on your active projects, team capacity, and upcoming deadlines.\n\nHow can I help you today?`;

// Helper to parse inline bold and code markdown formatting reliably
export function parseInlineFormatting(text: string): React.ReactNode {
  if (!text) return text;
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={keyIdx++} className="font-extrabold text-gray-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={keyIdx++}
          className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-100/80 mx-0.5 inline-block"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts.length > 0 ? parts : text}</>;
}

// 1. Shell Console Widget (Terminals, shell command outputs, logs)
export const ShellConsoleWidget: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const lines = content.split('\n').filter(l => l.trim() !== '');

  return (
    <div className="bg-slate-950 text-slate-200 font-mono p-4 rounded-2xl shadow-lg border border-slate-800 text-[11px] my-2 select-text w-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans font-black">ProjectVerse Console</span>
          <button 
            type="button"
            onClick={handleCopy} 
            className="text-slate-400 hover:text-white transition-colors"
            title="Copy logs"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Clipboard className="h-3 w-3" />}
          </button>
        </div>
      </div>
      <div className="space-y-1 overflow-x-auto max-h-60 custom-scrollbar text-left">
        {lines.map((line, idx) => {
          let colorClass = "text-slate-300";
          if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail') || line.includes('🔴')) {
            colorClass = "text-rose-400 font-bold";
          } else if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('risk') || line.includes('🟡')) {
            colorClass = "text-amber-400";
          } else if (line.toLowerCase().includes('success') || line.toLowerCase().includes('complete') || line.includes('✅') || line.includes('🟢')) {
            colorClass = "text-emerald-400";
          } else if (line.startsWith('$') || line.includes('pv-shell$')) {
            colorClass = "text-indigo-400 font-semibold";
          }
          return (
            <div key={idx} className={colorClass}>
              {line.startsWith('$') ? '' : <span className="text-slate-600 mr-2 select-none">$</span>}
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Email Preview Widget
export const EmailPreviewWidget: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  
  // Parse fields
  const lines = content.split('\n');
  let to = "ABC Retail Ltd. — Stakeholders";
  let subject = "Project Progress Update";
  const bodyLines: string[] = [];
  
  let captureBody = false;
  lines.forEach(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('**To:**')) {
      to = trimmed.replace('**To:**', '').replace(/\*\*/g, '').trim();
    } else if (trimmed.startsWith('**Subject:**')) {
      subject = trimmed.replace('**Subject:**', '').replace(/\*\*/g, '').trim();
    } else if (trimmed === '---') {
      captureBody = true;
    } else if (captureBody) {
      if (!l.includes('Would you like me to adjust')) {
        bodyLines.push(l);
      }
    }
  });

  const emailBody = bodyLines.join('\n').trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden shadow-sm bg-white w-full my-3 text-left">
      {/* Mail Window Header */}
      <div className="bg-indigo-50/50 px-4 py-3 border-b border-indigo-100/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">Email Draft</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white border border-indigo-100 hover:bg-indigo-50/50 px-2.5 py-1 rounded-lg shadow-sm transition-all"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Clipboard className="h-3 w-3" />
              <span>Copy Body</span>
            </>
          )}
        </button>
      </div>
      {/* Mail Fields */}
      <div className="p-4 space-y-2 border-b border-indigo-50/30 bg-indigo-50/10 text-xs">
        <div>
          <span className="font-extrabold text-indigo-900 mr-1.5 uppercase tracking-wide">To:</span>
          <span className="text-gray-700 font-semibold">{to}</span>
        </div>
        <div>
          <span className="font-extrabold text-indigo-900 mr-1.5 uppercase tracking-wide">Subject:</span>
          <span className="text-gray-800 font-bold">{subject}</span>
        </div>
      </div>
      {/* Mail Body */}
      <div className="p-4 text-xs text-gray-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-medium">
        {emailBody || content}
      </div>
    </div>
  );
};

// 3. Blockers and Risks Summary Widget
export const BlockersWidget: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const items: Array<{ project: string; status: string; blocker: string; action: string }> = [];
  
  let currentItem: any = null;

  lines.forEach(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('**') && trimmed.includes('(')) {
      if (currentItem) items.push(currentItem);
      const match = trimmed.match(/\*\*(.*?)\*\*\s*\((.*?)\)/);
      if (match) {
        currentItem = {
          project: match[1],
          status: match[2].replace('At Risk ', '').replace('On Track ', '').trim(),
          blocker: '',
          action: ''
        };
      }
    } else if (trimmed.startsWith('- **Blocker:**') || trimmed.startsWith('* **Blocker:**') || trimmed.startsWith('- **Minor risk:**') || trimmed.startsWith('* **Minor risk:**') || trimmed.startsWith('- **No immediate blockers**') || trimmed.startsWith('* **No immediate blockers**')) {
      if (currentItem) {
        currentItem.blocker = trimmed.replace(/^[\-\*]\s*\*\*(.*?):\*\*/, '$1:').trim();
      }
    } else if (trimmed.startsWith('- **Suggested action:**') || trimmed.startsWith('* **Suggested action:**')) {
      if (currentItem) {
        currentItem.action = trimmed.replace(/^[\-\*]\s*\*\*Suggested action:\*\*/, '').trim();
      }
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentItem) {
        const text = trimmed.substring(2);
        if (text.toLowerCase().includes('suggested action') || text.toLowerCase().includes('escalate')) {
          currentItem.action = text.replace(/^\*\*Suggested action:\*\*/, '').trim();
        } else {
          if (currentItem.blocker) {
            currentItem.action = text;
          } else {
            currentItem.blocker = text;
          }
        }
      }
    }
  });
  if (currentItem) items.push(currentItem);

  return (
    <div className="space-y-3 w-full my-3 text-left">
      <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 uppercase tracking-widest mb-1">
        <AlertCircle className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
        <span>Blockers & Risks Summary</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {items.map((item, idx) => {
          const isAtRisk = item.status.toLowerCase().includes('risk') || item.status.includes('🔴');
          return (
            <div 
              key={idx} 
              className={cn(
                "rounded-2xl border p-4 shadow-sm bg-white transition-all hover:shadow-md",
                isAtRisk ? "border-rose-100 bg-rose-50/5 hover:border-rose-200" : "border-emerald-100 bg-emerald-50/5 hover:border-emerald-200"
              )}
            >
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-100/50">
                <h4 className="text-xs font-black text-gray-800">{item.project}</h4>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                  isAtRisk 
                    ? "bg-rose-50 text-rose-600 border-rose-100" 
                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
                )}>
                  {item.status}
                </span>
              </div>
              
              <div className="space-y-2 text-xs">
                {item.blocker && (
                  <div>
                    <span className="font-extrabold text-gray-700 block mb-0.5">Blocker / Risk:</span>
                    <p className="text-gray-600 leading-relaxed font-medium">{parseInlineFormatting(item.blocker)}</p>
                  </div>
                )}
                {item.action && (
                  <div className="bg-indigo-50/30 p-2.5 rounded-xl border border-indigo-100/30">
                    <span className="font-extrabold text-indigo-900 block mb-0.5 uppercase tracking-wide text-[9px]">Suggested Mitigation:</span>
                    <p className="text-indigo-950 font-semibold leading-relaxed">{parseInlineFormatting(item.action)}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 4. Status Report Widget
export const StatusReportWidget: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  let title = "Project Status Report";
  let week = "";
  let overallStatus = "On Track";
  const highlights: string[] = [];
  const risks: string[] = [];
  const steps: string[] = [];

  let section: 'none' | 'highlights' | 'risks' | 'steps' = 'none';

  lines.forEach(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('## ') && trimmed.includes('Status Report')) {
      title = trimmed.replace('## 📊', '').replace('##', '').trim();
    } else if (trimmed.startsWith('**Week of')) {
      week = trimmed.replace(/\*\*/g, '').trim();
    } else if (trimmed.startsWith('**Overall Status:**')) {
      overallStatus = trimmed.replace('**Overall Status:**', '').replace(/\*\*/g, '').trim();
    } else if (trimmed.startsWith('### Key Highlights')) {
      section = 'highlights';
    } else if (trimmed.startsWith('### Risks')) {
      section = 'risks';
    } else if (trimmed.startsWith('### Next Steps')) {
      section = 'steps';
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\./)) {
      const clean = trimmed.replace(/^[\-\*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (section === 'highlights') highlights.push(clean);
      if (section === 'risks') risks.push(clean);
      if (section === 'steps') steps.push(clean);
    }
  });

  return (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden shadow-sm bg-white w-full my-3 animate-in fade-in-50 text-left">
      <div className="bg-indigo-50/50 p-4 border-b border-indigo-100/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4.5 w-4.5 text-indigo-600 animate-pulse shrink-0" />
          <div>
            <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">{title}</h3>
            {week && <p className="text-[9px] text-indigo-500 font-extrabold uppercase mt-0.5">{week}</p>}
          </div>
        </div>
        <span className="text-[10px] font-black bg-indigo-600 text-white rounded-full px-3 py-1 uppercase tracking-wider font-mono shadow-sm">
          {overallStatus}
        </span>
      </div>

      <div className="p-4 space-y-4 text-xs">
        {highlights.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              Key Highlights
            </h4>
            <ul className="space-y-1 pl-5 list-disc text-gray-600 font-medium leading-relaxed">
              {highlights.map((h, i) => <li key={i}>{parseInlineFormatting(h)}</li>)}
            </ul>
          </div>
        )}

        {risks.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-rose-500 animate-pulse shrink-0" />
              Risks & Concerns
            </h4>
            <ul className="space-y-1 pl-5 list-disc text-rose-950 font-semibold leading-relaxed">
              {risks.map((r, i) => <li key={i}>{parseInlineFormatting(r)}</li>)}
            </ul>
          </div>
        )}

        {steps.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
              Next Milestones
            </h4>
            <ol className="space-y-1 pl-5 list-decimal text-indigo-950 font-bold leading-relaxed">
              {steps.map((s, i) => <li key={i}>{parseInlineFormatting(s)}</li>)}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

// 5. Sprint Backlog Planner Widget
export const SprintPlannerWidget: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  let title = "Sprint Plan";
  let goal = "";
  const tasks: Array<{ index: string; task: string; assignee: string; points: string }> = [];

  lines.forEach(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('## ') && trimmed.includes('Sprint')) {
      title = trimmed.replace('## 📅', '').replace('##', '').trim();
    } else if (trimmed.startsWith('**Sprint Goal:**')) {
      goal = trimmed.replace('**Sprint Goal:**', '').replace(/\*\*/g, '').trim();
    } else if (trimmed.startsWith('|') && !trimmed.includes('---') && !trimmed.toLowerCase().includes('assignee')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter((c, idx) => idx > 0 && idx < 6);
      if (cells.length >= 4) {
        tasks.push({
          index: cells[0],
          task: cells[1],
          assignee: cells[2],
          points: cells[3]
        });
      }
    }
  });

  return (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden shadow-sm bg-white w-full my-3 text-left">
      <div className="bg-indigo-50/50 p-4 border-b border-indigo-100/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-indigo-600 animate-pulse shrink-0" />
          <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">{title}</h3>
        </div>
        <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200 px-2 py-0.5 uppercase font-mono shrink-0">
          Sprint Config
        </span>
      </div>

      <div className="p-4 space-y-4">
        {goal && (
          <div className="bg-indigo-50/30 border border-indigo-100/50 p-3 rounded-xl">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">Sprint Goal</span>
            <p className="text-xs font-bold text-indigo-950 leading-relaxed">{goal}</p>
          </div>
        )}

        <div className="space-y-2">
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Sprint Backlog</span>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl bg-gray-50/30 overflow-hidden text-xs">
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 font-mono w-4">#{t.index}</span>
                  <p className="font-bold text-gray-800 truncate leading-snug">{t.task}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200/50 text-[10px] font-extrabold uppercase font-mono">
                    <Users className="h-3 w-3 text-gray-500" />
                    <span>{t.assignee}</span>
                  </div>
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-100/50 text-[10px] font-black font-mono">
                    {t.points} SP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// General entry point for message formatting that detects headers and renders widgets or shells
export function renderMessageContent(content: string): React.ReactNode {
  if (!content) return null;

  // 1. Detect Blocker Widget
  if (content.includes('⚠️ Current Blockers & Risks') || content.includes('At Risk 🔴')) {
    return <BlockersWidget content={content} />;
  }

  // 2. Detect Status Report Widget
  if (content.includes('📊 Project Status Report')) {
    return <StatusReportWidget content={content} />;
  }

  // 3. Detect Sprint Planning Widget
  if (content.includes('📅 Sprint Planning') || content.includes('Sprint Goal:')) {
    return <SprintPlannerWidget content={content} />;
  }

  // 4. Detect Email Preview Widget
  if (content.includes('📧 Client Update Email') || content.includes('📧 Email:')) {
    return <EmailPreviewWidget content={content} />;
  }

  // 5. Detect terminal console logs or shell output format
  if (
    content.includes('pv-shell$') ||
    content.includes('$ ') ||
    content.includes('[INFO]') ||
    content.includes('[WARNING]') ||
    content.includes('[ERROR]') ||
    (content.startsWith('[') && content.includes(']'))
  ) {
    return <ShellConsoleWidget content={content} />;
  }

  // Fallback: Smart Block Parser for Headings, Tables, Lists, and Inline Markdown
  const rawLines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Check for Table block (consecutive lines starting with |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        tableLines.push(rawLines[i].trim());
        i++;
      }

      if (tableLines.length > 0) {
        // Parse headers and rows
        const headers = tableLines[0]
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c !== '');
        
        // Filter out separator lines (e.g. | --- | --- |)
        const dataLines = tableLines.slice(1).filter((l) => !l.includes('---'));
        const rows = dataLines.map((l) =>
          l
            .split('|')
            .map((c) => c.trim())
            .filter((c) => c !== '')
        );

        blocks.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-xl border border-indigo-100 shadow-2xs bg-white">
            <table className="w-full text-left text-xs border-collapse">
              {headers.length > 0 && (
                <thead className="bg-indigo-50/70 border-b border-indigo-100">
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-3.5 py-2 font-extrabold text-indigo-950 uppercase tracking-wider text-[10px]"
                      >
                        {parseInlineFormatting(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-xs font-medium text-gray-700">
                        {parseInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 2. Headings (Markdown # or UPPERCASE headers)
    const isHeading =
      trimmed.startsWith('# ') ||
      trimmed.startsWith('## ') ||
      trimmed.startsWith('### ') ||
      (trimmed.length > 2 &&
        trimmed.length < 60 &&
        trimmed === trimmed.toUpperCase() &&
        /^[A-Z0-9\s&_:\-]+$/.test(trimmed));

    if (isHeading) {
      const headingText = trimmed.replace(/^#+\s*/, '');
      blocks.push(
        <h3
          key={`h-${i}`}
          className="text-xs font-black text-indigo-950 uppercase tracking-wider mt-3.5 mb-1.5 border-b border-indigo-100/60 pb-1 flex items-center gap-1.5"
        >
          {headingText}
        </h3>
      );
      i++;
      continue;
    }

    // 3. Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletText = trimmed.slice(2);
      blocks.push(
        <li key={`b-${i}`} className="ml-4 text-xs text-gray-600 list-disc font-medium leading-relaxed my-0.5">
          {parseInlineFormatting(bulletText)}
        </li>
      );
      i++;
      continue;
    }

    // 4. Numbered list items
    if (/^\d+\./.test(trimmed)) {
      const numText = trimmed.replace(/^\d+\.\s*/, '');
      blocks.push(
        <li key={`n-${i}`} className="ml-4 text-xs text-gray-600 list-decimal font-medium leading-relaxed my-0.5">
          {parseInlineFormatting(numText)}
        </li>
      );
      i++;
      continue;
    }

    // 5. Horizontal rule
    if (trimmed === '---') {
      blocks.push(<hr key={`hr-${i}`} className="border-gray-200 my-2.5" />);
      i++;
      continue;
    }

    // 6. Empty line
    if (trimmed === '') {
      blocks.push(<div key={`space-${i}`} className="h-1" />);
      i++;
      continue;
    }

    // 7. Regular paragraph
    blocks.push(
      <p key={`p-${i}`} className="text-xs text-gray-600 leading-relaxed font-medium my-0.5">
        {parseInlineFormatting(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5 text-left text-xs font-semibold text-gray-700">{blocks}</div>;
}
