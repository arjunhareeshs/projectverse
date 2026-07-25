import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAppSelector } from '../app/hooks';
import { Sparkles, Send, CheckCircle, X, ArrowLeft, Bot, User as UserIcon } from 'lucide-react';
import { TeamMemberSelect } from '../components/projects/TeamMemberSelect';

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

let msgCounter = 0;
const nextId = () => `m${++msgCounter}`;

export const ProjectSelectionChat: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<Phase>('category');
  const [backStack, setBackStack] = useState<Phase[]>([]);
  const [tree, setTree] = useState<CatalogTreeNode[]>([]);

  const [category, setCategory] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProblemStatement | null>(null);

  const [proposalDraft, setProposalDraft] = useState('');
  const [proposalResult, setProposalResult] = useState<any>(null);

  const [mentorHistory, setMentorHistory] = useState<LlmChatMessage[]>([]);
  const [readyToSelect, setReadyToSelect] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [inputEnabled, setInputEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [repoLink, setRepoLink] = useState('');
  const [selecting, setSelecting] = useState(false);

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

  // Kick things off with the hardcoded, static greeting — not an LLM call.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/projects/catalog/tree');
        setTree(res.data.tree || []);
      } catch (err) {
        console.error('Failed to load catalog tree', err);
      }
      addBotMessage(
        "Hi! You're here to select a new project. What kind of project would you like to explore?",
        [
          { label: 'Hardware', value: 'Hardware' },
          { label: 'Software', value: 'Software' },
          { label: 'Hardware & Software', value: 'Hardware & Software' },
        ],
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushBack = (from: Phase) => setBackStack((prev) => [...prev, from]);

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
      addBotMessage(
        `Nice pick! Difficulty: ${ps.difficultyLevel ?? 'N/A'}. ${reply}`,
      );
    } catch (err) {
      console.error('Mentor start failed', err);
      addBotMessage(
        "Let's talk through your plan. What's your main approach to implementing this?",
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePostPickOption = (value: string) => {
    if (value === 'accept' && selectedTemplate) {
      addUserMessage("Yes, let's discuss it");
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
    if (target === 'domain') {
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
        "Let's start over. What kind of project would you like to explore?",
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
      });
      const reply = res.data.reply as string;
      setMentorHistory([...newHistory, { role: 'assistant', content: reply }]);
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
      setReadyToSelect(true);
      setPhase('report');
      addBotMessage(res.data.report);
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
      await api.post(`/projects/catalog/${selectedTemplate.id}/select`, {
        teamMembers,
        repoLink: repoLink.trim() || undefined,
      });
      alert('Project selected successfully and is pending approval.');
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to select project');
      setSelecting(false);
    }
  };

  const handleOptionClick = (opt: Option) => {
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

  return (
    <div className="max-w-3xl mx-auto my-8 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Find Your Project
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Chat through category, domain and subdomain to land on a problem statement.
          </p>
        </div>
        {backStack.length > 0 && phase !== 'mentor' && phase !== 'report' && (
          <button
            onClick={handleGlobalBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-[65vh]">
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

          {phase === 'problemList' && problems.length > 0 && (
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

          {phase === 'mentor' && (
            <div className="pt-2">
              <button
                onClick={requestReport}
                disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition disabled:opacity-50"
              >
                I'm ready — generate readiness report
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
              <TeamMemberSelect selectedIds={teamMembers} onChange={setTeamMembers} />

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
            </div>

            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTeamModal(false);
                  setTeamMembers([]);
                  setRepoLink('');
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
    </div>
  );
};
