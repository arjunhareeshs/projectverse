import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Filter,
  Users,
  Calendar,
  BarChart2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Sparkles,
  Send,
  MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import { projectService } from '../services/project.service';
import { aiService } from '../services/ai.service';
import { teamService } from '../services/team.service';
import { AuroraIcon } from '../components/AuroraIcon';
import { renderMessageContent } from '../chat/aiResponse';

interface Project {
  id: string;
  name: string;
  client: string;
  teamSize: number;
  dueDate: string;
  progress: number;
  daysLeft: number;
  status: string;
  color: string;
  initials: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  'On Track': { label: 'On Track', icon: CheckCircle2, bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  'At Risk': { label: 'At Risk', icon: AlertCircle, bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  'In Progress': { label: 'In Progress', icon: Clock, bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
  'Completed': { label: 'Completed', icon: CheckCircle2, bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  'planned': { label: 'Planned', icon: Clock, bg: 'bg-muted/15', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

const progressBarColor: Record<string, string> = {
  'On Track': 'bg-success',
  'At Risk': 'bg-warning',
  'In Progress': 'bg-primary',
  'Completed': 'bg-success',
  'planned': 'bg-muted-foreground',
};

const PROJECT_COLORS = ['bg-primary', 'bg-warning', 'bg-secondary', 'bg-success', 'bg-info'];

type ViewMode = 'grid' | 'list';
type FilterStatus = 'All' | 'On Track' | 'At Risk' | 'In Progress' | 'Completed';

const SUGGESTED_TOPICS = [
  {
    name: "Smart Campus Management System",
    domain: "Web Development",
    description: "An automated portal to coordinate classrooms, event registrations, and campus resources."
  },
  {
    name: "MediScan Disease Detection AI",
    domain: "AI / ML",
    description: "Early medical imaging diagnostic tool powered by deep learning for scanning anomalies."
  },
  {
    name: "IoT Food Freshness Tracker",
    domain: "Hardware & IoT",
    description: "Multi-sensor tracking device to monitor humidity and temperature of cold food stores."
  },
  {
    name: "Decentralized Peer-to-Peer Academic Credentials",
    domain: "Blockchain",
    description: "Immutable storage system for academic certificate verification using secure smart contracts."
  },
  {
    name: "Automated Waste Sorting System",
    domain: "Robotics & AI",
    description: "Computer-vision guided robotic arm sorting system to separate recyclable objects."
  },
  {
    name: "Threat Detection & Incident Response Platform",
    domain: "Cybersecurity",
    description: "Real-time log analyzer reporting anomaly alerts and suspicious networking behaviors."
  }
];

export const AllProjects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');

  // Creation view state (displaces projects list when true)
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [projectStatus, setProjectStatus] = useState('In Progress');
  const [projectDomain, setProjectDomain] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // AI chat designer states with proactive greeting
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant' | 'system', content: string }>>([
    { role: 'assistant', content: "Hi! I'm your Project Designer Co-pilot. To help you select or design the perfect project, which domain and section (hardware, software, etc.) are you willing to do your project in?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Track the last list of suggestions shown to the user so ordinal picks work
  const [lastSuggestions, setLastSuggestions] = useState<Array<{ name: string; domain: string; description: string }>>([]);

  // Dynamic problem statement ranking state
  const [problems, setProblems] = useState<Array<{ name: string; domain: string; description: string; score: number }>>([]);

  const updateProblemRanking = (userInput: string) => {
    const inputLower = userInput.toLowerCase();
    setProblems(prevProblems => {
      const scored = prevProblems.map(p => {
        let score = 0;
        const domainLower = (p.domain || '').toLowerCase();
        
        // Exact / prefix matching for domain
        if (inputLower.includes(domainLower) || domainLower.includes(inputLower)) {
          score += 100;
        }

        // Domain-specific aliases
        if (inputLower.includes('web') && domainLower.includes('web')) score += 80;
        if (inputLower.includes('software') && domainLower.includes('web')) score += 50;
        if ((inputLower.includes('ai') || inputLower.includes('machine learning') || inputLower.includes('ml')) && (domainLower.includes('ai') || domainLower.includes('ml') || domainLower.includes('intelligence'))) score += 80;
        if ((inputLower.includes('hardware') || inputLower.includes('iot') || inputLower.includes('internet of things') || inputLower.includes('embed')) && (domainLower.includes('hardware') || domainLower.includes('iot') || domainLower.includes('sensor'))) score += 80;
        if (inputLower.includes('blockchain') && domainLower.includes('blockchain')) score += 80;
        if (inputLower.includes('cyber') && domainLower.includes('cyber')) score += 80;
        if (inputLower.includes('robot') && domainLower.includes('robot')) score += 80;

        // Keyword checking in name & description
        const nameWords = p.name.toLowerCase().split(/\s+/);
        const descWords = p.description.toLowerCase().split(/\s+/);
        const inputWords = inputLower.split(/\s+/);

        inputWords.forEach(word => {
          if (word.length > 3) {
            if (nameWords.some(w => w.includes(word))) score += 30;
            if (descWords.some(w => w.includes(word))) score += 15;
          }
        });

        return { ...p, score };
      });
      
      // Sort by score (descending)
      return scored.sort((a, b) => b.score - a.score);
    });
  };

  const handleSelectTopic = (topic: typeof SUGGESTED_TOPICS[0]) => {
    setProjectName(topic.name);
    setProjectClient(topic.description);
    setProjectDomain(topic.domain);
    setChatMessages(prev => [
      ...prev,
      { role: 'system', content: `Auto-filled details for "${topic.name}" problem statement.` }
    ]);
  };

  // Helper: parse ordinal strings like "1","1st","first","2nd","second"... → 1-based index
  const parseOrdinal = (text: string): number | null => {
    const lower = text.toLowerCase().trim();
    // Written ordinals
    const words: Record<string, number> = {
      first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
      sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    };
    for (const [word, num] of Object.entries(words)) {
      if (lower.includes(word)) return num;
    }
    // Numeric match: "5", "5th", "5 th", "option 5", "number 5"
    const numMatch = lower.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1], 10);
    return null;
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const promptText = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: promptText }]);
    setChatLoading(true);

    // ── Ordinal / number selection from the last suggestions list ──────────
    const selectedIndex = parseOrdinal(promptText);
    if (selectedIndex !== null && lastSuggestions.length > 0) {
      const picked = lastSuggestions[selectedIndex - 1];
      if (picked) {
        // Auto-fill the form fields
        setProjectName(picked.name);
        setProjectClient(picked.description);
        setProjectDomain(picked.domain);
        updateProblemRanking(picked.domain + ' ' + picked.name);

        const confirmMsg = `Great choice! I've selected **${picked.name}** (${picked.domain}) for you and pre-filled the project details on the right.

Here's a quick summary:
- **Domain:** ${picked.domain}
- **Project:** ${picked.name}
- **Description:** ${picked.description}

Would you like me to outline the key milestones, tech stack, or scope for this project?`;
        setChatMessages(prev => [...prev, { role: 'assistant', content: confirmMsg }]);
        setChatLoading(false);
        return;
      }
    }

    // Initial query ranking updates immediately
    updateProblemRanking(promptText);

    try {
      const isProjectConfigured = projectName.trim().length > 0;

      // Build a numbered list of last suggestions to inject into the AI prompt
      const lastSuggestionsContext = lastSuggestions.length > 0
        ? `\n\nThe LAST suggestions you showed the user were:\n${lastSuggestions.map((s, i) => `${i + 1}. ${s.name} (${s.domain}) — ${s.description}`).join('\n')}\n\nIf the user refers to a number or ordinal (like "1st", "3", "fifth"), select that suggestion from this list and confirm it to the user.`
        : '';

      const systemContext = `You are the Project Designer Co-pilot, an expert AI assistant. Your goal is to help the user select and finalize a project.
Current Context:
${isProjectConfigured ? `The user has selected: Name="${projectName}", Domain="${projectDomain}", Description="${projectClient}".` : `The user has NOT selected a project yet.`}
${lastSuggestionsContext}

You MUST follow this exact 3-step workflow:
1. SUGGESTION PHASE (If the user hasn't selected a project or wants ideas): Suggest 5 numbered top projects matching their domain and interests. Do NOT default to "Web Development" unless explicitly asked. For "AI Core" or "Autonomous Robotics" interest, suggest AI/ML/Robotics projects.
   When you suggest projects, ALWAYS format them as a numbered list (1. 2. 3. 4. 5.) with Name, Domain, and a brief description.
2. VALUE PHASE: Once a project is chosen, provide unique value and insights.
3. FINALIZATION PHASE: Finalize with technical requirements and scope.

IMPORTANT: If the user references a number ("5th", "5 th i like", "fifth", "I want the 5th one"), they are selecting that numbered item from the last list. Confirm the selection clearly.

Respond in a concise, structured format.
User Input: ${promptText}
`;
      const res = await aiService.query(systemContext);
      const reply = res.response || "I suggest focusing on designing a system that satisfies these requirements. Click on one of the problem statements on the right that matches your target domain.";

      // ── Parse the AI reply to extract a numbered suggestion list ──────────
      const extractedSuggestions: Array<{ name: string; domain: string; description: string }> = [];
      const lines = reply.split('\n');
      for (const line of lines) {
        // Match lines like: "1. Autonomous Robotics using RL" or "1. **Autonomous Robotics...**"
        const match = line.match(/^\s*(\d+)\.\s+\*{0,2}(.+?)\*{0,2}\s*[:\-–]?\s*(.*)$/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const namePart = match[2].trim();
          const descPart = match[3].trim();
          // Try to extract domain from parentheses: "Project Name (Domain)"
          const domainMatch = namePart.match(/\(([^)]+)\)$/);
          const cleanName = domainMatch ? namePart.replace(domainMatch[0], '').trim() : namePart;
          const domain = domainMatch ? domainMatch[1] : 'AI / ML';
          if (idx >= 1 && idx <= 10 && cleanName.length > 3) {
            extractedSuggestions[idx - 1] = { name: cleanName, domain, description: descPart || cleanName };
          }
        }
      }
      const validSuggestions = extractedSuggestions.filter(Boolean);
      if (validSuggestions.length > 0) {
        setLastSuggestions(validSuggestions);
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      // Rank problem statements using the keywords from both user + AI
      updateProblemRanking(promptText + ' ' + reply);
    } catch (e) {
      const lower = promptText.toLowerCase();

      // AI Core / Robotics / Autonomous selection
      const aiCoreProjects = [
        { name: 'Autonomous Robotics using Reinforcement Learning', domain: 'Robotics & AI', description: 'AI-powered robotic system that learns from interactions using RL algorithms.' },
        { name: 'MediScan Disease Detection AI', domain: 'AI / ML', description: 'Early medical imaging diagnostic tool powered by deep learning.' },
        { name: 'Intelligent Traffic Management System', domain: 'AI / ML & IoT', description: 'AI-based traffic signal controller optimizing flow using real-time sensor data.' },
        { name: 'NLP Sentiment Analysis Engine', domain: 'AI / ML', description: 'Analyzes text data to determine sentiment, opinions, and emotional tone.' },
        { name: 'AI-Powered Personalized Learning Platform', domain: 'AI Core', description: 'Adapts learning content dynamically based on student performance using deep learning.' },
      ];

      let reply = 'That sounds like a great choice! Here are some top project suggestions based on your interest:\n\n';
      let suggestions = aiCoreProjects;

      if (lower.includes('web') || lower.includes('software')) {
        suggestions = [
          { name: 'Smart Campus Management System', domain: 'Web Development', description: 'An automated portal to coordinate classrooms, events, and campus resources.' },
          { name: 'Peer-to-Peer Academic Credentials', domain: 'Blockchain', description: 'Immutable storage system for academic certificate verification.' },
          { name: 'E-Waste Recycling Platform', domain: 'Web Development', description: 'Platform facilitating collection, recycling, and disposal of electronic waste.' },
          { name: 'Online Collaborative Coding IDE', domain: 'Web Development', description: 'Real-time collaborative code editor with version control integration.' },
          { name: 'AI-Powered Customer Support Chatbot', domain: 'AI / ML', description: 'Chatbot using NLP to provide personalized customer support.' },
        ];
      } else if (lower.includes('iot') || lower.includes('hardware')) {
        suggestions = [
          { name: 'IoT Food Freshness Tracker', domain: 'Hardware & IoT', description: 'Multi-sensor tracking device to monitor humidity and temperature of cold food stores.' },
          { name: 'Smart Home Automation System', domain: 'Hardware & IoT', description: 'AI-powered system integrating smart devices to automate home settings.' },
          { name: 'Wearable Health Monitoring Device', domain: 'Hardware & IoT', description: 'Wearable device tracking vital signs using IoT sensors and ML.' },
          { name: 'Smart Agriculture Monitoring System', domain: 'Hardware & IoT', description: 'Monitor soil moisture, temperature, and crop health using IoT sensors.' },
          { name: 'Intelligent Traffic Management System', domain: 'AI / ML & IoT', description: 'Optimizes traffic light control and routing using IoT sensors.' },
        ];
      }

      reply += suggestions.map((s, i) => `${i + 1}. **${s.name}** (${s.domain})\n   ${s.description}`).join('\n\n');
      reply += '\n\nWhich of these resonates with you? Reply with the number (e.g. "5" or "fifth") to select one.';

      setLastSuggestions(suggestions);
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      updateProblemRanking(promptText);
    } finally {
      setChatLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await projectService.getActiveProjects();
      const colored = data.map((p: Project, i: number) => ({
        ...p,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      }));
      setProjects(colored);

      // Load problems from Team table (real DB)
      const teams = await teamService.getTeams();
      const extractedProblems = teams
        .filter((t: any) => t.description && t.description.trim() !== '')
        .map((t: any) => ({
          name: t.currentProjectLabel || t.name,
          domain: t.domain || 'Web Development',
          description: t.description,
          score: 0
        }));

      // Combine real DB problems with standard templates to guarantee data exists
      const combined = [...extractedProblems];
      SUGGESTED_TOPICS.forEach(topic => {
        if (!combined.some(p => p.name.toLowerCase() === topic.name.toLowerCase())) {
          combined.push({ ...topic, score: 0 });
        }
      });
      setProblems(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDirectCreate = async () => {
    if (!projectName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await projectService.createProject({
        name: projectName,
        description: projectClient || undefined,
        status: 'In Progress',
      });
      setIsCreating(false);
      setProjectName('');
      setProjectClient('');
      loadProjects();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!projectName.trim()) {
      setCreateError('Project Name is required');
      return;
    }
    setCreating(true);
    try {
      await projectService.createProject({
        name: projectName,
        description: projectClient || undefined,
        status: projectStatus,
      });
      setIsCreating(false);
      setProjectName('');
      setProjectClient('');
      setProjectStatus('In Progress');
      loadProjects();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, filterStatus]);

  const statuses: FilterStatus[] = ['All', 'On Track', 'At Risk', 'In Progress', 'Completed'];

  if (isCreating) {
    return (
      <div className="flex h-[calc(100vh-4rem)] -mx-6 -my-6 overflow-hidden bg-background w-[calc(100%+3rem)] border-t border-border animate-in fade-in duration-200">
        
        {/* Left Column: AI Assistant Chat & Creation Form (60%) */}
        <div className="w-3/5 flex flex-col border-r border-border h-full overflow-hidden bg-background">
          
          {/* 1. Chat Interface (Upper part of left column - fills the column height) */}
          <div className="flex-1 flex flex-col bg-muted/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-2.5">
                <AuroraIcon size={24} className="shrink-0 spin-[4s]" />
                <span className="text-xs font-black text-gray-800 uppercase tracking-widest">Project Designer AI</span>
              </div>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setProjectName('');
                  setProjectClient('');
                }}
                className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg shadow-sm transition-all"
              >
                <X className="h-3.5 w-3.5" />
                <span>Exit Designer</span>
              </button>
            </div>
            
            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={cn("flex gap-3 max-w-[85%]", msg.role === 'user' ? "ml-auto justify-end" : "justify-start")}>
                  {msg.role !== 'user' && (
                    <AuroraIcon size={28} className="shrink-0 mt-0.5" />
                  )}
                  <div className={cn("rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm font-medium", 
                    msg.role === 'user' 
                      ? "bg-indigo-600 text-white font-semibold" 
                      : msg.role === 'system'
                      ? "bg-indigo-50 text-indigo-800 border border-indigo-100 italic"
                      : "bg-white text-gray-800 border border-gray-100"
                  )}>
                    {msg.role === 'user' ? msg.content : renderMessageContent(msg.content)}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3 justify-start items-start">
                  <AuroraIcon size={28} className="shrink-0 mt-0.5" />
                  <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input Bar */}
            <div className="p-3 border-t border-border bg-card flex gap-3 items-center shadow-inner">
              <input
                type="text"
                placeholder="Suggest a domain or describe your goals to help Co-pilot refine problem ideas..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={handleSendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-md shrink-0 flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom Confirmation Bar - appears only when a problem statement is selected */}
          {projectName ? (
            <div className="p-4 border-t border-border bg-card flex items-center justify-between shrink-0 animate-in slide-in-from-bottom-5 duration-200">
              <div className="min-w-0 pr-3">
                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mb-1 font-mono">
                  Selected Topic
                </span>
                <h3 className="text-sm font-black text-gray-800 truncate">{projectName}</h3>
                <p className="text-xs text-gray-500 font-medium truncate max-w-md mt-0.5">{projectClient}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setProjectName('');
                    setProjectClient('');
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-600 transition-all"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleDirectCreate}
                  disabled={creating}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 transition-all flex items-center gap-1"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-t border-border bg-card/50 text-center shrink-0">
              <p className="text-[10px] text-gray-400 font-bold">Select a problem statement card from the list on the right to auto-configure and create your project.</p>
            </div>
          )}
        </div>

        {/* Right Column: Problem Statements Topics & Domain View (40%) */}
        <div className="w-2/5 flex flex-col bg-muted/10 h-full overflow-hidden">
          <div className="p-4 border-b border-border bg-card shrink-0 shadow-sm">
            <span className="text-xs font-black text-gray-800 uppercase tracking-widest">Problem Statements (Real DB)</span>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Top matching problem statements ranked dynamically. Click to select.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {problems.slice(0, 10).map((topic, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectTopic(topic)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-all duration-200 flex flex-col gap-2 hover:shadow-md hover:scale-[1.01] bg-card",
                  projectName === topic.name 
                    ? "bg-indigo-50/50 border-indigo-500 shadow-sm" 
                    : "border-border/80 hover:border-indigo-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-black text-gray-800 leading-snug line-clamp-1">{topic.name}</h4>
                  <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-wider shrink-0 font-mono">
                    {topic.domain}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed line-clamp-2">
                  {topic.description}
                </p>
              </button>
            ))}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? 'Loading…' : `${filtered.length} project${filtered.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  filterStatus === s
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card h-48 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-foreground">No projects found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const sConfig = statusConfig[project.status] || statusConfig['In Progress'];
            const barColor = progressBarColor[project.status] || 'bg-primary';
            const StatusIcon = sConfig.icon;

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group relative rounded-xl border border-border bg-card p-5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                {/* Top bar accent */}
                <div className={cn('absolute inset-x-0 top-0 h-1 rounded-t-xl', project.color)} />

                <div className="flex items-start justify-between mb-4 pt-2">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold', project.color)}>
                    {project.initials}
                  </div>
                  <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', sConfig.bg, sConfig.text)}>
                    <StatusIcon className="h-3 w-3" />
                    {project.status}
                  </span>
                </div>

                <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
                  {project.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-1">{project.client}</p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted-foreground">Progress</span>
                    <span className="text-[11px] font-semibold text-foreground">{project.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${project.progress}%` }} />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {project.teamSize} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {project.daysLeft} days left
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // List View
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* List header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4 px-5 py-3 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Project</span>
            <span>Status</span>
            <span>Progress</span>
            <span>Team</span>
            <span>Due</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((project) => {
              const sConfig = statusConfig[project.status] || statusConfig['In Progress'];
              const barColor = progressBarColor[project.status] || 'bg-primary';

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4 px-5 py-4 items-center hover:bg-muted/40 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-white text-xs font-bold', project.color)}>
                      {project.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{project.name}</p>
                      <p className="text-[11px] text-muted-foreground">{project.client}</p>
                    </div>
                  </div>

                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold w-fit', sConfig.bg, sConfig.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', sConfig.dot)} />
                    {project.status}
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full', barColor)} style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground w-8 shrink-0">{project.progress}%</span>
                  </div>

                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {project.teamSize}
                  </span>

                  <span className="text-sm text-muted-foreground">{project.daysLeft}d left</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
