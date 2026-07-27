import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  Sparkles,
  Users,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  X,
} from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { adminAiService } from '../../services/adminAi.service';
import { renderMessageContent } from '../../components/aiResponse';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  teamsGrid?: any[];
  teamDetailCard?: any;
  studentDetailCard?: any;
}

interface ChatSession {
  sessionId: string;
  title: string;
  lastAt: string;
}

interface PinnedContext {
  type: 'team' | 'student';
  id: string;
  name: string;
}

const getTeamScore = (team: any) => team?.liveRanking?.score ?? 0;
const getTeamRank = (team: any) => team?.liveRanking?.rank ?? null;

// Card rendering component
const TeamCard: React.FC<{ team: any; onClick: () => void }> = ({ team, onClick }) => {
  const score = getTeamScore(team);
  const status = team.projects?.[0]?.status || team.status || 'planned';

  const isCompleted = status.toLowerCase() === 'completed';
  const isAtRisk = status.toLowerCase() === 'at-risk' || status.toLowerCase() === 'at risk';

  const statusColor = isAtRisk ? 'text-red-500' : 'text-green-600';
  const statusLabel = isAtRisk ? 'At Risk' : isCompleted ? 'Completed' : 'On Track';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border border-gray-100 hover:border-indigo-200 rounded-xl p-3.5 text-left bg-white hover:shadow-md transition-all flex flex-col justify-between min-h-[115px] shadow-sm select-none"
    >
      <div className="w-full space-y-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="flex items-center gap-1.5 text-gray-500 font-semibold uppercase">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            {team.domain || 'General'}
          </span>
          <span className="font-extrabold text-gray-800">{score}%</span>
        </div>
        <h4 className="text-sm font-extrabold text-gray-800 line-clamp-1">
          {team.name}
        </h4>
        <p className="text-xs text-gray-400 line-clamp-2 leading-tight">
          {team.description || team.projects?.[0]?.description || 'No description provided'}
        </p>
      </div>

      <div className="w-full pt-2">
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${score}%` }} />
        </div>
        <div className="flex justify-between items-center text-[10px] mt-1">
          <span className="text-gray-400 font-bold">{score}%</span>
          <span className={`font-extrabold ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>
    </button>
  );
};

// Student card rendering component
const StudentCard: React.FC<{ student: any; onClick: () => void }> = ({ student, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full border border-gray-100 hover:border-indigo-200 rounded-xl p-3.5 text-left bg-white hover:shadow-md transition-all flex flex-col justify-between min-h-[100px] shadow-sm select-none"
    >
      <div className="w-full space-y-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md uppercase font-extrabold">
            {student.ssgDomain || 'General'}
          </span>
          <ChevronRight className="h-3 w-3 text-gray-300 group-hover:text-indigo-500 transition-colors" />
        </div>
        <h4 className="text-sm font-extrabold text-gray-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
          {student.fullName}
        </h4>
        <p className="text-xs text-gray-400">{student.regNo || 'No Reg No.'}</p>
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1.5 border-t border-gray-50 mt-1.5">
        <span className="font-bold text-indigo-600">{student.rewardPoints || 0} pts</span>
      </div>
    </button>
  );
};

// Team detailed card rendering inline inside chat bubble
const TeamDetailCardInline: React.FC<{ team: any }> = ({ team }) => {
  const isCompleted = team.status?.toLowerCase() === 'completed';
  const isAtRisk = team.status?.toLowerCase() === 'at risk' || team.status?.toLowerCase() === 'at-risk';

  const badgeColor = isAtRisk
    ? 'bg-rose-50 text-rose-600 border border-rose-100'
    : isCompleted
      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
      : 'bg-green-50 text-green-600 border border-green-100';

  const peers: Array<{ name: string; progress: number; current?: boolean }> = (team.domainPeers || []).map(
    (p: any) => ({ name: p.name, progress: p.score, current: p.isCurrent }),
  );

  return (
    <div className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4 animate-in fade-in-50 text-gray-800 shadow-sm mt-3 text-left w-full select-text max-w-xl">
      {/* Header Row */}
      <div className="flex justify-between items-start border-b border-gray-100 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
            <h3 className="text-base font-extrabold text-gray-900">{team.name}</h3>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}>
              {team.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-semibold">
            {team.domain || 'General'} • Lead {team.lead} • Rank #{team.rank ?? '-'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">SCORE</span>
          <p className="text-2xl font-black text-gray-900 leading-none mt-1">{team.score}%</p>
        </div>
      </div>

      {/* Description */}
      <div className="text-sm font-semibold text-gray-700 leading-relaxed">{team.description}</div>

      {/* Members Section */}
      <div className="space-y-1.5">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MEMBERS</h4>
        <div className="flex flex-wrap gap-1.5">
          {(team.members || []).map((m: string, i: number) => (
            <span key={i} className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-lg">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Achievements Section */}
      {team.achievements && team.achievements.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ACHIEVEMENTS</h4>
          <div className="flex flex-wrap gap-1.5">
            {team.achievements.map((ach: string, i: number) => (
              <span key={i} className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-sm">
                {ach}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress vs Peers Chart — real teams in the same domain */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PROGRESS VS DOMAIN PEERS</h4>
        {peers.length > 0 ? (
          <div className="flex items-end justify-between h-20 px-2 py-1 bg-gray-50/50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 self-end mb-1">peers</span>
            <div className="flex gap-3 items-end h-full">
              {peers.map((p, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 group relative h-full justify-end">
                  <span className="absolute -top-6 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow transition-all whitespace-nowrap z-20">
                    {p.name}: {p.progress}%
                  </span>
                  <div className="w-6 bg-gray-200/80 rounded-t-md overflow-hidden h-[75%] relative flex items-end">
                    <div
                      className={`w-full rounded-t-md ${p.current ? 'bg-indigo-600' : 'bg-indigo-200'}`}
                      style={{ height: `${p.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <span className="text-xs font-black text-indigo-600 self-end mb-1">{team.score}%</span>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No other teams in this domain yet to compare against.</p>
        )}
      </div>
    </div>
  );
};

// Student detailed card rendering inline inside chat bubble
const StudentDetailCardInline: React.FC<{ student: any }> = ({ student }) => {
  return (
    <div className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4 animate-in fade-in-50 text-gray-800 shadow-sm mt-3 text-left w-full select-text max-w-xl">
      <div className="flex justify-between items-start border-b border-gray-100 pb-3">
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-gray-900">{student.fullName}</h3>
          <p className="text-xs text-gray-400 font-semibold">
            {student.ssgDomain || 'General'} • {student.regNo || 'No Reg No.'} • Rank #{student.rank ?? '-'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">PERFORMANCE</span>
          <p className="text-2xl font-black text-indigo-600 leading-none mt-1">{student.performanceScore ?? 0}%</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <span className="text-[9px] text-gray-400 uppercase font-bold">TEAM</span>
          <p className="font-extrabold text-gray-800 mt-0.5">{student.team?.name || 'No team'}</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <span className="text-[9px] text-gray-400 uppercase font-bold">REWARD POINTS</span>
          <p className="font-extrabold text-gray-800 mt-0.5">{student.rewardPoints || 0} pts</p>
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SKILLS PERFORMANCE</h4>
        {student.userSkills && student.userSkills.length > 0 ? (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-2.5">
            {student.userSkills.map((sk: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-700">{sk.skillName}</span>
                  <span className="text-indigo-600">{sk.totalPoints} pts</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, sk.totalPoints)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No skills recorded yet.</p>
        )}
      </div>
    </div>
  );
};

export const AdminChat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [pinned, setPinned] = useState<PinnedContext | null>(null);

  // Context bar state
  const [contextType, setContextType] = useState<'teams' | 'students' | 'mixed'>('mixed');
  const [contextResults, setContextResults] = useState<any>({ teams: [], students: [] });
  const [contextSearchQuery, setContextSearchQuery] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showContext, setShowContext] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newId = 'session_' + Math.random().toString(36).substr(2, 9);
    setCurrentSessionId(newId);
    loadSessions();
    loadDefaultContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history of the selected session as plain prompt/response turns.
  useEffect(() => {
    if (!currentSessionId) return;
    setPinned(null);
    adminService
      .getChatHistory()
      .then((history: any[]) => {
        const sessionMsgs = history
          .filter((h) => h.sessionId === currentSessionId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const mapped: Message[] = [];
        sessionMsgs.forEach((h) => {
          mapped.push({ role: 'user', content: h.prompt });
          mapped.push({ role: 'assistant', content: h.response });
        });
        setMessages(mapped);
      })
      .catch(() => {});
  }, [currentSessionId]);

  const loadSessions = () => {
    adminService.getChatSessions().then(setSessions).catch(() => {});
  };

  const loadDefaultContext = () => {
    adminService
      .searchContext('teams')
      .then((res) => {
        setContextType(res.type);
        if (res.type === 'teams') {
          setContextResults({ teams: res.results || [], students: [] });
        } else {
          setContextResults({ teams: [], students: res.results || [] });
        }
      })
      .catch(() => {});
  };

  const handleSearchContext = (q: string) => {
    if (!q) {
      loadDefaultContext();
      return;
    }
    adminService
      .searchContext(q)
      .then((res) => {
        setContextType(res.type);
        let hasResults = false;
        if (res.type === 'teams') {
          const results = res.results || [];
          setContextResults({ teams: results, students: [] });
          hasResults = results.length > 0;
        } else if (res.type === 'students') {
          const results = res.results || [];
          setContextResults({ teams: [], students: results });
          hasResults = results.length > 0;
        } else {
          const teams = res.teams || [];
          const students = res.students || [];
          setContextResults({ teams, students });
          hasResults = teams.length > 0 || students.length > 0;
        }
        if (hasResults) setShowContext(true);
      })
      .catch(() => {});
  };

  const askAndRender = async (question: string, opts?: { pinnedTeamId?: string; pinnedStudentId?: string }) => {
    const res = await adminAiService.ask(question, { sessionId: currentSessionId, ...opts });

    let teamsGrid: any[] | undefined;
    if (question.toLowerCase().includes('ai core')) {
      const searchRes = await adminService.searchContext(question);
      if (searchRes.type === 'teams') teamsGrid = searchRes.results;
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, teamsGrid }]);
    loadSessions();
  };

  const handleAutoSubmit = async (query: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    try {
      handleSearchContext(query);
      await askAndRender(query, {
        pinnedTeamId: pinned?.type === 'team' ? pinned.id : undefined,
        pinnedStudentId: pinned?.type === 'student' ? pinned.id : undefined,
      });
      setShowContext(true);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Apologies, I encountered an error communicating with the AI service.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    const newId = 'session_' + Math.random().toString(36).substr(2, 9);
    setCurrentSessionId(newId);
    setMessages([]);
    setPinned(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      handleSearchContext(userText);
      await askAndRender(userText, {
        pinnedTeamId: pinned?.type === 'team' ? pinned.id : undefined,
        pinnedStudentId: pinned?.type === 'student' ? pinned.id : undefined,
      });
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Apologies, I encountered an error communicating with the AI service.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Card click pins the team as active context and asks the real AI for a grounded overview.
  const handleSelectTeam = async (id: string) => {
    setLoading(true);
    try {
      const details = await adminService.getTeamDetail(id);
      setPinned({ type: 'team', id: details.id, name: details.name });

      const question = `Give me a quick status overview of ${details.name}.`;
      setMessages((prev) => [...prev, { role: 'user', content: question }]);

      const res = await adminAiService.ask(question, { sessionId: currentSessionId, pinnedTeamId: id });

      const leadName = details.members?.find((m: any) => m.id === details.leadId)?.fullName || details.members?.[0]?.fullName || 'Unassigned';
      const activeProject = details.projects?.[0];
      const statusLabel = activeProject?.status === 'at-risk' ? 'At Risk' : activeProject?.status === 'completed' ? 'Completed' : 'On Track';

      const mappedDetails = {
        id: details.id,
        name: details.name,
        domain: details.domain,
        description: details.description || activeProject?.description,
        lead: leadName,
        score: getTeamScore(details),
        rank: getTeamRank(details),
        status: statusLabel,
        members: details.members?.map((m: any) => m.fullName) || [],
        achievements: details.achievements?.map((a: any) => a.title) || [],
        domainPeers: details.domainPeers || [],
      };

      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, teamDetailCard: mappedDetails }]);
      loadSessions();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (id: string) => {
    setLoading(true);
    try {
      const details = await adminService.getStudentDetail(id);
      setPinned({ type: 'student', id: details.id, name: details.fullName });

      const question = `Give me a quick performance overview of ${details.fullName}.`;
      setMessages((prev) => [...prev, { role: 'user', content: question }]);

      const res = await adminAiService.ask(question, { sessionId: currentSessionId, pinnedStudentId: id });

      const mappedStudent = {
        id: details.id,
        fullName: details.fullName,
        regNo: details.regNo,
        ssgDomain: details.ssgDomain || details.team?.domain,
        rewardPoints: details.rewardPoints || 0,
        performanceScore: details.performanceScore,
        rank: details.rank,
        team: details.team,
        userSkills: details.userSkills || [],
      };

      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, studentDetailCard: mappedStudent }]);
      loadSessions();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white overflow-hidden select-none">
      {/* 1. Left Conversation History Panel */}
      <aside className="border-r border-gray-100 flex flex-col bg-gray-50/50 shrink-0 transition-all duration-300 ease-in-out overflow-hidden w-64">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-sm font-bold text-gray-800">Conversations</span>
          <button
            onClick={startNewChat}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            title="New Chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-8">No chats</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.sessionId}
                onClick={() => setCurrentSessionId(s.sessionId)}
                className={`w-full rounded-xl transition-all flex items-center p-3 text-sm gap-2.5 text-left ${
                  currentSessionId === s.sessionId ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-50'
                }`}
                title={s.title}
              >
                <MessageSquare className="h-4.5 w-4.5 shrink-0 text-gray-400" />
                <span className="truncate flex-1">{s.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Chat Header */}
        <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 shrink-0 bg-white shadow-sm z-10">
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">
              {sessions.find((s) => s.sessionId === currentSessionId)?.title || 'New conversation'}
            </h1>
            <p className="text-[10px] text-gray-400">
              Ask about teams, students, achievements. Try: "which teams are at risk on deadlines?".
            </p>
          </div>
          <button
            onClick={() => setShowContext(!showContext)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              showContext
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{showContext ? 'Hide Context' : 'Show Context'}</span>
          </button>
        </div>

        {/* Pinned context chip */}
        {pinned && (
          <div className="px-6 pt-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Grounded on {pinned.type === 'team' ? 'team' : 'student'}: {pinned.name}
              <button
                type="button"
                onClick={() => setPinned(null)}
                className="p-0.5 hover:bg-indigo-100 rounded-full transition-colors"
                title="Clear pinned context"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 select-none">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Ask ProjectVerse</h2>
                <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
                  Query teams, students, domains or status — answered live against real project data. Tap any
                  card in the right panel to ground the conversation on it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
                {[
                  'Which final-year projects have HIGH plagiarism risk?',
                  'Show me teams with inactive members or timeline delays',
                  'Which teams are at risk on deadlines?',
                  'What are the top performing teams overall?',
                ].map((query) => (
                  <button
                    key={query}
                    type="button"
                    onClick={() => handleAutoSubmit(query)}
                    className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-xs text-gray-600 font-semibold shadow-sm transition-all"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role !== 'user' && (
                  <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-2xl p-4 text-sm ${
                    m.role === 'user' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'bg-gray-50 text-gray-800'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="leading-relaxed font-semibold">{m.content}</p>
                  ) : (
                    <div className="space-y-3">
                      <div>{renderMessageContent(m.content)}</div>

                      {m.teamsGrid && m.teamsGrid.length > 0 && (
                        <div className="mt-4 space-y-3 select-none">
                          <p className="text-xs font-bold text-gray-400">
                            {m.teamsGrid.length} teams found — shown on right panel.
                          </p>
                          <div className="grid grid-cols-2 gap-2.5">
                            {m.teamsGrid.map((team) => (
                              <TeamCard key={team.id} team={team} onClick={() => handleSelectTeam(team.id)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {m.teamDetailCard && <TeamDetailCardInline team={m.teamDetailCard} />}
                      {m.studentDetailCard && <StudentDetailCardInline student={m.studentDetailCard} />}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-1.5">
                <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm max-w-4xl mx-auto font-sans">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              title="Attach files"
              disabled
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <input
              type="text"
              placeholder={pinned ? `Ask about ${pinned.name}...` : 'Ask about teams, students, achievements...'}
              className="flex-1 bg-transparent border-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-8 w-8 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 shrink-0 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* 3. Right Context Bar (Expandable Grid Layout) */}
      <aside
        className={`border-l border-gray-100 flex flex-col bg-white shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          showContext ? (isExpanded ? 'w-[520px]' : 'w-80') : 'w-16'
        }`}
      >
        {!showContext ? (
          <div className="flex flex-col h-full bg-white select-none">
            <div className="flex flex-col items-center py-4 border-b border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowContext(true)}
                className="p-2 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 rounded-xl text-indigo-600 border border-indigo-100 shadow-sm transition-all active:scale-95"
                title="Show Context Feed"
              >
                <Sparkles className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-5">
              {contextResults.teams.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-center text-gray-400 py-1" title="Active Teams">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {contextResults.teams.map((team: any) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => handleSelectTeam(team.id)}
                        className="group w-full rounded-xl transition-all flex items-center p-2.5 justify-center border border-transparent hover:border-indigo-100 hover:text-indigo-600 hover:bg-indigo-50/50"
                        title={`Team: ${team.name} (${team.domain || 'General'})`}
                      >
                        <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {team.name ? team.name[0] : 'T'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {contextResults.students.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-center text-gray-400 py-1" title="Top Students">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {contextResults.students.map((student: any) => {
                      const initials = student.fullName
                        ? student.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                        : 'S';
                      return (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => handleSelectStudent(student.id)}
                          className="group w-full rounded-xl transition-all flex items-center p-2.5 justify-center border border-transparent hover:border-indigo-100 hover:text-indigo-600 hover:bg-indigo-50/50"
                          title={`Student: ${student.fullName} (${student.ssgDomain || 'General'})`}
                        >
                          <div className="h-6 w-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                            {initials}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100 space-y-2.5 select-none font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-gray-800 uppercase flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-500" />
                  {contextSearchQuery ? `Results • ${contextSearchQuery.toLowerCase()}` : 'AI Context Feed'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-400 mr-1">
                    {contextResults.teams.length || contextResults.students.length || ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-all active:scale-95"
                    title={isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
                  >
                    {isExpanded ? (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-indigo-500">
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span>Collapse</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-indigo-500">
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Expand</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search teams or students..."
                  className="w-full text-xs rounded-xl border border-gray-200 pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/50"
                  value={contextSearchQuery}
                  onChange={(e) => {
                    setContextSearchQuery(e.target.value);
                    handleSearchContext(e.target.value);
                  }}
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(contextType === 'teams' || contextType === 'mixed') && (
                <div className="space-y-3">
                  <div className={`grid gap-2.5 transition-all ${isExpanded ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    {contextResults.teams.map((team: any) => (
                      <TeamCard key={team.id} team={team} onClick={() => handleSelectTeam(team.id)} />
                    ))}
                  </div>
                </div>
              )}

              {(contextType === 'students' || contextType === 'mixed') && (
                <div className="space-y-3">
                  <div className={`grid gap-2.5 transition-all ${isExpanded ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    {contextResults.students.map((student: any) => (
                      <StudentCard key={student.id} student={student} onClick={() => handleSelectStudent(student.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
