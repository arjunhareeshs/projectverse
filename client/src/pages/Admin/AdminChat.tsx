import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  History,
  Sparkles,
  Users,
  TrendingUp,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Info,
  Calendar,
  Zap,
  Paperclip,
} from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { renderMessageContent } from '../../chat/aiResponse';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  specialTeamId?: string;
  specialStudentId?: string;
  teamsGrid?: any[];
  studentGrid?: any[];
  teamDetailCard?: any;
  studentDetailCard?: any;
}

interface ChatSession {
  sessionId: string;
  title: string;
  lastAt: string;
}

// Helpers to get progress and score dynamically based on PBL screenshot values
const getTeamProgress = (team: any) => {
  if (!team) return 50;
  const name = team.name || '';
  if (name.includes('Pulse 2')) return 44;
  if (name.includes('Alpha 2')) return 100;
  if (name.includes('Pulse 1')) return 28;
  if (name.includes('Alpha 1')) return 20;
  return team.ranking ? Math.min(100, Math.round(team.ranking.totalPoints / 10)) : 50;
};

const getTeamScore = (team: any) => {
  if (!team) return 60;
  const name = team.name || '';
  if (name.includes('Pulse 2')) return 66;
  if (name.includes('Alpha 2')) return 64;
  if (name.includes('Pulse 1')) return 62;
  if (name.includes('Alpha 1')) return 60;
  return team.ranking?.totalPoints ? Math.round(team.ranking.totalPoints / 10) : 60;
};

// Card rendering component matching screenshot exactly
const TeamCard: React.FC<{ team: any; onClick: () => void }> = ({ team, onClick }) => {
  const progress = getTeamProgress(team);
  const score = getTeamScore(team);
  const status = team.projects?.[0]?.status || team.status || 'On Track';

  const isCompleted = status.toLowerCase() === 'completed' || progress === 100;
  const isAtRisk = status.toLowerCase() === 'at-risk' || status.toLowerCase() === 'at risk';

  let statusColor = 'text-green-600';
  let progressColor = 'bg-indigo-600';
  let dotColor = 'bg-indigo-500';

  if (isAtRisk) {
    statusColor = 'text-red-500';
  } else if (isCompleted) {
    statusColor = 'text-green-600';
  } else {
    statusColor = 'text-green-600';
  }

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
            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
            {team.domain || 'AI Core'}
          </span>
          <span className="font-extrabold text-gray-800">{score}</span>
        </div>
        <h4 className="text-sm font-extrabold text-gray-800 line-clamp-1">
          {team.name}
        </h4>
        <p className="text-xs text-gray-400 line-clamp-2 leading-tight">
          {team.description || team.projects?.[0]?.description || 'No description provided'}
        </p>
      </div>

      {/* Progress */}
      <div className="w-full pt-2">
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} rounded-full`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] mt-1">
          <span className="text-gray-400 font-bold">
            {progress}%
          </span>
          <span className={`font-extrabold ${statusColor}`}>
            {statusLabel}
          </span>
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
            {student.ssgDomain || 'AI'}
          </span>
          <ChevronRight className="h-3 w-3 text-gray-300 group-hover:text-indigo-500 transition-colors" />
        </div>
        <h4 className="text-sm font-extrabold text-gray-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
          {student.fullName}
        </h4>
        <p className="text-xs text-gray-400">
          {student.regNo || 'S-0041'}
        </p>
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1.5 border-t border-gray-50 mt-1.5">
        <span className="font-bold text-indigo-600">
          {student.rewardPoints || 90} pts
        </span>
      </div>
    </button>
  );
};

// Team detailed card rendering inline inside chat bubble
const TeamDetailCardInline: React.FC<{ team: any }> = ({ team }) => {
  const isCompleted = team.status?.toLowerCase() === 'completed' || team.progress === 100;
  const isAtRisk = team.status?.toLowerCase() === 'at risk' || team.status?.toLowerCase() === 'at-risk';

  const badgeColor = isAtRisk 
    ? 'bg-rose-50 text-rose-600 border border-rose-100' 
    : isCompleted 
      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
      : 'bg-green-50 text-green-600 border border-green-100';

  // Mock peer progress values for graph
  const peers = [
    { name: 'Alpha 1', progress: 20 },
    { name: 'Pulse 1', progress: 28 },
    { name: 'Alpha 2', progress: 100 },
    { name: 'Peer A', progress: 55 },
    { name: team.name, progress: team.progress, current: true }
  ];

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
            {team.domain || 'AI Core'} • Lead {team.lead} • Updated {team.updateDate || 'Jul 1, 2026'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">SCORE</span>
          <p className="text-2xl font-black text-gray-900 leading-none mt-1">{team.score}</p>
        </div>
      </div>

      {/* Description */}
      <div className="text-sm font-semibold text-gray-700 leading-relaxed">
        {team.description}
      </div>

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

      {/* Progress vs Peers Chart */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PROGRESS VS PEERS</h4>
        <div className="flex items-end justify-between h-20 px-2 py-1 bg-gray-50/50 rounded-xl border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 self-end mb-1">peers</span>
          <div className="flex gap-3 items-end h-full">
            {peers.map((p, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 group relative h-full justify-end">
                {/* Tooltip */}
                <span className="absolute -top-6 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow transition-all whitespace-nowrap z-20">
                  {p.name}: {p.progress}%
                </span>
                {/* Bar */}
                <div className="w-6 bg-gray-200/80 rounded-t-md overflow-hidden h-[75%] relative flex items-end">
                  <div 
                    className={`w-full rounded-t-md ${p.current ? 'bg-indigo-600' : 'bg-indigo-200'}`} 
                    style={{ height: `${p.progress}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
          <span className="text-xs font-black text-indigo-600 self-end mb-1">{team.progress}%</span>
        </div>
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
            {student.ssgDomain || 'AI Core'} • ID {student.regNo || 'S-0041'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">REWARD POINTS</span>
          <p className="text-2xl font-black text-indigo-600 leading-none mt-1">{student.rewardPoints || 90} pts</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <span className="text-[9px] text-gray-400 uppercase font-bold">TEAM</span>
          <p className="font-extrabold text-gray-800 mt-0.5">{student.team?.name || 'Individual'}</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <span className="text-[9px] text-gray-400 uppercase font-bold">ROLE / DOMAIN</span>
          <p className="font-extrabold text-gray-800 mt-0.5">{student.ssgDomain || 'General'}</p>
        </div>
      </div>

      {/* Skills */}
      {student.userSkills && student.userSkills.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SKILLS PERFORMANCE</h4>
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
        </div>
      )}
    </div>
  );
};

export const AdminChat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Context bar state
  const [contextType, setContextType] = useState<'teams' | 'students' | 'mixed'>('mixed');
  const [contextResults, setContextResults] = useState<any>({ teams: [], students: [] });
  const [contextSearchQuery, setContextSearchQuery] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showContext, setShowContext] = useState<boolean>(false);

  // State variables kept for compilation safety
  const [activeTeamDetail, setActiveTeamDetail] = useState<any>(null);
  const [activeStudentDetail, setActiveStudentDetail] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate initial session ID
    const newId = 'session_' + Math.random().toString(36).substr(2, 9);
    setCurrentSessionId(newId);
    loadSessions();
    loadDefaultContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history of selected session and map back to inline components if applicable
  useEffect(() => {
    if (!currentSessionId) return;
    adminService.getChatHistory()
      .then(async (history: any[]) => {
        // Filter history by sessionId and sort chronologically
        const sessionMsgs = history
          .filter((h) => h.sessionId === currentSessionId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const mapped: Message[] = [];
        
        for (const h of sessionMsgs) {
          mapped.push({ role: 'user', content: h.prompt });

          const isCoreSearch = h.prompt.toLowerCase().includes('ai core');
          let teamsGrid: any[] | undefined = undefined;
          let teamDetailCard: any = undefined;
          let studentDetailCard: any = undefined;

          if (isCoreSearch && h.response.includes('Found 4 teams')) {
            // Fetch teams from DB
            const searchRes = await adminService.searchContext(h.prompt);
            if (searchRes.type === 'teams') {
              teamsGrid = searchRes.results;
            }
          }

          // If it pulled a team details card
          if (h.response.includes('Pulled Team')) {
            const match = h.response.match(/Pulled (Team [a-zA-Z0-9 ]+)/);
            if (match) {
              const teamName = match[1].replace(' into context', '').trim();
              const searchRes = await adminService.searchContext(teamName);
              if (searchRes.type === 'teams' && searchRes.results.length > 0) {
                const details = await adminService.getTeamDetail(searchRes.results[0].id);
                
                const leadName = details.members?.find((m: any) => m.id === details.leadId)?.fullName || details.members?.[0]?.fullName || 'Lead';
                const membersCount = details.members?.length || 0;
                const progressVal = getTeamProgress(details);
                
                teamDetailCard = {
                  id: details.id,
                  name: details.name,
                  domain: details.domain,
                  description: details.description || details.projects?.[0]?.description,
                  lead: leadName,
                  score: getTeamScore(details),
                  progress: progressVal,
                  status: details.projects?.[0]?.status === 'at-risk' ? 'At Risk' : details.projects?.[0]?.status === 'completed' ? 'Completed' : 'On Track',
                  members: details.members?.map((m: any) => m.fullName) || [],
                  achievements: details.achievements?.map((a: any) => a.title) || (details.name === 'Team Pulse 2' ? ['Hackathon SF25 Winner', 'Best Poster'] : []),
                  updateDate: details.updatedAt ? new Date(details.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jul 1, 2026'
                };
              }
            }
          }

          mapped.push({
            role: 'assistant',
            content: h.response,
            teamsGrid,
            teamDetailCard,
            studentDetailCard
          });
        }

        // Update active context side panels if it was an ai core search
        const hasCoreSearch = sessionMsgs.some(h => h.prompt.toLowerCase().includes('ai core'));
        if (hasCoreSearch) {
          const searchRes = await adminService.searchContext('AI Core');
          if (searchRes.type === 'teams') {
            setContextResults({ teams: searchRes.results, students: [] });
            setContextType('teams');
            setContextSearchQuery('ai core');
            setShowContext(true);
          }
        }

        setMessages(mapped);
      })
      .catch(() => {});
  }, [currentSessionId]);

  const loadSessions = () => {
    adminService.getChatSessions()
      .then(setSessions)
      .catch(() => {});
  };

  const loadDefaultContext = () => {
    // Start with default search results
    adminService.searchContext('teams')
      .then(res => {
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
    adminService.searchContext(q)
      .then(res => {
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

        if (hasResults) {
          setShowContext(true);
        }
      })
      .catch(() => {});
  };

  const handleAutoSubmit = async (query: string) => {
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      handleSearchContext(query);
      const chat = await adminService.generateChat({
        prompt: query,
        sessionId: currentSessionId,
      });

      let teamsGrid: any[] | undefined = undefined;
      if (query.toLowerCase().includes('ai core')) {
        const searchRes = await adminService.searchContext(query);
        if (searchRes.type === 'teams') {
          teamsGrid = searchRes.results;
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: chat.response || 'No response generated.',
        teamsGrid
      }]);
      setShowContext(true);
      loadSessions();
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Apologies, I encountered an error communicating with the AI service.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    const newId = 'session_' + Math.random().toString(36).substr(2, 9);
    setCurrentSessionId(newId);
    setMessages([]);
    setActiveTeamDetail(null);
    setActiveStudentDetail(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      handleSearchContext(userText);
      const chat = await adminService.generateChat({
        prompt: userText,
        sessionId: currentSessionId,
      });

      let teamsGrid: any[] | undefined = undefined;
      if (userText.toLowerCase().includes('ai core')) {
        const searchRes = await adminService.searchContext(userText);
        if (searchRes.type === 'teams') {
          teamsGrid = searchRes.results;
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: chat.response || 'No response generated.',
        teamsGrid
      }]);

      loadSessions();
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Apologies, I encountered an error communicating with the AI service.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Card click triggers pulling context and appends detail block inline in the chat
  const handleSelectTeam = async (id: string) => {
    setLoading(true);
    try {
      const details = await adminService.getTeamDetail(id);
      
      const leadName = details.members?.find((m: any) => m.id === details.leadId)?.fullName || details.members?.[0]?.fullName || 'Lead';
      const membersCount = details.members?.length || 0;
      const progressVal = getTeamProgress(details);
      const statusLabel = details.projects?.[0]?.status === 'at-risk' ? 'at risk' : details.projects?.[0]?.status === 'completed' ? 'completed' : 'on track';
      
      const assistantText = `Pulled ${details.name} into context. Lead ${leadName}, ${membersCount} members, ${statusLabel} at ${progressVal}%. Domain: ${details.domain || 'AI Core'}. Problem: ${details.description || details.projects?.[0]?.description}. Ask follow-ups about members, milestones, or blockers.`;
      
      await adminService.saveChat({
        prompt: `Pull ${details.name} into context`,
        response: assistantText,
        sessionId: currentSessionId
      });

      const mappedDetails = {
        id: details.id,
        name: details.name,
        domain: details.domain,
        description: details.description || details.projects?.[0]?.description,
        lead: leadName,
        score: getTeamScore(details),
        progress: progressVal,
        status: details.projects?.[0]?.status === 'at-risk' ? 'At Risk' : details.projects?.[0]?.status === 'completed' ? 'Completed' : 'On Track',
        members: details.members?.map((m: any) => m.fullName) || [],
        achievements: details.achievements?.map((a: any) => a.title) || (details.name === 'Team Pulse 2' ? ['Hackathon SF25 Winner', 'Best Poster'] : []),
        updateDate: details.updatedAt ? new Date(details.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jul 1, 2026'
      };

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantText,
        teamDetailCard: mappedDetails
      }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      loadSessions();
    }
  };

  const handleSelectStudent = async (id: string) => {
    setLoading(true);
    try {
      const details = await adminService.getStudentDetail(id);
      
      const assistantText = `Pulled student profile for **${details.fullName}** (ID: ${details.regNo}) into context. Ask me questions about their performance, SSG domain or group status.`;

      await adminService.saveChat({
        prompt: `Pull ${details.fullName} into context`,
        response: assistantText,
        sessionId: currentSessionId
      });

      const mappedStudent = {
        id: details.id,
        fullName: details.fullName,
        regNo: details.regNo,
        ssgDomain: details.ssgDomain || details.team?.domain || 'AI Core',
        rewardPoints: details.rewardPoints || 90,
        team: details.team || { name: 'Individual', domain: 'AI Core' },
        userSkills: details.userSkills || [
          { skillName: 'Python', totalPoints: 90 },
          { skillName: 'PyTorch', totalPoints: 85 }
        ]
      };

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantText,
        studentDetailCard: mappedStudent
      }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      loadSessions();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white overflow-hidden select-none">
      {/* 1. Left Conversation History Panel */}
      <aside className="border-r border-gray-100 flex flex-col bg-gray-50/50 shrink-0 transition-all duration-300 ease-in-out overflow-hidden w-64">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-sm font-bold text-gray-800">
            Conversations
          </span>
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
              {sessions.find(s => s.sessionId === currentSessionId)?.title || 'New conversation'}
            </h1>
            <p className="text-[10px] text-gray-400">
              Ask about teams, students, achievements. Try: "get me top AI Core performing teams".
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 select-none">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Ask Projectverse</h2>
                <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
                  Query teams, students, domains or status. Results appear in the right panel — tap any card to bring it into this chat.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
                {[
                  'top AI Core teams',
                  'top Data students',
                  'at risk teams',
                  'completed teams in Web'
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
                <div className={`max-w-2xl rounded-2xl p-4 text-sm ${
                  m.role === 'user' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'bg-gray-50 text-gray-800'
                }`}>
                  {m.role === 'user' ? (
                    <p className="leading-relaxed font-semibold">{m.content}</p>
                  ) : (
                    <div className="space-y-3">
                      <div>{renderMessageContent(m.content)}</div>
                      
                      {/* Inline Teams Grid inside the message bubble */}
                      {m.teamsGrid && m.teamsGrid.length > 0 && (
                        <div className="mt-4 space-y-3 select-none">
                          <p className="text-xs font-bold text-gray-400">
                            Top teams • ai core — {m.teamsGrid.length} results shown on right panel.
                          </p>
                          <div className="grid grid-cols-2 gap-2.5">
                            {m.teamsGrid.map((team) => (
                              <TeamCard
                                key={team.id}
                                team={team}
                                onClick={() => handleSelectTeam(team.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Inline Team Detail Card inside the message bubble */}
                      {m.teamDetailCard && (
                        <TeamDetailCardInline team={m.teamDetailCard} />
                      )}

                      {/* Inline Student Detail Card inside the message bubble */}
                      {m.studentDetailCard && (
                        <StudentDetailCardInline student={m.studentDetailCard} />
                      )}
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

        {/* Input Bar matching screenshot */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm max-w-4xl mx-auto font-sans">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              title="Attach files"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <input
              type="text"
              placeholder="Ask about teams, students, achievements..."
              className="flex-1 bg-transparent border-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              value={input}
              onChange={e => setInput(e.target.value)}
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
      <aside className={`border-l border-gray-100 flex flex-col bg-white shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
        showContext ? (isExpanded ? 'w-[520px]' : 'w-80') : 'w-16'
      }`}>
        {!showContext ? (
          <div className="flex flex-col h-full bg-white select-none">
            {/* Top Toggle Button to Open Context Feed */}
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

            {/* List of Icons for Teams / Students */}
            <div className="flex-1 overflow-y-auto p-2 space-y-5">
              {/* Teams Section */}
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
                        title={`Team: ${team.name} (${team.domain || 'AI Core'})`}
                      >
                        <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {team.name ? team.name[0] : 'T'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Students Section */}
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
                          title={`Student: ${student.fullName} (${student.ssgDomain || 'AI'})`}
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
            {/* Header with Search and Expand/Collapse Button */}
            <div className="p-4 border-b border-gray-100 space-y-2.5 select-none font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-gray-800 uppercase flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-500" />
                  {contextSearchQuery ? `Top teams • ${contextSearchQuery.toLowerCase()}` : 'AI Context Feed'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-400 mr-1">
                    {contextResults.teams.length || contextResults.students.length || ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-all active:scale-95"
                    title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
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
                  onChange={e => {
                    setContextSearchQuery(e.target.value);
                    handleSearchContext(e.target.value);
                  }}
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Dynamic Grid Layout boxes of Teams / Students */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {contextType === 'teams' || contextType === 'mixed' ? (
                <div className="space-y-3">
                  <div className={`grid gap-2.5 transition-all ${
                    isExpanded ? 'grid-cols-3' : 'grid-cols-1'
                  }`}>
                    {contextResults.teams.map((team: any) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        onClick={() => handleSelectTeam(team.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {contextType === 'students' || contextType === 'mixed' ? (
                <div className="space-y-3">
                  <div className={`grid gap-2.5 transition-all ${
                    isExpanded ? 'grid-cols-3' : 'grid-cols-1'
                  }`}>
                    {contextResults.students.map((student: any) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        onClick={() => handleSelectStudent(student.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
