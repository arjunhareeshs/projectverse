import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Award,
  Users,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Download,
  Share2,
  Save,
  ArrowLeft,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
  Check,
  Zap,
  BookOpen,
  Calendar,
  ShieldAlert,
  Search,
  UserPlus,
  LogOut,
} from 'lucide-react';
import {
  ExecutionDocContent,
  FeatureAllocationItem,
  TeamShareAllocationItem,
  ProjectLogState,
  ProjectPhaseItem,
} from '../../types/projectLog';
import { lifecycleService } from '../../services/lifecycle.service';
import { teamService } from '../../services/team.service';
import { useAppSelector } from '../../app/hooks';
import { WithdrawProjectModal } from './WithdrawProjectModal';


interface ProjectExecutionTemplateProps {
  projectId: string;
  logState?: ProjectLogState | null;
  initialDoc?: ExecutionDocContent | null;
  initialTab?: 'team-features' | 'execution-plan';
  hideHeader?: boolean;
  hideTabs?: boolean;
  onBack?: () => void;
  onSaved?: () => void;
}


const DEFAULT_MEMBERS: TeamShareAllocationItem[] = [
  { userId: 'u-1', name: 'Project Selector (Lead)', role: 'Project Selector / Lead', sharePercent: 100, rewardPoints: 500, isLead: true },
];

export const ProjectExecutionTemplate: React.FC<ProjectExecutionTemplateProps> = ({
  projectId,
  logState,
  initialDoc,
  initialTab,
  hideHeader = false,
  hideTabs = false,
  onBack,
  onSaved,
}) => {
  // Main Tab Navigation State
  const [activeMainTab, setActiveMainTab] = useState<'team-features' | 'execution-plan'>(
    initialTab || 'team-features'
  );

  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab);
    }
  }, [initialTab]);


  const user = useAppSelector((s) => s.auth.user);
  const isReviewer = (user?.role as string) === 'ADMIN' || (user?.role as string) === 'FACULTY';
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);


  // Execution Phases — server-generated (exactly 4), fetched live. Points and
  // deliverables are AI-drafted (ideaIntelligence.service.generatePhasePlan)
  // but editable while a phase is still PLANNED (before it's been submitted or
  // reviewed) via editingPhaseId/phaseEditDraft below.
  const [phases, setPhases] = useState<ProjectPhaseItem[]>([]);
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [phaseEditDraft, setPhaseEditDraft] = useState<{
    title: string;
    expectedDeliverables: string;
    weekTarget: string;
    points: string;
  }>({ title: '', expectedDeliverables: '', weekTarget: '', points: '' });
  const [savingPhaseEdit, setSavingPhaseEdit] = useState(false);

  const loadPhases = async () => {
    setPhasesLoading(true);
    try {
      const res = await lifecycleService.getPhases(projectId);
      setPhases(res.phases);
    } catch (err) {
      console.error('Failed to load phases:', err);
    } finally {
      setPhasesLoading(false);
    }
  };

  const handleStartEditPhase = (phase: ProjectPhaseItem) => {
    setEditingPhaseId(phase.id);
    setPhaseEditDraft({
      title: phase.title,
      expectedDeliverables: phase.expectedDeliverables,
      weekTarget: String(phase.weekTarget),
      points: String(phase.points),
    });
  };

  const handleCancelEditPhase = () => {
    setEditingPhaseId(null);
  };

  const handleSavePhaseEdit = async (phaseId: string) => {
    setSavingPhaseEdit(true);
    try {
      const res = await lifecycleService.updatePhase(projectId, phaseId, {
        title: phaseEditDraft.title.trim(),
        expectedDeliverables: phaseEditDraft.expectedDeliverables.trim(),
        weekTarget: parseInt(phaseEditDraft.weekTarget, 10) || 1,
        points: parseInt(phaseEditDraft.points, 10) || 0,
      });
      setPhases((prev) => prev.map((p) => (p.id === phaseId ? res.phase : p)));
      setEditingPhaseId(null);
      setNotification({ type: 'success', message: `Phase ${res.phase.phaseNumber} updated.` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to update phase.' });
    } finally {
      setSavingPhaseEdit(false);
    }
  };

  // Phase submission (student) & review (ADMIN/FACULTY) state
  const [submitModalPhaseId, setSubmitModalPhaseId] = useState<string | null>(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [evidenceUrlsText, setEvidenceUrlsText] = useState('');
  const [submittingPhase, setSubmittingPhase] = useState<string | null>(null);
  const [reviewingPhase, setReviewingPhase] = useState<string | null>(null);
  const [reviewNoteDraft, setReviewNoteDraft] = useState<Record<string, string>>({});

  const handleSubmitPhase = async () => {
    if (!submitModalPhaseId || !submissionNote.trim()) return;
    setSubmittingPhase(submitModalPhaseId);
    try {
      const evidenceUrls = evidenceUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      await lifecycleService.submitPhase(projectId, submitModalPhaseId, { submissionNote, evidenceUrls });
      setNotification({ type: 'success', message: 'Phase submitted for faculty review.' });
      setSubmitModalPhaseId(null);
      setSubmissionNote('');
      setEvidenceUrlsText('');
      await loadPhases();
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to submit phase.' });
    } finally {
      setSubmittingPhase(null);
    }
  };

  const handleReviewPhase = async (phaseId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    setReviewingPhase(phaseId);
    try {
      const res = await lifecycleService.reviewPhase(projectId, phaseId, {
        decision,
        reviewNote: reviewNoteDraft[phaseId] || '',
      });
      setNotification({
        type: 'success',
        message:
          decision === 'APPROVED'
            ? `Phase approved — reward points credited to the team.`
            : 'Changes requested — the team has been notified.',
      });
      await loadPhases();
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to submit review.' });
    } finally {
      setReviewingPhase(null);
    }
  };

  // Document State
  const [docContent, setDocContent] = useState<ExecutionDocContent | null>(initialDoc || null);

  // Editable Header Info
  const [projectName, setProjectName] = useState<string>('');
  const [domain, setDomain] = useState<string>('Smart Cities');
  const [subdomain, setSubdomain] = useState<string>('Waste Management');
  const [proposedDate, setProposedDate] = useState<string>('Jul 31, 2025');

  // Editable Allocation State — features are fetched live (AI-extracted + scored
  // server-side); this UI never assigns points itself.
  const [features, setFeatures] = useState<FeatureAllocationItem[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [teamShare, setTeamShare] = useState<TeamShareAllocationItem[]>(DEFAULT_MEMBERS);

  const loadFeatures = async () => {
    setFeaturesLoading(true);
    try {
      const res = await lifecycleService.getFeatures(projectId);
      setFeatures(res.features);
      setInitialFeaturePoints(res.totalPoints || 1000);
    } catch (err) {
      console.error('Failed to load features:', err);
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    loadFeatures();
    loadPhases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Feature reduction warning tracking
  const [initialFeaturePoints, setInitialFeaturePoints] = useState<number>(1000);
  const [featureWarning, setFeatureWarning] = useState<string | null>(null);

  // Editable Document Sections
  const [overview, setOverview] = useState({
    problemStatement:
      'Improper waste segregation and collection lead to environmental hazards and inefficient resource utilization in cities.',
    objectives: [
      'Build an AI model to classify waste types.',
      'Monitor bin levels in real-time.',
      'Optimize collection routes.',
      'Provide analytics for decision making.',
    ],
    expectedOutcome:
      'An intelligent system that improves waste management efficiency, reduces collection cost and promotes a cleaner environment.',
    targetUsers: 'Municipal authorities, waste collection drivers, city residents.',
    deliverables: [
      'Web Dashboard for Waste Management',
      'AI Waste Classification Model',
      'Route Optimization Module',
      'Real-time IoT Telemetry Endpoint',
    ],
  });

  // Timeline / Milestones State
  const [milestones, setMilestones] = useState<
    Array<{ id: string; name: string; expectedOutput: string; completionWeek: number; rewardPoints: number }>
  >([
    {
      id: 'm-1',
      name: 'Milestone 1: Requirement Scoping & Architecture Design',
      expectedOutput: 'System architecture diagram, SRS document, API schemas',
      completionWeek: 2,
      rewardPoints: 350,
    },
    {
      id: 'm-2',
      name: 'Milestone 2: Core Module Implementation & AI Model Training',
      expectedOutput: 'Trained classification model & telemetry endpoints',
      completionWeek: 6,
      rewardPoints: 750,
    },
    {
      id: 'm-3',
      name: 'Milestone 3: System Integration & Final Evaluation',
      expectedOutput: 'Full system deployment, user dashboard, testing report',
      completionWeek: 10,
      rewardPoints: 750,
    },
  ]);

  // Tab state inside Execution Document card
  const [activeExecTab, setActiveExecTab] = useState<
    'overview' | 'objectives' | 'tech' | 'milestones' | 'risks' | 'resources'
  >('overview');

  // Editing Modals / Inline Edit
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false);
  const [savingFeature, setSavingFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({
    name: '',
    description: '',
    implementationMethod: '',
  });

  // Member Search State (Search by RegNo / Name)
  const [showMemberSearchModal, setShowMemberSearchModal] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<Array<{ id: string; fullName: string; email: string; regNo?: string; teamId?: string }>>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  const handleSearchCandidates = async (query: string) => {
    setCandidateQuery(query);
    if (!query || query.trim().length < 2) {
      setCandidates([]);
      return;
    }
    setSearchingCandidates(true);
    try {
      const res = await teamService.searchCandidates(query.trim());
      setCandidates(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Candidate search error:', err);
    } finally {
      setSearchingCandidates(false);
    }
  };

  const handleAddCandidate = (cand: { id: string; fullName: string; regNo?: string }) => {
    if (teamShare.some((m) => m.userId === cand.id)) {
      setNotification({ type: 'error', message: 'Member already in share allocation!' });
      return;
    }
    const newCount = teamShare.length + 1;
    const equalShare = Math.floor(100 / newCount);

    const newMember: TeamShareAllocationItem = {
      userId: cand.id,
      name: cand.fullName + (cand.regNo ? ` (${cand.regNo})` : ''),
      role: 'Developer',
      sharePercent: equalShare,
      rewardPoints: Math.round(teamRewardCapacity * (equalShare / 100)),
    };

    const updated = [...teamShare, newMember].map((m, idx, arr) => ({
      ...m,
      sharePercent: idx === arr.length - 1 ? 100 - equalShare * idx : equalShare,
      rewardPoints: Math.round(teamRewardCapacity * ((idx === arr.length - 1 ? 100 - equalShare * idx : equalShare) / 100)),
    }));

    setTeamShare(updated);
    setShowMemberSearchModal(false);
    setCandidateQuery('');
    setCandidates([]);
  };

  // Available group members from logState that are not yet added
  const availableGroupMembers = useMemo(() => {
    if (!logState?.team?.members) return [];
    return logState.team.members.filter(
      (m) => !teamShare.some((ts) => ts.userId === m.userId)
    );
  }, [logState?.team?.members, teamShare]);

  const handleAddAvailableMember = (member: { userId: string; name?: string }) => {
    if (teamShare.some((m) => m.userId === member.userId)) return;
    const newCount = teamShare.length + 1;
    const equalShare = Math.floor(100 / newCount);

    const newMember: TeamShareAllocationItem = {
      userId: member.userId,
      name: member.name || 'Teammate',
      role: 'Developer',
      sharePercent: equalShare,
      rewardPoints: Math.round(teamRewardCapacity * (equalShare / 100)),
    };

    const updated = [...teamShare, newMember].map((m, idx, arr) => ({
      ...m,
      sharePercent: idx === arr.length - 1 ? 100 - equalShare * idx : equalShare,
      rewardPoints: Math.round(teamRewardCapacity * ((idx === arr.length - 1 ? 100 - equalShare * idx : equalShare) / 100)),
    }));

    setTeamShare(updated);
  };

  // UI state
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize from props / logState / initialDoc
  useEffect(() => {
    if (logState) {
      if (logState.title) setProjectName(logState.title);
      if (logState.department) setDomain(logState.department);
      if (!initialDoc?.teamShare && logState.team?.members && logState.team.members.length > 0) {
        // At starting: Only assign the Project Selector / Team Lead (him or her)
        const selector = logState.team.members[0];
        setTeamShare([
          {
            userId: selector.userId || 'u-lead',
            name: selector.name || 'Project Selector',
            role: 'Project Selector / Lead',
            sharePercent: 100,
            rewardPoints: teamRewardCapacity,
            isLead: true,
          },
        ]);
      }
    }

    if (initialDoc) {
      setDocContent(initialDoc);
      if (initialDoc.features && initialDoc.features.length > 0) {
        setFeatures(initialDoc.features);
      }
      if (initialDoc.teamShare && initialDoc.teamShare.length > 0) {
        setTeamShare(initialDoc.teamShare);
      }
      if (initialDoc.overview) {
        setOverview((prev) => ({
          ...prev,
          problemStatement: initialDoc.overview.problemStatement || prev.problemStatement,
          expectedOutcome: initialDoc.overview.expectedOutcome || prev.expectedOutcome,
        }));
      }
      if (initialDoc.objectives && initialDoc.objectives.length > 0) {
        setOverview((prev) => ({ ...prev, objectives: initialDoc.objectives }));
      }
      if (initialDoc.deliverables && initialDoc.deliverables.length > 0) {
        setOverview((prev) => ({ ...prev, deliverables: initialDoc.deliverables }));
      }
      if (initialDoc.milestones && initialDoc.milestones.length > 0) {
        setMilestones(
          initialDoc.milestones.map((m, i) => ({
            id: `m-${i + 1}`,
            name: m.name,
            expectedOutput: m.expectedOutput,
            completionWeek: m.completionWeek,
            rewardPoints: m.rewardPoints || 500,
          }))
        );
      }
    }
  }, [logState, initialDoc]);

  // --- Dynamic Live Calculations ---
  const totalFeaturePoints = useMemo(() => {
    return features.reduce((sum, f) => sum + (f.points || 0), 0);
  }, [features]);

  // Max team reward points capacity based on team size (up to 1,000 pts)
  const teamRewardCapacity = useMemo(() => {
    const memberCount = teamShare.length;
    if (memberCount <= 1) return 500;
    if (memberCount === 2) return 650;
    if (memberCount === 3) return 750;
    if (memberCount === 4) return 800;
    return 850; // 5+ members
  }, [teamShare.length]);

  const totalSharePercent = useMemo(() => {
    return teamShare.reduce((sum, m) => sum + (m.sharePercent || 0), 0);
  }, [teamShare]);

  const totalTeamRewardPoints = useMemo(() => {
    return Math.round(teamRewardCapacity * (totalSharePercent / 100));
  }, [teamRewardCapacity, totalSharePercent]);

  const totalProjectRewardPoints = useMemo(() => {
    return totalFeaturePoints + totalTeamRewardPoints;
  }, [totalFeaturePoints, totalTeamRewardPoints]);

  // Track feature point decrease warning
  useEffect(() => {
    if (totalFeaturePoints < initialFeaturePoints) {
      setFeatureWarning(
        `Total feature reward decreased to ${totalFeaturePoints} pts because features were removed or edited.`
      );
    } else {
      setFeatureWarning(null);
    }
  }, [totalFeaturePoints, initialFeaturePoints]);

  // Automatically recalculate member reward points when sharePercent or team capacity changes
  useEffect(() => {
    setTeamShare((prev) =>
      prev.map((m) => ({
        ...m,
        rewardPoints: Math.round(teamRewardCapacity * ((m.sharePercent || 0) / 100)),
      }))
    );
  }, [teamRewardCapacity]);

  // Feature Operations — points/importance are always AI-scored server-side
  // (rescoreFeature re-runs the LLM against the stored problem statement every
  // time a feature is added or edited); the client only supplies the raw inputs.
  const handleAddFeature = async () => {
    if (!newFeature.name.trim() || !newFeature.description.trim() || !newFeature.implementationMethod.trim()) return;
    setSavingFeature(true);
    try {
      if (editingFeatureId) {
        const res = await lifecycleService.updateFeature(projectId, editingFeatureId, {
          name: newFeature.name.trim(),
          description: newFeature.description.trim(),
          implementationMethod: newFeature.implementationMethod.trim(),
        });
        setFeatures((prev) => prev.map((f) => (f.id === editingFeatureId ? res.feature : f)));
        setNotification({
          type: 'success',
          message: res.budgetClamped
            ? `Feature updated — points capped to fit the remaining 1,000-pt budget (${res.feature.points} pts).`
            : `Feature re-scored by AI: ${res.feature.points} pts.`,
        });
      } else {
        const res = await lifecycleService.addFeature(projectId, {
          name: newFeature.name.trim(),
          description: newFeature.description.trim(),
          implementationMethod: newFeature.implementationMethod.trim(),
        });
        setFeatures((prev) => [...prev, res.feature]);
        setNotification({
          type: 'success',
          message: res.budgetClamped
            ? `Feature added — points capped to fit the remaining 1,000-pt budget (${res.feature.points} pts).`
            : `Feature added — AI scored it at ${res.feature.points} pts.`,
        });
      }
      setNewFeature({ name: '', description: '', implementationMethod: '' });
      setEditingFeatureId(null);
      setShowAddFeatureModal(false);
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to save feature.' });
    } finally {
      setSavingFeature(false);
    }
  };

  const handleEditFeature = (feature: FeatureAllocationItem) => {
    setEditingFeatureId(feature.id);
    setNewFeature({
      name: feature.name,
      description: feature.description,
      implementationMethod: feature.implementationMethod || '',
    });
    setShowAddFeatureModal(true);
  };

  const handleDeleteFeature = async (id: string) => {
    const previous = features;
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    try {
      await lifecycleService.removeFeature(projectId, id);
    } catch (err: any) {
      setFeatures(previous);
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to remove feature.' });
    }
  };

  const handleUpdateMemberShare = (userId: string, newShare: number) => {
    setTeamShare((prev) =>
      prev.map((m) => {
        if (m.userId === userId) {
          const clamped = Math.max(0, Math.min(100, newShare));
          const pts = Math.round(teamRewardCapacity * (clamped / 100));
          return { ...m, sharePercent: clamped, rewardPoints: pts };
        }
        return m;
      })
    );
  };

  const handleUpdateMemberRole = (userId: string, newRole: string) => {
    setTeamShare((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
    );
  };

  // Save Document to Backend
  const handleSaveDoc = async () => {
    setSaving(true);
    setNotification(null);

    try {
      const payload: ExecutionDocContent = {
        overview: {
          background: 'Project execution plan approved and locked for project lifecycle.',
          purpose: 'Official baseline document for feature reward points, team shares, and milestones.',
          problemStatement: overview.problemStatement,
          scope: 'Entire project scope defined by team proposal & intake setup.',
          expectedOutcome: overview.expectedOutcome,
        },
        objectives: overview.objectives,
        deliverables: overview.deliverables,
        workBreakdown: features.map((f, i) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          percentage: Math.round(100 / features.length),
        })),
        skillsRequired: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AI/ML'],
        milestones: milestones.map((m) => ({
          name: m.name,
          expectedOutput: m.expectedOutput,
          completionWeek: m.completionWeek,
          rewardPoints: m.rewardPoints,
        })),
        risks: [
          'Feature delivery delay due to unaligned dependency API.',
          'Model convergence risk under high concurrency dataset.',
        ],
        learningResources: [
          { topic: 'System Architecture', resource: 'ProjectVerse Execution Docs & Guidelines' },
        ],
        successCriteria: [
          'All high-priority features delivered with verified test suites.',
          'Total project reward threshold achieved in 15-day evaluation cycles.',
        ],
        // Reward system custom fields
        features,
        teamShare,
        targetUsers: overview.targetUsers,
      };

      await lifecycleService.saveDocument(projectId, payload);
      setNotification({ type: 'success', message: 'Execution document and allocations saved successfully!' });
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error('Failed to save execution document:', err);
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to save document changes.' });
    } finally {
      setSaving(false);
    }
  };

  // Export PDF Handler
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await lifecycleService.downloadDocument(projectId, 'pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // Share Handler
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setNotification({ type: 'success', message: 'Page link copied to clipboard!' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* ---------------------------------------------------------------- Action Bar (Export/Save) */}
      {!hideHeader ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="space-y-1">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-indigo-600 transition mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
            </button>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
              Project Execution & Reward Template
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              All details below are editable. Changes will update allocations and reports automatically.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl hover:bg-rose-100 transition shadow-2xs"
              title="Withdraw from project"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" /> Withdraw Project
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition shadow-2xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <button
              onClick={handleSaveDoc}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-2">
          <p className="text-xs text-gray-500 font-medium">
            Editable project execution details, features, and phase milestones.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition shadow-2xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={handleSaveDoc}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- TOP TAB NAVIGATION: TEAM & FEATURES vs EXECUTION PLAN */}
      {!hideTabs && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-2 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveMainTab('team-features')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
              activeMainTab === 'team-features'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1. Team & Features Allocation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('execution-plan')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
              activeMainTab === 'execution-plan'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. Phase-by-Phase Execution Plan & Reviews</span>
          </button>
        </div>
      )}


      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------- TOP SECTION: HEADER CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Project Header Details */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                  {domain}
                </span>
                <input
                  type="text"
                  value={projectName || 'Smart Waste Management System'}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-xl font-bold text-gray-900 block w-full mt-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition px-0"
                  placeholder="Enter project name..."
                />
                <p className="text-xs text-gray-500 mt-0.5">
                  AI-powered waste segregation and monitoring system for smart cities with real-time analytics and route optimization.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
              Proposed
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 font-medium block text-[11px]">Domain</span>
              <span className="font-bold text-gray-900">{domain}</span>
            </div>
            <div>
              <span className="text-gray-400 font-medium block text-[11px]">Subdomain</span>
              <span className="font-bold text-gray-900">{subdomain}</span>
            </div>
            <div>
              <span className="text-gray-400 font-medium block text-[11px]">Proposed On</span>
              <span className="font-bold text-gray-900">{proposedDate}</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Total Project Reward Card */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
              <Award className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 uppercase tracking-wider">
              Total Score
            </span>
          </div>

          <div className="my-3">
            <span className="text-[11px] font-bold text-amber-900/80 block uppercase tracking-wider">
              Total Project Reward
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-extrabold text-gray-900 tracking-tight">
                {totalProjectRewardPoints.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-gray-500">/ 2,000</span>
            </div>
            <span className="text-[11px] text-gray-500 font-medium block mt-0.5">Total Reward Points</span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-100/50 border border-amber-200/60 text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 shrink-0 text-amber-700" />
            <span>Auto-calculated based on features & team allocation</span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- TAB 1: TEAM & FEATURES ALLOCATION */}
      {activeMainTab === 'team-features' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT COLUMN: FEATURES & REWARD ALLOCATION */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                      Features & Reward Allocation <Info className="w-4 h-4 text-gray-400" />
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Minimum 5 features required • Points auto-adjust based on count
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-indigo-600 block">
                      {totalFeaturePoints.toLocaleString()} pts
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Max 1,000 pts</span>
                  </div>
                </div>

                {/* Warning when points decrease */}
                {featureWarning && (
                  <div className="my-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{featureWarning}</span>
                  </div>
                )}

                {/* Features Table */}
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto mt-4 border border-gray-200 rounded-xl scrollbar-thin">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3 w-8">#</th>
                        <th className="py-2.5 px-3">Feature</th>
                        <th className="py-2.5 px-3">Importance</th>
                        <th className="py-2.5 px-3 text-right">Reward / Feature</th>
                        <th className="py-2.5 px-3 text-center w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {features.map((feat, idx) => (
                        <tr key={feat.id} className="hover:bg-gray-50/50 transition">
                          <td className="py-3 px-3 font-bold text-gray-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-gray-900 block">{feat.name}</span>
                            <span className="text-[11px] text-gray-500 line-clamp-1">{feat.description}</span>
                            {feat.aiRationale && (
                              <span className="text-[10px] text-indigo-500 line-clamp-1 block mt-0.5" title={feat.aiRationale}>
                                AI: {feat.aiRationale}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                feat.importance === 'High'
                                  ? 'bg-rose-100 text-rose-800'
                                  : feat.importance === 'Medium'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              ● {feat.importance}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-gray-900">
                            {feat.points} pts
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditFeature(feat)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                                title="Edit Feature"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFeature(feat.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title="Delete Feature"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!featuresLoading && features.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-gray-400 text-xs">
                            No features yet — add one below.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-50 z-10">
                      <tr className="border-t border-gray-200 font-bold text-xs">
                        <td colSpan={3} className="py-2.5 px-3 text-gray-900">
                          Total Feature Reward
                        </td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 font-extrabold">
                          {totalFeaturePoints} pts
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <button
                  onClick={() => {
                    setEditingFeatureId(null);
                    setNewFeature({ name: '', description: '', implementationMethod: '' });
                    setShowAddFeatureModal(true);
                  }}
                  className="mt-3 w-full py-2 bg-indigo-50/60 border border-dashed border-indigo-200 hover:bg-indigo-100/60 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Feature
                </button>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-900 flex items-center gap-2 font-medium">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>If features are reduced, total reward points for features will decrease automatically.</span>
              </div>
            </div>

            {/* RIGHT COLUMN: TEAM MEMBERS & SHARE ALLOCATION */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                      Team Members & Share Allocation <Info className="w-4 h-4 text-gray-400" />
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Project Selector assigned at start • Add teammates as needed
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-indigo-600 block">
                      {totalTeamRewardPoints.toLocaleString()} pts
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">
                      Cap: {teamRewardCapacity} pts
                    </span>
                  </div>
                </div>

                {/* Team Table */}
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto mt-4 border border-gray-200 rounded-xl scrollbar-thin">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3 w-8">#</th>
                        <th className="py-2.5 px-3">Member</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3 text-center">Share (%)</th>
                        <th className="py-2.5 px-3 text-right">Reward Points</th>
                        <th className="py-2.5 px-3 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {teamShare.map((m, idx) => {
                        const initials = m.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <tr key={m.userId} className="hover:bg-gray-50/50 transition">
                            <td className="py-3 px-3 font-bold text-gray-400">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {initials}
                                </div>
                                <div>
                                  <span className="font-bold text-gray-900 block truncate max-w-[110px]">
                                    {m.name}
                                  </span>
                                  {(m.isLead || idx === 0) && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 block w-max mt-0.5">
                                      Project Selector
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={m.role}
                                onChange={(e) => handleUpdateMemberRole(m.userId, e.target.value)}
                                className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-800 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition"
                              />
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={m.sharePercent}
                                  onChange={(e) => handleUpdateMemberShare(m.userId, Number(e.target.value))}
                                  className="w-14 px-2 py-1 border border-gray-200 rounded-lg text-xs font-bold text-center text-gray-900 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none transition"
                                />
                                <span className="text-gray-400 text-xs font-bold">%</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-gray-900">
                              {m.rewardPoints} pts
                            </td>
                            <td className="py-3 px-3 text-center">
                              {teamShare.length > 1 && (
                                <button
                                  onClick={() =>
                                    setTeamShare((prev) => prev.filter((item) => item.userId !== m.userId))
                                  }
                                  className="p-1 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                  title="Remove member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-50 z-10">
                      <tr className="border-t border-gray-200 font-bold text-xs">
                        <td colSpan={3} className="py-2.5 px-3 text-gray-900">
                          Total
                        </td>
                        <td className="py-2.5 px-3 text-center text-indigo-600 font-extrabold">
                          {totalSharePercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 font-extrabold">
                          {totalTeamRewardPoints} pts
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Quick Add Available Group Teammates if present */}
                {availableGroupMembers.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">
                        Group Teammates Available ({availableGroupMembers.length}):
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Click to assign</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableGroupMembers.map((gm) => (
                        <button
                          key={gm.userId}
                          type="button"
                          onClick={() => handleAddAvailableMember(gm)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold rounded-lg transition shadow-2xs"
                        >
                          <UserPlus className="w-3 h-3 text-indigo-500" />
                          {gm.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowMemberSearchModal(true)}
                  className="mt-3 w-full py-2 bg-indigo-50/60 border border-dashed border-indigo-200 hover:bg-indigo-100/60 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Search & Add Member by RegNo / Name
                </button>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-900 flex items-center gap-2 font-medium">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>More members = More share capacity (up to 1,000 pts)</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- TAB 2: PHASE-BY-PHASE EXECUTION PLAN & REVIEWS */}
      {activeMainTab === 'execution-plan' && (
        <div className="space-y-6">
          {/* PHASE REVIEW SUMMARY CARD */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Phase-by-Phase Execution Plan & Review Rewards
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  4 mandatory review checkpoints, generated by AI from your features. Submit evidence for faculty
                  review — reward points are only credited to your team once a phase is approved.
                </p>
              </div>
              <div className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-right shrink-0">
                <span className="text-[10px] font-bold text-indigo-600 uppercase block tracking-wider">Total Review Points</span>
                <span className="text-sm font-extrabold text-indigo-900">
                  {phases.reduce((sum, p) => sum + (p.points || 0), 0).toLocaleString()} Pts
                </span>
              </div>
            </div>

            {phasesLoading && <div className="text-center text-xs text-gray-400 py-8">Loading phases...</div>}
            {!phasesLoading && phases.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-8">
                No execution phases yet — these are generated automatically when the project is created.
              </div>
            )}

            {/* PHASE REVIEW CARDS LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phases.map((phase) => {
                const latestSubmission = phase.submissions?.[0];
                const isApproved = phase.status === 'APPROVED';
                const isSubmitted = phase.status === 'SUBMITTED';
                const isChangesRequested = phase.status === 'CHANGES_REQUESTED';

                return (
                  <div
                    key={phase.id}
                    className={`p-5 rounded-2xl border transition shadow-2xs space-y-3 flex flex-col justify-between ${
                      isApproved
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : isChangesRequested
                        ? 'bg-amber-50/40 border-amber-200'
                        : 'bg-white border-gray-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            P{phase.phaseNumber}
                          </span>
                          <div className="flex-1">
                            {editingPhaseId === phase.id ? (
                              <input
                                type="text"
                                value={phaseEditDraft.title}
                                onChange={(e) => setPhaseEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                                className="w-full text-sm font-bold text-gray-900 px-2 py-1 border border-indigo-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              />
                            ) : (
                              <span className="text-sm font-bold text-gray-900 block">{phase.title}</span>
                            )}
                            <span className="text-[11px] font-semibold text-indigo-600">Week {phase.weekTarget} target</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {phase.status === 'PLANNED' && editingPhaseId !== phase.id && (
                            <button
                              type="button"
                              onClick={() => handleStartEditPhase(phase)}
                              className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="Edit phase"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800'
                                : isSubmitted
                                ? 'bg-indigo-100 text-indigo-800'
                                : isChangesRequested
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {isApproved
                              ? '✓ Approved'
                              : isSubmitted
                              ? 'Pending Review'
                              : isChangesRequested
                              ? 'Changes Requested'
                              : 'Planned'}
                          </span>
                        </div>
                      </div>

                      {editingPhaseId === phase.id ? (
                        <div className="space-y-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100">
                          <label className="text-[11px] font-bold text-gray-800 block">Expected Deliverables / Output</label>
                          <textarea
                            value={phaseEditDraft.expectedDeliverables}
                            onChange={(e) => setPhaseEditDraft((prev) => ({ ...prev, expectedDeliverables: e.target.value }))}
                            rows={3}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-gray-600 block mb-0.5">Week target</label>
                              <input
                                type="number"
                                min={1}
                                value={phaseEditDraft.weekTarget}
                                onChange={(e) => setPhaseEditDraft((prev) => ({ ...prev, weekTarget: e.target.value }))}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-gray-600 block mb-0.5">Points</label>
                              <input
                                type="number"
                                min={0}
                                value={phaseEditDraft.points}
                                onChange={(e) => setPhaseEditDraft((prev) => ({ ...prev, points: e.target.value }))}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEditPhase}
                              disabled={savingPhaseEdit}
                              className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSavePhaseEdit(phase.id)}
                              disabled={savingPhaseEdit}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {savingPhaseEdit ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                          <span className="text-[11px] font-bold text-gray-800 block">Expected Deliverables / Output:</span>
                          <p className="w-full text-xs text-gray-700">{phase.expectedDeliverables}</p>
                          {phase.hardwareNote && (
                            <p className="w-full text-[11px] text-amber-700 mt-1">⚡ {phase.hardwareNote}</p>
                          )}
                        </div>
                      )}

                      {isChangesRequested && latestSubmission?.reviewNote && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                          <span className="font-bold block mb-0.5">Reviewer feedback:</span>
                          {latestSubmission.reviewNote}
                        </div>
                      )}

                      {isReviewer && isSubmitted && latestSubmission && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-gray-700 space-y-1">
                          <span className="font-bold block">Submission note:</span>
                          <p>{latestSubmission.submissionNote}</p>
                          {!!latestSubmission.evidenceUrls?.length && (
                            <ul className="list-disc pl-4">
                              {latestSubmission.evidenceUrls.map((u, i) => (
                                <li key={i}>
                                  <a href={u} target="_blank" rel="noreferrer" className="text-indigo-600 underline break-all">
                                    {u}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600">{phase.points} pts</span>
                      </div>

                      {isReviewer ? (
                        isSubmitted ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={reviewNoteDraft[phase.id] || ''}
                              onChange={(e) => setReviewNoteDraft((prev) => ({ ...prev, [phase.id]: e.target.value }))}
                              placeholder="Review note (optional for approve, shown to team on request-changes)"
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={reviewingPhase === phase.id}
                                onClick={() => handleReviewPhase(phase.id, 'APPROVED')}
                                className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                Approve +{phase.points} pts
                              </button>
                              <button
                                type="button"
                                disabled={reviewingPhase === phase.id}
                                onClick={() => handleReviewPhase(phase.id, 'CHANGES_REQUESTED')}
                                className="flex-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                              >
                                Request Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">
                            {isApproved ? 'Already approved.' : 'Waiting on team submission.'}
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled={isApproved || isSubmitted}
                          onClick={() => setSubmitModalPhaseId(phase.id)}
                          className={`w-full px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 cursor-default'
                              : isSubmitted
                              ? 'bg-gray-100 text-gray-500 cursor-default'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          {isApproved
                            ? `Approved — +${phase.points} pts awarded`
                            : isSubmitted
                            ? 'Pending Faculty Review'
                            : isChangesRequested
                            ? 'Resubmit for Review'
                            : 'Submit for Faculty Review'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- SUBMIT PHASE MODAL */}
      {submitModalPhaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Submit Phase for Review</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Submission Note</label>
                <textarea
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  placeholder="Summarize what was completed for this phase..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Evidence Links (one per line)</label>
                <textarea
                  value={evidenceUrlsText}
                  onChange={(e) => setEvidenceUrlsText(e.target.value)}
                  placeholder="https://github.com/your-org/repo&#10;https://drive.google.com/..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setSubmitModalPhaseId(null);
                  setSubmissionNote('');
                  setEvidenceUrlsText('');
                }}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPhase}
                disabled={!submissionNote.trim() || submittingPhase === submitModalPhaseId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {submittingPhase === submitModalPhaseId ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- SUMMARY OF ALLOCATIONS & EXECUTION PLAN TAB GRID (TEAM & FEATURES ONLY) */}
      {activeMainTab === 'team-features' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Summary of Allocations Cards */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-gray-900">Summary of Allocations</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Feature Reward */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 font-medium block">Features Reward</span>
                    <span className="text-lg font-extrabold text-gray-900 block">
                      {totalFeaturePoints.toLocaleString()} pts
                    </span>
                    <span className="text-[10px] text-gray-500">Based on {features.length} features</span>
                  </div>
                </div>

                {/* Team Reward */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 font-medium block">Team Reward</span>
                    <span className="text-lg font-extrabold text-gray-900 block">
                      {totalTeamRewardPoints.toLocaleString()} pts
                    </span>
                    <span className="text-[10px] text-gray-500">Based on {teamShare.length} members</span>
                  </div>
                </div>
              </div>

              {/* Large Total Card */}
              <div className="bg-gradient-to-br from-amber-50/80 to-white border border-amber-200 rounded-2xl p-6 shadow-2xs space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-900/80 block uppercase tracking-wider">
                    Total Project Reward
                  </span>
                  <div className="flex items-baseline justify-center gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-gray-900">
                      {totalProjectRewardPoints.toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-gray-400">/ 2,000 pts</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This will be used for evaluations and milestone rewards across the project lifecycle.
                  </p>
                </div>
              </div>
            </div>

            {/* Right 2 Columns: Editable Execution Document Tab View */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    Execution Document (Editable) <Info className="w-4 h-4 text-gray-400" />
                  </h3>
                  <p className="text-xs text-gray-500">Canonical project plan baseline</p>
                </div>
                <span className="text-[11px] text-gray-400 font-semibold">Last updated: Just now</span>
              </div>

              {/* Document Nav Tabs */}
              <div className="flex border-b border-gray-100 gap-1 overflow-x-auto text-xs font-bold">
                {[
                  { id: 'overview', label: 'Project Overview' },
                  { id: 'objectives', label: 'Objectives' },
                  { id: 'tech', label: 'Tech Stack' },
                  { id: 'milestones', label: 'Milestones' },
                  { id: 'risks', label: 'Risks' },
                  { id: 'resources', label: 'Resources' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveExecTab(t.id as any)}
                    className={`px-3 py-2 border-b-2 rounded-t-lg transition whitespace-nowrap ${
                      activeExecTab === t.id
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Panes */}
              <div className="space-y-4">
                {activeExecTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100 space-y-2 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">Problem Statement</span>
                        <Edit3 className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600" />
                      </div>
                      <textarea
                        rows={2}
                        value={overview.problemStatement}
                        onChange={(e) => setOverview({ ...overview, problemStatement: e.target.value })}
                        className="w-full text-xs text-gray-700 bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 resize-none"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100 space-y-2 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900">Expected Outcome</span>
                        <Edit3 className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600" />
                      </div>
                      <textarea
                        rows={2}
                        value={overview.expectedOutcome}
                        onChange={(e) => setOverview({ ...overview, expectedOutcome: e.target.value })}
                        className="w-full text-xs text-gray-700 bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 resize-none"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100 space-y-2">
                      <span className="text-xs font-bold text-gray-900 block">Target Users</span>
                      <input
                        type="text"
                        value={overview.targetUsers}
                        onChange={(e) => setOverview({ ...overview, targetUsers: e.target.value })}
                        className="w-full text-xs text-gray-700 bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1"
                      />
                    </div>
                  </div>
                )}

                {activeExecTab === 'objectives' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-900 block">Project Core Objectives</span>
                    {overview.objectives.map((obj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <input
                          type="text"
                          value={obj}
                          onChange={(e) => {
                            const updated = [...overview.objectives];
                            updated[i] = e.target.value;
                            setOverview({ ...overview, objectives: updated });
                          }}
                          className="w-full text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {activeExecTab === 'tech' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-900 block">Technology Stack & Deliverables</span>
                    <div className="flex flex-wrap gap-2">
                      {overview.deliverables.map((deliv, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg"
                        >
                          {deliv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeExecTab === 'milestones' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">Milestone Deadlines & Outputs</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextNum = milestones.length + 1;
                          setMilestones((prev) => [
                            ...prev,
                            {
                              id: `m-${Date.now()}`,
                              name: `Milestone ${nextNum}: New Phase Milestone`,
                              expectedOutput: 'Expected deliverable output',
                              completionWeek: nextNum * 3,
                              rewardPoints: 500,
                            },
                          ]);
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        + Add Milestone
                      </button>
                    </div>

                    <div className="space-y-2">
                      {milestones.map((ms) => (
                        <div key={ms.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <input
                              type="text"
                              value={ms.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMilestones((prev) =>
                                  prev.map((item) => (item.id === ms.id ? { ...item, name: val } : item))
                                );
                              }}
                              className="bg-transparent border-0 font-bold text-gray-900 focus:ring-1 focus:ring-indigo-500 rounded p-0 text-xs"
                            />
                            <span className="text-indigo-600 font-extrabold">{ms.rewardPoints} pts</span>
                          </div>
                          <input
                            type="text"
                            value={ms.expectedOutput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMilestones((prev) =>
                                prev.map((item) => (item.id === ms.id ? { ...item, expectedOutput: val } : item))
                              );
                            }}
                            className="w-full bg-transparent border-0 text-xs text-gray-600 focus:ring-1 focus:ring-indigo-500 rounded"
                            placeholder="Expected output..."
                          />
                          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                            <span>Deadline: Week {ms.completionWeek}</span>
                            <button
                              onClick={() => setMilestones((prev) => prev.filter((item) => item.id !== ms.id))}
                              className="text-rose-500 hover:text-rose-700 font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeExecTab === 'risks' && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-gray-900 block">Project Risks & Contingencies</span>
                    {[
                      'API integration delay during multi-vendor hardware deployment.',
                      'Telemetry packet loss in remote municipal test zones.',
                    ].map((risk, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 text-xs text-amber-900 flex items-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeExecTab === 'resources' && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-gray-900 block">Hardware & Cloud Resources</span>
                    <ul className="text-xs text-gray-700 space-y-1 list-disc pl-5">
                      <li>PostgreSQL Cloud Instance & Redis Cache</li>
                      <li>AWS EC2 t3.medium for Telemetry Ingestion</li>
                      <li>IoT Ultrasonic Sensor Kit (HC-SR04) & ESP32 NodeMCU</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- BOTTOM SECTION: HOW REWARD POINTS WORK */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" /> How Reward Points Work
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-2">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="font-bold text-gray-900 block">Features (Max 1,000 pts)</span>
                <p className="text-gray-600 text-[11px]">
                  Each feature has a base value. Removing features reduces total feature reward automatically.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
                  <Users className="w-4 h-4" />
                </div>
                <span className="font-bold text-gray-900 block">Team (Max 1,000 pts)</span>
                <p className="text-gray-600 text-[11px]">
                  More team members increase total share capacity (up to 1,000 pts). Total share must equal 100%.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2">
                  <Award className="w-4 h-4" />
                </div>
                <span className="font-bold text-gray-900 block">Total Project Reward (Max 2,000 pts)</span>
                <p className="text-gray-600 text-[11px]">
                  Sum of Feature + Team rewards. Used later across milestone evaluation, grading, and faculty assessment.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2">
                  <Edit3 className="w-4 h-4" />
                </div>
                <span className="font-bold text-gray-900 block">Dynamic & Editable</span>
                <p className="text-gray-600 text-[11px]">
                  All details are editable. Changes update allocations live without refreshing the page.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
          >
            ← Back
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDoc}
              disabled={saving}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition shadow-2xs"
            >
              Save as Draft
            </button>
            <button
              onClick={handleSaveDoc}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-xs flex items-center gap-1.5"
            >
              Proceed to Execution Plan <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- ADD FEATURE MODAL */}
      {showAddFeatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">{editingFeatureId ? 'Edit Feature' : 'Add New Feature'}</h3>
            <p className="text-[11px] text-gray-500 -mt-2">
              Importance and reward points are assigned automatically by AI based on the description and how you plan
              to build it — the model re-scores against the project's problem statement every time.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Feature Name</label>
                <input
                  type="text"
                  value={newFeature.name}
                  onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
                  placeholder="e.g. Telemetry Endpoint"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Description</label>
                <textarea
                  value={newFeature.description}
                  onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                  placeholder="Brief feature description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">How will you build it?</label>
                <textarea
                  value={newFeature.implementationMethod}
                  onChange={(e) => setNewFeature({ ...newFeature, implementationMethod: e.target.value })}
                  placeholder="e.g. Fine-tuning a custom model, calling a hosted API with light glue code, a tuned traditional ML model..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowAddFeatureModal(false);
                  setEditingFeatureId(null);
                }}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFeature}
                disabled={savingFeature}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {savingFeature ? 'Scoring with AI...' : editingFeatureId ? 'Save Changes' : 'Add Feature'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- SEARCH & ADD MEMBER BY REGNO MODAL */}
      {showMemberSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" /> Search & Add Team Member
              </h3>
              <button onClick={() => setShowMemberSearchModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ×
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={candidateQuery}
                onChange={(e) => handleSearchCandidates(e.target.value)}
                placeholder="Search by RegNo (e.g. 21AG045) or Name..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-gray-50/30">
              {searchingCandidates ? (
                <div className="p-4 text-center text-xs text-gray-500">Searching student database...</div>
              ) : candidates.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">
                  {candidateQuery.trim().length < 2
                    ? 'Enter Register Number (RegNo) or Name to search.'
                    : 'No students found matching your query.'}
                </div>
              ) : (
                candidates.map((cand) => (
                  <div
                    key={cand.id}
                    onClick={() => handleAddCandidate(cand)}
                    className="p-3 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition"
                  >
                    <div>
                      <span className="font-bold text-xs text-gray-900 block">{cand.fullName}</span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {cand.regNo ? `RegNo: ${cand.regNo}` : cand.email}
                      </span>
                    </div>
                    <button className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[10px] rounded-lg hover:bg-indigo-700">
                      + Select
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowMemberSearchModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Project Modal */}
      <WithdrawProjectModal
        isOpen={showWithdrawModal}
        projectId={projectId}
        projectName={projectName || 'Current Project'}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={() => {
          if (onBack) onBack();
        }}
      />
    </div>
  );
};

