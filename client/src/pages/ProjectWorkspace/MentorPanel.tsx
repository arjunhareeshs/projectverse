import React, { useEffect, useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { MentorStatus } from '../../types/projectLog';
import { lifecycleService } from '../../services/lifecycle.service';
import { FlagBadge } from '../../components/lifecycle/FlagBadge';
import { renderMessageContent } from '../../components/aiResponse';

interface MentorPanelProps {
  projectId: string;
  onFlagsUpdate?: (count: number) => void;
}

export const MentorPanel: React.FC<MentorPanelProps> = ({ projectId, onFlagsUpdate }) => {
  const [status, setStatus] = useState<MentorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const data = await lifecycleService.getMentorStatus(projectId);
        setStatus(data);
        if (data && data.flags) {
          const unresolved = data.flags.filter((f) => !f.resolved).length;
          if (onFlagsUpdate) onFlagsUpdate(unresolved);
        }
      } catch (err) {
        console.error('Failed to load mentor status', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [projectId]);

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!questionInput.trim() || asking) return;

    const q = questionInput.trim();
    setQuestionInput('');
    setAsking(true);

    try {
      const res = await lifecycleService.askMentor(projectId, q);
      setChatHistory((prev) => [...prev, { q, a: res.answer }]);
    } catch (err) {
      console.error('Failed to ask AI mentor', err);
      setChatHistory((prev) => [
        ...prev,
        { q, a: 'Sorry, the AI mentor service is currently unavailable. Please try again later.' },
      ]);
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-gray-400">Loading AI assistant snapshot...</div>;
  }

  if (status && status.available === false) {
    return (
      <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200 text-center space-y-2 max-w-md mx-auto">
        <Bot className="w-8 h-8 text-gray-400 mx-auto" />
        <h4 className="text-sm font-bold text-gray-800">AI Assistant Service Not Configured</h4>
        <p className="text-xs text-gray-500">
          The AI assistant service is not active. Your project progress can still be logged and tracked manually.
        </p>
      </div>
    );
  }

  const getEstimateBadge = (est: 'ON_TRACK' | 'AT_RISK' | 'LIKELY_LATE') => {
    if (est === 'ON_TRACK')
      return {
        label: 'On Track',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    if (est === 'AT_RISK')
      return {
        label: 'At Risk',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock,
      };
    return {
      label: 'Likely Late',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertTriangle,
    };
  };

  const estimateInfo = getEstimateBadge(status?.onTimeEstimate || 'ON_TRACK');
  const EstIcon = estimateInfo.icon;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Snapshot Banner */}
      <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">AI Project Assistant</h2>
              <p className="text-xs text-gray-500">
                Supervising project timeline, task assignments, and skill gaps.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Timeline Estimate:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${estimateInfo.color}`}
            >
              <EstIcon className="w-3.5 h-3.5" />
              {estimateInfo.label}
            </span>
          </div>
        </div>

        {status?.summary && (
          <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 font-medium">
            {status.summary}
          </p>
        )}
      </div>

      {/* Flags Section */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Active System & Progress Flags
        </h3>

        {!status?.flags || status.flags.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            No open flags! Project progress, team activity, and tech stack choices look healthy.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {status.flags.map((flag) => (
              <FlagBadge key={flag.id} flag={flag} />
            ))}
          </div>
        )}
      </div>

      {/* Suggested Next Tasks */}
      {status?.suggestedNextTasks && status.suggestedNextTasks.length > 0 && (
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" /> Suggested Next Tasks (Per Member)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {status.suggestedNextTasks.map((task, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <span className="font-bold text-xs text-indigo-900">{task.userName || task.userId}</span>
                <p className="text-xs text-gray-700">{task.task}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Suggestions */}
      {status?.learningSuggestions && status.learningSuggestions.length > 0 && (
        <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
          <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" /> Recommended Learning Directions
          </h3>
          <div className="space-y-2">
            {status.learningSuggestions.map((sug, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-white border border-indigo-100 space-y-1">
                <span className="font-bold text-xs text-indigo-900 px-2 py-0.5 rounded bg-indigo-50">
                  {sug.skill}
                </span>
                {Array.isArray(sug.resources) && sug.resources.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {sug.resources.map((res, rIdx) => (
                      <p key={rIdx} className="text-xs text-gray-700">
                        • {res.topic || 'Resource'}:{' '}
                        {res.url ? (
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-indigo-600 hover:underline"
                          >
                            {typeof res.resource === 'string' ? res.resource : String(res.resource)}
                          </a>
                        ) : (
                          <span className="font-semibold">
                            {typeof res.resource === 'string' ? res.resource : String(res.resource)}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask the Assistant Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-gray-900">Ask the AI Assistant</h3>
        </div>

        {/* Local Q&A list */}
        {chatHistory.length > 0 && (
          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {chatHistory.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-end">
                  <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs max-w-[80%]">
                    {item.q}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl text-xs max-w-[85%] leading-relaxed">
                    <span className="font-bold block text-[10px] text-indigo-700 mb-1">AI Assistant:</span>
                    {renderMessageContent(item.a)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAsk} className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Ask mentor a question about your project, timeline, or tasks..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={!questionInput.trim() || asking}
            className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {asking ? 'Asking...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  );
};
