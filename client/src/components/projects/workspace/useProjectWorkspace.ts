import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ExecutionDocContent,
  FeatureAllocationItem,
  TeamShareAllocationItem,
  ProjectLogState,
  ProjectPhaseItem,
} from '../../../types/projectLog';
import { lifecycleService } from '../../../services/lifecycle.service';
import { teamService } from '../../../services/team.service';

const DEFAULT_MEMBERS: TeamShareAllocationItem[] = [
  { userId: 'u-1', name: 'Project Selector (Lead)', role: 'Project Selector / Lead', sharePercent: 100, rewardPoints: 500, isLead: true },
];

export interface UseProjectWorkspaceOptions {
  projectId: string;
  logState?: ProjectLogState | null;
  initialDoc?: ExecutionDocContent | null;
  onSaved?: () => void;
}

export const useProjectWorkspace = ({
  projectId,
  logState,
  initialDoc,
  onSaved,
}: UseProjectWorkspaceOptions) => {
  // Document State
  const [docContent, setDocContent] = useState<ExecutionDocContent | null>(initialDoc || null);

  // Header State
  const [projectName, setProjectName] = useState<string>('');
  const [domain, setDomain] = useState<string>('Smart Cities');
  const [subdomain, setSubdomain] = useState<string>('Waste Management');
  const [proposedDate, setProposedDate] = useState<string>('Jul 31, 2025');

  // Features State
  const [features, setFeatures] = useState<FeatureAllocationItem[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [initialFeaturePoints, setInitialFeaturePoints] = useState<number>(1000);
  const [featureWarning, setFeatureWarning] = useState<string | null>(null);

  // Team Share State
  const [teamShare, setTeamShare] = useState<TeamShareAllocationItem[]>(DEFAULT_MEMBERS);

  // Phases State
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

  // Phase Submission & Review State
  const [submitModalPhaseId, setSubmitModalPhaseId] = useState<string | null>(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [evidenceUrlsText, setEvidenceUrlsText] = useState('');
  const [submittingPhase, setSubmittingPhase] = useState<string | null>(null);
  const [reviewingPhase, setReviewingPhase] = useState<string | null>(null);
  const [reviewNoteDraft, setReviewNoteDraft] = useState<Record<string, string>>({});

  // Document Overview State
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

  // Milestones State
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

  // Nested Doc Editor Tab State
  const [activeExecTab, setActiveExecTab] = useState<
    'overview' | 'objectives' | 'tech' | 'milestones' | 'risks' | 'resources'
  >('overview');

  // Modals & UI Action State
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false);
  const [savingFeature, setSavingFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({
    name: '',
    description: '',
    implementationMethod: '',
  });

  const [showMemberSearchModal, setShowMemberSearchModal] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<Array<{ id: string; fullName: string; email: string; regNo?: string; teamId?: string }>>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load phases
  const loadPhases = useCallback(async () => {
    if (!projectId) return;
    setPhasesLoading(true);
    try {
      const res = await lifecycleService.getPhases(projectId);
      setPhases(res.phases);
    } catch (err) {
      console.error('Failed to load phases:', err);
    } finally {
      setPhasesLoading(false);
    }
  }, [projectId]);

  // Load features
  const loadFeatures = useCallback(async () => {
    if (!projectId) return;
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
  }, [projectId]);

  useEffect(() => {
    loadFeatures();
    loadPhases();
  }, [loadFeatures, loadPhases]);

  // Dynamic calculations
  const totalFeaturePoints = useMemo(() => {
    return features.reduce((sum, f) => sum + (f.points || 0), 0);
  }, [features]);

  const teamRewardCapacity = useMemo(() => {
    const memberCount = teamShare.length;
    if (memberCount <= 1) return 500;
    if (memberCount === 2) return 650;
    if (memberCount === 3) return 750;
    if (memberCount === 4) return 800;
    return 850;
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

  useEffect(() => {
    if (totalFeaturePoints < initialFeaturePoints) {
      setFeatureWarning(
        `Total feature reward decreased to ${totalFeaturePoints} pts because features were removed or edited.`
      );
    } else {
      setFeatureWarning(null);
    }
  }, [totalFeaturePoints, initialFeaturePoints]);

  useEffect(() => {
    setTeamShare((prev) =>
      prev.map((m) => ({
        ...m,
        rewardPoints: Math.round(teamRewardCapacity * ((m.sharePercent || 0) / 100)),
      }))
    );
  }, [teamRewardCapacity]);

  // Sync logState / initialDoc
  useEffect(() => {
    if (logState) {
      if (logState.title) setProjectName(logState.title);
      if (logState.department) setDomain(logState.department);
      if (!initialDoc?.teamShare && logState.team?.members && logState.team.members.length > 0) {
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
  }, [logState, initialDoc, teamRewardCapacity]);

  // Feature actions
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
      setIsDirty(true);
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
    setIsDirty(true);
    try {
      await lifecycleService.removeFeature(projectId, id);
    } catch (err: any) {
      setFeatures(previous);
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to remove feature.' });
    }
  };

  const handleUpdateMemberShare = (userId: string, newShare: number) => {
    setIsDirty(true);
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
    setIsDirty(true);
    setTeamShare((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
    );
  };

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
    setIsDirty(true);
  };

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
    setIsDirty(true);
  };

  // Phase edit actions
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
      await lifecycleService.reviewPhase(projectId, phaseId, {
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
        workBreakdown: features.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          percentage: Math.round(100 / (features.length || 1)),
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
        features,
        teamShare,
        targetUsers: overview.targetUsers,
      };

      await lifecycleService.saveDocument(projectId, payload);
      setNotification({ type: 'success', message: 'Execution document and allocations saved successfully!' });
      setIsDirty(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error('Failed to save execution document:', err);
      setNotification({ type: 'error', message: err?.response?.data?.message || 'Failed to save document changes.' });
    } finally {
      setSaving(false);
    }
  };

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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setNotification({ type: 'success', message: 'Page link copied to clipboard!' });
  };

  return {
    projectId,
    docContent,
    setDocContent,
    projectName,
    setProjectName,
    domain,
    setDomain,
    subdomain,
    setSubdomain,
    proposedDate,
    setProposedDate,
    features,
    setFeatures,
    featuresLoading,
    loadFeatures,
    teamShare,
    setTeamShare,
    phases,
    setPhases,
    phasesLoading,
    loadPhases,
    editingPhaseId,
    setEditingPhaseId,
    phaseEditDraft,
    setPhaseEditDraft,
    savingPhaseEdit,
    handleStartEditPhase,
    handleCancelEditPhase,
    handleSavePhaseEdit,
    submitModalPhaseId,
    setSubmitModalPhaseId,
    submissionNote,
    setSubmissionNote,
    evidenceUrlsText,
    setEvidenceUrlsText,
    submittingPhase,
    handleSubmitPhase,
    reviewingPhase,
    handleReviewPhase,
    reviewNoteDraft,
    setReviewNoteDraft,
    overview,
    setOverview,
    milestones,
    setMilestones,
    activeExecTab,
    setActiveExecTab,
    editingFeatureId,
    setEditingFeatureId,
    showAddFeatureModal,
    setShowAddFeatureModal,
    savingFeature,
    newFeature,
    setNewFeature,
    handleAddFeature,
    handleEditFeature,
    handleDeleteFeature,
    showMemberSearchModal,
    setShowMemberSearchModal,
    candidateQuery,
    candidates,
    searchingCandidates,
    handleSearchCandidates,
    handleAddCandidate,
    availableGroupMembers,
    handleAddAvailableMember,
    handleUpdateMemberShare,
    handleUpdateMemberRole,
    totalFeaturePoints,
    teamRewardCapacity,
    totalSharePercent,
    totalTeamRewardPoints,
    totalProjectRewardPoints,
    featureWarning,
    saving,
    exporting,
    notification,
    setNotification,
    isDirty,
    setIsDirty,
    handleSaveDoc,
    handleExportPdf,
    handleShare,
    showWithdrawModal,
    setShowWithdrawModal,
  };
};

export type ProjectWorkspaceHook = ReturnType<typeof useProjectWorkspace>;
