import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAppSelector } from '../app/hooks';
import { Sparkles, Send, CheckCircle, X, ArrowLeft, Bot, User as UserIcon } from 'lucide-react';
import { TeamMemberSelect } from '../components/projects/TeamMemberSelect';
import { lifecycleService } from '../services/lifecycle.service';
import { IntakeWizard } from '../components/lifecycle/IntakeWizard';
import { ProjectCategory } from '../types/projectLog';

type ChatRole = 'bot' | 'user';

interface Option {
  label: string;
  value: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  options?: Option[];
}

interface CatalogTreeNode {
  type: string;
  domains: { domain: string; subdomains: string[] }[];
}

interface ProblemStatement {
  id: string;
  name: string;
  shortName?: string | null;
  problemStatement: string;
  domain: string;
  sector: string | null;
  difficultyLevel: string | null;
  type: string | null;
  problemId: string | null;
  technologies: string[];
  _count?: { childProjects: number };
}

type Phase =
  | 'projectCategory'
  | 'category'
  | 'domain'
  | 'subdomain'
  | 'problemList'
  | 'proposeInput'
  | 'proposeConfirm'
  | 'mentor'
  | 'report'
  | 'done';

type LlmChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const CHECKLIST_DIMENSIONS: { id: string; label: string }[] = [
  { id: 'problemClarity', label: 'Problem understanding' },
  { id: 'targetUsers', label: 'Target users' },
  { id: 'uniqueValue', label: 'Unique value' },
  { id: 'techStack', label: 'Tech stack' },
  { id: 'mvpScope', label: 'MVP scope' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'risks', label: 'Risks' },
  { id: 'successMetrics', label: 'Success metrics' },
];

type Checklist = Record<string, boolean>;

type MoscowList = { must: string[]; should: string[]; could: string[]; wont: string[] };

interface ExtractedPlan {
  problem: string;
  targetUsers: string;
  uniqueValue: string;
  techStack: string[];
  mvpFeatures: string[];
  moscow: MoscowList;
  risks: string[];
  successMetrics: string[];
  timelineWeeks: number;
}

interface Allocation {
  userId: string;
  name: string;
  suggestedRole: string;
  matchedSkills: string[];
  suggestedTasks: string[];
}

let msgCounter = 0;
const nextId = () => `m${++msgCounter}`;

export const ProjectSelectionChat: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<Phase>('projectCategory');
  const [backStack, setBackStack] = useState<Phase[]>([]);
  const [tree, setTree] = useState<CatalogTreeNode[]>([]);

  const [projectCategory, setProjectCategory] = useState<ProjectCategory>('MINI');
  const [category, setCategory] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProblemStatement | null>(null);

  const [proposalDraft, setProposalDraft] = useState('');
  const [proposalResult, setProposalResult] = useState<any>(null);

  const [mentorHistory, setMentorHistory] = useState<LlmChatMessage[]>([]);
  const [readyToSelect, setReadyToSelect] = useState(false);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [readinessScore, setReadinessScore] = useState(0);
  const [extractedPlan, setExtractedPlan] = useState<ExtractedPlan | null>(null);
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [allocating, setAllocating] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [inputEnabled, setInputEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [repoLink, setRepoLink] = useState('');
  const [selecting, setSelecting] = useState(false);

  const [showIntakeWizard, setShowIntakeWizard] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const addBotMessage = (text: string, options?: Option[]) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'bot', text, options }]);
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
  };

  const didInit = useRef(false);

  // Kick things off with category-first step — Mini, Final Year, Research
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        const res = await api.get('/projects/catalog/tree');
        setTree(res.data.tree || []);
      } catch (err) {
        console.error('Failed to load catalog tree', err);
      }
      addBotMessage(
        "What are you planning to build?",
        [
          { label: 'Mini Project', value: 'MINI' },
          { label: 'Final Year Project', value: 'FINAL_YEAR' },
          { label: 'Research Project', value: 'RESEARCH' },
        ],
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushBack = (from: Phase) => setBackStack((prev) => [...prev, from]);

  const handleProjectCategorySelect = async (opt: Option) => {
    addUserMessage(opt.label);
    const cat = opt.value as ProjectCategory;
    setProjectCategory(cat);
    try {
      await lifecycleService.startCatalogSession(cat);
    } catch (err) {
      console.error('Failed to start catalog session', err);
    }
    pushBack('projectCategory');
    setPhase('category');
    addBotMessage(
      `Great — ${opt.label}! What kind of project focus would you like to explore?`,
      [
        { label: 'Hardware', value: 'Hardware' },
        { label: 'Software', value: 'Software' },
        { label: 'Hardware & Software', value: 'Hardware & Software' },
      ],
    );
  };

  const handleCategorySelect = (opt: Option) => {
    addUserMessage(opt.label);
    setCategory(opt.value);
    const domains = tree.find((t) => t.type === opt.value)?.domains || [];
    pushBack('category');
    setPhase('domain');
    addBotMessage(
      `Great — ${opt.label}. Which domain would you like to explore?`,
      domains.map((d) => ({ label: d.domain, value: d.domain })),
    );
  };

  const handleDomainSelect = (opt: Option) => {
    addUserMessage(opt.label);
    setDomain(opt.value);
    const domains = tree.find((t) => t.type === category)?.domains || [];
    const subdomains = domains.find((d) => d.domain === opt.value)?.subdomains || [];
    pushBack('domain');
    setPhase('subdomain');
    addBotMessage(
      `Within ${opt.label}, which subdomain interests you?`,
      subdomains.map((s) => ({ label: s, value: s })),
    );
  };

  const handleSubdomainSelect = async (opt: Option) => {
    addUserMessage(opt.label);
    setSubdomain(opt.value);
    pushBack('subdomain');
    setPhase('problemList');
    setBusy(true);
    try {
      const res = await api.get('/projects/catalog', {
        params: { type: category, domain, sector: opt.value },
      });
      setProblems(res.data || []);
      if ((res.data || []).length === 0) {
        addBotMessage(
          `There are no problem statements listed yet under ${opt.value}. Would you like to propose a new one?`,
          [{ label: 'Propose a new problem statement', value: 'propose' }],
        );
      } else {
        addBotMessage(`Here are the problem statements under ${opt.value}. Pick one to explore:`);
      }
    } catch (err) {
      console.error('Failed to load problem statements', err);
      addBotMessage('Something went wrong loading problem statements. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleProblemPick = (ps: ProblemStatement) => {
    // Guard against double-clicks / stray re-clicks re-firing this while the
    // card list is still visible — without this, a second click re-adds the
    // same "Do you like this problem statement?" prompt.
    if (selectedTemplate || busy) return;
    addUserMessage(ps.name || ps.shortName || ps.problemId || 'Selected statement');
    setSelectedTemplate(ps);
    addBotMessage(
      `"${ps.problemStatement}"\n\nDo you like this problem statement?`,
      [
        { label: "Yes, let's discuss it", value: 'accept' },
        { label: 'Go back and pick another domain', value: 'back-domain' },
        { label: 'Show me a new problem statement idea instead', value: 'propose' },
      ],
    );
  };

  const startMentor = async (ps: ProblemStatement) => {
    setPhase('mentor');
    setInputEnabled(true);
    setBusy(true);
    try {
      const res = await api.post('/projects/catalog/mentor', {
        templateId: ps.id,
        history: [],
        mode: 'chat',
      });
      const reply = res.data.reply as string;
      setMentorHistory([{ role: 'assistant', content: reply }]);
      setChecklist(res.data.checklist || {});
      setReadinessScore(res.data.readinessScore || 0);
      addBotMessage(reply);
    } catch (err) {
      console.error('Mentor start failed', err);
      addBotMessage(
        "Great choice! Let me help you understand this problem statement step by step. Do you have any initial thoughts about it, or would you like me to explain what it's about?",
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePostPickOption = (value: string) => {
    if (value === 'accept' && selectedTemplate) {
      addUserMessage("Yes, let's discuss it");
      pushBack('problemList');
      startMentor(selectedTemplate);
      return;
    }
    if (value === 'back-domain') {
      addUserMessage('Go back and pick another domain');
      goBackTo('domain');
      return;
    }
    if (value === 'propose') {
      addUserMessage('Propose a new problem statement');
      setPhase('proposeInput');
      setInputEnabled(true);
      addBotMessage(
        `Tell me your problem statement idea for ${domain}${subdomain ? ' / ' + subdomain : ''}. I'll check that it's novel and qualifiable.`,
      );
    }
  };

  const goBackTo = (target: Phase) => {
    setInputEnabled(false);
    if (target === 'projectCategory') {
      setCategory(null);
      setDomain(null);
      setSubdomain(null);
      setSelectedTemplate(null);
      setPhase('projectCategory');
      addBotMessage(
        "What are you planning to build?",
        [
          { label: 'Mini Project', value: 'MINI' },
          { label: 'Final Year Project', value: 'FINAL_YEAR' },
          { label: 'Research Project', value: 'RESEARCH' },
        ],
      );
    } else if (target === 'domain') {
      setSubdomain(null);
      setSelectedTemplate(null);
      const domains = tree.find((t) => t.type === category)?.domains || [];
      setPhase('domain');
      addBotMessage(
        'No problem — which domain would you like instead?',
        domains.map((d) => ({ label: d.domain, value: d.domain })),
      );
    } else if (target === 'category') {
      setDomain(null);
      setSubdomain(null);
      setSelectedTemplate(null);
      setPhase('category');
      addBotMessage(
        "Let's start over. What kind of project focus would you like to explore?",
        [
          { label: 'Hardware', value: 'Hardware' },
          { label: 'Software', value: 'Software' },
          { label: 'Hardware & Software', value: 'Hardware & Software' },
        ],
      );
    } else if (target === 'subdomain') {
      setSelectedTemplate(null);
      const domains = tree.find((t) => t.type === category)?.domains || [];
      const subdomains = domains.find((d) => d.domain === domain)?.subdomains || [];
      setPhase('subdomain');
      addBotMessage(
        'Which subdomain would you like instead?',
        subdomains.map((s) => ({ label: s, value: s })),
      );
    } else if (target === 'problemList') {
      setSelectedTemplate(null);
      setPhase('problemList');
      addBotMessage(
        'Let\'s pick another problem statement.',
      );
    } else if (target === 'proposeConfirm') {
      setSelectedTemplate(null);
      setPhase('proposeConfirm');
      addBotMessage(
        'Shall I add this to the catalog and set it as your problem statement?',
        [
          { label: 'Confirm and add', value: 'confirm' },
          { label: 'Let me revise it', value: 'revise' },
        ],
      );
    } else if (target === 'mentor') {
      setPhase('mentor');
      setInputEnabled(true);
      addBotMessage('Let\'s continue our discussion.');
    }
  };

  const handleGlobalBack = () => {
    setBackStack((prev) => {
      const copy = [...prev];
      const target = copy.pop();
      if (target) goBackTo(target);
      return copy;
    });
  };

  const submitProposal = async () => {
    if (!proposalDraft.trim() || !category || !domain) return;
    addUserMessage(proposalDraft);
    setBusy(true);
    setInputEnabled(false);
    try {
      const res = await api.post('/projects/catalog/validate-proposal', {
        type: category,
        domain,
        sector: subdomain,
        proposedStatement: proposalDraft,
      });
      setProposalResult(res.data);
      if (res.data.valid) {
        setPhase('proposeConfirm');
        addBotMessage(
          `This looks good: ${res.data.reason}\n\nNormalized statement: "${res.data.normalizedStatement}"\nSuggested difficulty: ${res.data.suggestedDifficulty}\n\nShall I add this to the catalog and set it as your problem statement?`,
          [
            { label: 'Confirm and add', value: 'confirm' },
            { label: 'Let me revise it', value: 'revise' },
          ],
        );
      } else {
        addBotMessage(
          `This doesn't quite qualify yet: ${res.data.reason}\n\nWant to try rewording it, or go back and pick an existing statement?`,
          [
            { label: 'Try again', value: 'revise' },
            { label: 'Go back to problem list', value: 'back-list' },
          ],
        );
        setPhase('proposeInput');
        setInputEnabled(true);
      }
    } catch (err) {
      console.error('Validation failed', err);
      addBotMessage('Something went wrong validating your proposal. Please try again.');
      setInputEnabled(true);
    } finally {
      setBusy(false);
      setProposalDraft('');
    }
  };

  const handleProposeConfirmOption = async (value: string) => {
    if (value === 'confirm' && proposalResult) {
      addUserMessage('Confirm and add');
      setBusy(true);
      try {
        const res = await api.post('/projects/catalog/propose', {
          type: category,
          domain,
          sector: subdomain,
          statement: proposalResult.normalizedStatement,
          shortName: proposalResult.suggestedShortName,
          difficultyLevel: proposalResult.suggestedDifficulty,
        });
        const created: ProblemStatement = res.data;
        setSelectedTemplate(created);
        addBotMessage("Added to the catalog. Let's dig into how you'll build it.");
        pushBack('proposeConfirm');
        await startMentor(created);
      } catch (err) {
        console.error('Failed to persist proposal', err);
        addBotMessage('Could not save this problem statement. Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (value === 'revise') {
      addUserMessage('Let me revise it');
      setPhase('proposeInput');
      setInputEnabled(true);
      addBotMessage('Go ahead, rewrite your problem statement idea.');
      return;
    }
    if (value === 'back-list') {
      addUserMessage('Go back to problem list');
      setSelectedTemplate(null);
      setPhase('problemList');
      addBotMessage('Here are the problem statements again — pick one to explore:');
    }
  };

  const sendMentorMessage = async () => {
    if (!inputValue.trim() || !selectedTemplate) return;
    const text = inputValue.trim();
    addUserMessage(text);
    setInputValue('');
    setBusy(true);
    const newHistory: LlmChatMessage[] = [...mentorHistory, { role: 'user', content: text }];
    try {
      const res = await api.post('/projects/catalog/mentor', {
        templateId: selectedTemplate.id,
        history: newHistory,
        userMessage: text,
        mode: 'chat',
        checklist,
      });
      const reply = res.data.reply as string;
      setMentorHistory([...newHistory, { role: 'assistant', content: reply }]);
      setChecklist(res.data.checklist || checklist);
      setReadinessScore(res.data.readinessScore ?? readinessScore);
      addBotMessage(reply);
    } catch (err) {
      console.error('Mentor chat failed', err);
      addBotMessage('Sorry, I had trouble responding. Could you rephrase that?');
    } finally {
      setBusy(false);
    }
  };

  const requestReport = async () => {
    if (!selectedTemplate) return;
    setBusy(true);
    setInputEnabled(false);
    try {
      const res = await api.post('/projects/catalog/mentor', {
        templateId: selectedTemplate.id,
        history: mentorHistory,
        mode: 'report',
      });
      const ready = res.data.ready !== false;
      setReadyToSelect(ready);
      setExtractedPlan(res.data.extracted || null);
      addBotMessage(res.data.report);
      if (ready) {
        pushBack('mentor');
        setPhase('report');
      } else {
        setInputEnabled(true);
      }
    } catch (err) {
      console.error('Report generation failed', err);
      addBotMessage('Could not generate the readiness report. Please try once more.');
      setInputEnabled(true);
    } finally {
      setBusy(false);
    }
  };

  const handleFinalSelect = async () => {
    if (!user?.teamId) {
      alert('You must be part of a team to select a project.');
      return;
    }
    setShowTeamModal(true);
  };

  const confirmSelection = async () => {
    if (!selectedTemplate) return;
    setSelecting(true);
    try {
      const res = await api.post(`/projects/catalog/${selectedTemplate.id}/select`, {
        teamMembers,
        repoLink: repoLink.trim() || undefined,
        plan: extractedPlan || undefined,
        category: projectCategory,
      });
      setShowTeamModal(false);
      const newProjId = res.data?.id || res.data?.projectId || selectedTemplate.id;
      setCreatedProjectId(newProjId);
      window.dispatchEvent(new CustomEvent('pv:refresh', { detail: { type: 'project-selected' } }));
      setShowIntakeWizard(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to select project');
      setSelecting(false);
    }
  };

  const fetchAllocations = async () => {
    if (!selectedTemplate || !extractedPlan) return;
    setAllocating(true);
    try {
      const res = await api.post('/projects/catalog/allocate-team', {
        templateId: selectedTemplate.id,
        teamMemberIds: teamMembers,
        extracted: extractedPlan,
      });
      setAllocations(res.data.allocations || []);
    } catch (err) {
      console.error('Failed to fetch role allocations', err);
    } finally {
      setAllocating(false);
    }
  };

  const handleOptionClick = (opt: Option) => {
    if (phase === 'projectCategory') return handleProjectCategorySelect(opt);
    if (phase === 'category') return handleCategorySelect(opt);
    if (phase === 'domain') return handleDomainSelect(opt);
    if (phase === 'subdomain') return handleSubdomainSelect(opt);
    if (phase === 'problemList') return handlePostPickOption(opt.value);
    if (phase === 'proposeConfirm') return handleProposeConfirmOption(opt.value);
  };

  const handleSend = () => {
    if (phase === 'proposeInput') return submitProposal();
    if (phase === 'mentor') return sendMentorMessage();
  };

  // Determine active stage number (1..4) for progress bar
  const currentStageIndex = useMemo(() => {
    if (['projectCategory', 'category', 'domain', 'subdomain'].includes(phase)) return 1;
    if (['problemList', 'proposeInput', 'proposeConfirm'].includes(phase)) return 2;
    if (phase === 'mentor') return 3;
    return 4; // report / team setup
  }, [phase]);

  return (
    <div className="max-w-6xl mx-auto my-8 p-6 space-y-6">
      {/* Stage Progress Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0">
            {currentStageIndex}/4
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Project Selection Journey</h2>
            <p className="text-xs text-gray-500">Guided engineering stage flow</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          <div className={`px-3 py-1.5 rounded-full border transition-all ${currentStageIndex >= 1 ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
            1. Category & Domain
          </div>
          <span className="text-gray-300">→</span>
          <div className={`px-3 py-1.5 rounded-full border transition-all ${currentStageIndex >= 2 ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
            2. Problem Selection
          </div>
          <span className="text-gray-300">→</span>
          <div className={`px-3 py-1.5 rounded-full border transition-all ${currentStageIndex >= 3 ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
            3. AI Mentor Discussion
          </div>
          <span className="text-gray-300">→</span>
          <div className={`px-3 py-1.5 rounded-full border transition-all ${currentStageIndex >= 4 ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
            4. Team Setup
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Find Your Project
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Chat through category, domain and subdomain to land on a problem statement.
          </p>
        </div>
        {backStack.length > 0 && (
          <button
            onClick={handleGlobalBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 ${ (phase === 'mentor' || phase === 'report') ? 'lg:grid-cols-[1fr_340px]' : '' } gap-6 items-start`}>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-[65vh]">
          {/* Compact mobile readiness bar during mentor phase */}
          {phase === 'mentor' && (
            <div className="lg:hidden p-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 mr-3">
                <span className="text-xs font-bold text-gray-700">Readiness</span>
                <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, readinessScore))}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-primary">{readinessScore}%</span>
              </div>
              <button
                onClick={requestReport}
                disabled={busy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition disabled:opacity-50 shrink-0"
              >
                Report
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`flex items-start gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === 'user' ? 'bg-primary text-white' : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-primary text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.options && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {m.options.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleOptionClick(opt)}
                            disabled={busy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition disabled:opacity-50"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {phase === 'problemList' && problems.length > 0 && !selectedTemplate && (
              <div className="space-y-3">
                {problems.map((ps) => {
                  const isFull = (ps._count?.childProjects || 0) >= 4;
                  return (
                    <button
                      key={ps.id}
                      disabled={isFull || busy}
                      onClick={() => handleProblemPick(ps)}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        isFull
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase tracking-wide">
                          {ps.problemId}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                          Difficulty {ps.difficultyLevel}
                        </span>
                      </div>
                      <div className="font-semibold text-gray-900 text-sm mb-1">{ps.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-2">{ps.problemStatement}</div>
                    </button>
                  );
                })}
                <button
                  onClick={() =>
                    handlePostPickOption('propose')
                  }
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline underline-offset-4"
                >
                  None of these — propose a new problem statement
                </button>
              </div>
            )}

            {phase === 'report' && readyToSelect && (
              <div className="pt-2">
                <button
                  onClick={handleFinalSelect}
                  className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-primary/90"
                >
                  <CheckCircle className="w-4.5 h-4.5" /> Select This Project
                </button>
              </div>
            )}

            {busy && <div className="text-xs text-gray-400 pl-9">Thinking…</div>}
          </div>

          {(phase === 'proposeInput' || phase === 'mentor') && (
            <div className="border-t border-gray-100 p-4 flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busy) {
                    if (phase === 'proposeInput') {
                      setProposalDraft(inputValue);
                      submitProposal();
                    } else {
                      handleSend();
                    }
                  }
                }}
                disabled={!inputEnabled || busy}
                placeholder={
                  phase === 'proposeInput'
                    ? 'Describe your problem statement idea...'
                    : 'Tell your mentor about your plan...'
                }
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 text-sm disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (phase === 'proposeInput') {
                    setProposalDraft(inputValue);
                    submitProposal();
                  } else {
                    handleSend();
                  }
                }}
                disabled={!inputEnabled || busy || !inputValue.trim()}
                className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Side Panel for Discussion Readiness */}
        {(phase === 'mentor' || phase === 'report') && (
          <aside className="hidden lg:block sticky top-6 bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Discussion Readiness
              </span>
              <span className="text-sm font-extrabold text-primary">{readinessScore}%</span>
            </div>

            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, readinessScore))}%` }}
              />
            </div>

            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Required Topics
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CHECKLIST_DIMENSIONS.map((d) => (
                  <span
                    key={d.id}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      checklist[d.id]
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-400'
                    }`}
                  >
                    {checklist[d.id] ? '✓ ' : ''}
                    {d.label}
                  </span>
                ))}
              </div>
            </div>

            {phase === 'mentor' && (
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={requestReport}
                  disabled={busy}
                  className="w-full text-xs font-bold px-4 py-2.5 rounded-xl border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition shadow-2xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Generate Readiness Report
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Setup Your Team</h2>
              <button
                onClick={() => {
                  setShowTeamModal(false);
                  setTeamMembers([]);
                  setRepoLink('');
                  setAllocations(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <p className="text-gray-500 mb-6">
                You will automatically be assigned as the Team Leader. Build your team below before
                finalizing your project selection.
              </p>
              <TeamMemberSelect
                selectedIds={teamMembers}
                onChange={(ids) => {
                  setTeamMembers(ids);
                  setAllocations(null);
                }}
              />

              <div className="mt-6">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  GitHub Repository Link (optional)
                </label>
                <input
                  type="url"
                  value={repoLink}
                  onChange={(e) => setRepoLink(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm"
                />
              </div>

              {extractedPlan && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-700">
                      Suggested role allocation (based on skills)
                    </label>
                    <button
                      type="button"
                      onClick={fetchAllocations}
                      disabled={allocating || teamMembers.length === 0}
                      className="text-xs font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {allocating ? 'Thinking…' : allocations ? 'Regenerate' : 'Suggest allocation'}
                    </button>
                  </div>
                  {teamMembers.length === 0 && (
                    <p className="text-xs text-gray-400">Add team members above to get suggestions.</p>
                  )}
                  {allocations && (
                    <div className="space-y-2">
                      {allocations.map((a) => (
                        <div key={a.userId} className="p-3 rounded-xl border border-gray-200 bg-gray-50/60">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-gray-900">{a.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                              {a.suggestedRole}
                            </span>
                          </div>
                          {a.matchedSkills.length > 0 && (
                            <div className="text-xs text-gray-500 mb-1">
                              Skills: {a.matchedSkills.join(', ')}
                            </div>
                          )}
                          {a.suggestedTasks.length > 0 && (
                            <ul className="text-xs text-gray-600 list-disc list-inside">
                              {a.suggestedTasks.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTeamModal(false);
                  setTeamMembers([]);
                  setRepoLink('');
                  setAllocations(null);
                }}
                className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSelection}
                disabled={selecting}
                className="px-8 py-2.5 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 hover:shadow-md transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {selecting ? (
                  'Selecting...'
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" /> Confirm Selection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIntakeWizard && createdProjectId && (
        <IntakeWizard
          projectId={createdProjectId}
          category={projectCategory}
          onComplete={() => {
            setShowIntakeWizard(false);
            navigate(`/projects/${createdProjectId}`);
          }}
          onClose={() => {
            setShowIntakeWizard(false);
            navigate(`/projects/${createdProjectId}`);
          }}
        />
      )}
    </div>
  );
};
