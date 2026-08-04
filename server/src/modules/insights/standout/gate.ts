export const STANDOUT_THRESHOLDS = {
  MIN_EVALUATION_REPORTS: 3,
  MEAN_QUALITY_MIN: 78,
  CONSISTENCY_MIN: 70,
  TRAJECTORY_MAX_DROP: 5,
  AUTHENTICITY_SCORE_MIN: 75,
  GITHUB_COMMIT_MIN: 40,
  GITHUB_CONTRIBUTOR_MIN: 2,
  GITHUB_DISTINCT_WEEKS_MIN: 3,
  MEMBER_PARTICIPATION_MIN: 30,
};

export interface GateEvaluationInput {
  projectId: string;
  reports: Array<{
    cycle: number;
    overallScore: number;
    plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    suspiciousBehaviour: string[];
    isFallback: boolean;
    perMemberParticipation: Array<{ memberId: string; score: number }>;
  }>;
  authenticityScore: number; // 0-100
  github: {
    linked: boolean;
    commitCount: number;
    contributorCount: number;
    distinctIsoWeeks: number;
  };
  hasSevereOverlapFlag: boolean;
}

export interface GateResult {
  passed: boolean;
  failedReasons: string[];
  evidenceScore: number; // 0-100
  metrics: {
    cyclesEvaluated: number;
    avgScore: number;
    minScore: number;
    trendDelta: number;
    lastCycleSeen: number;
  };
}


export function evaluateStandoutGate(input: GateEvaluationInput): GateResult {
  const failedReasons: string[] = [];

  // Filter non-fallback reports
  const validReports = input.reports.filter((r) => !r.isFallback);
  validReports.sort((a, b) => a.cycle - b.cycle);

  // Check 1: Sustained history
  if (validReports.length < STANDOUT_THRESHOLDS.MIN_EVALUATION_REPORTS) {
    failedReasons.push(
      `Insufficient evaluation history (${validReports.length}/${STANDOUT_THRESHOLDS.MIN_EVALUATION_REPORTS} cycles)`
    );
  }

  const last3 = validReports.slice(-3);
  const sumLast3 = last3.reduce((acc, r) => acc + r.overallScore, 0);
  const meanLast3 = last3.length > 0 ? sumLast3 / last3.length : 0;

  // Check 2: Current quality
  if (meanLast3 < STANDOUT_THRESHOLDS.MEAN_QUALITY_MIN) {
    failedReasons.push(
      `Current quality score (${meanLast3.toFixed(1)}) below threshold (${STANDOUT_THRESHOLDS.MEAN_QUALITY_MIN})`
    );
  }

  // Check 3: Consistency
  const minScore = validReports.length > 0 ? Math.min(...validReports.map((r) => r.overallScore)) : 0;
  if (minScore < STANDOUT_THRESHOLDS.CONSISTENCY_MIN) {
    failedReasons.push(
      `Consistency failure: lowest cycle score (${minScore.toFixed(1)}) below minimum (${STANDOUT_THRESHOLDS.CONSISTENCY_MIN})`
    );
  }

  // Check 4: Trajectory
  const firstCycleScore = validReports.length > 0 ? validReports[0].overallScore : 0;
  const trendDelta = meanLast3 - firstCycleScore;
  if (meanLast3 < firstCycleScore - STANDOUT_THRESHOLDS.TRAJECTORY_MAX_DROP) {
    failedReasons.push(
      `Declining performance trajectory (drop of ${Math.abs(trendDelta).toFixed(1)} points from initial cycle)`
    );
  }

  // Check 5: Integrity
  const highPlagiarism = validReports.some((r) => r.plagiarismRisk === 'HIGH');
  const mediumPlagiarismCount = validReports.filter((r) => r.plagiarismRisk === 'MEDIUM').length;
  if (highPlagiarism) {
    failedReasons.push('Integrity failure: HIGH plagiarism risk flagged in evaluation history');
  }
  if (mediumPlagiarismCount > 1) {
    failedReasons.push(`Integrity failure: Multiple (${mediumPlagiarismCount}) MEDIUM plagiarism risk flags`);
  }

  // Check 6: Authenticity
  if (input.authenticityScore < STANDOUT_THRESHOLDS.AUTHENTICITY_SCORE_MIN) {
    failedReasons.push(
      `Authenticity score (${input.authenticityScore.toFixed(1)}) below threshold (${STANDOUT_THRESHOLDS.AUTHENTICITY_SCORE_MIN})`
    );
  }

  // Check 7: Clean recent record
  const last2 = validReports.slice(-2);
  const recentSuspicious = last2.some((r) => r.suspiciousBehaviour && r.suspiciousBehaviour.length > 0);
  if (recentSuspicious) {
    failedReasons.push('Suspicious behaviour detected in recent evaluation cycles');
  }

  // Check 8: Real code
  if (!input.github.linked) {
    failedReasons.push('No GitHub repository linked to project');
  } else {
    if (input.github.commitCount < STANDOUT_THRESHOLDS.GITHUB_COMMIT_MIN) {
      failedReasons.push(
        `GitHub commit count (${input.github.commitCount}) below minimum (${STANDOUT_THRESHOLDS.GITHUB_COMMIT_MIN})`
      );
    }
    if (input.github.contributorCount < STANDOUT_THRESHOLDS.GITHUB_CONTRIBUTOR_MIN) {
      failedReasons.push(
        `GitHub contributor count (${input.github.contributorCount}) below minimum (${STANDOUT_THRESHOLDS.GITHUB_CONTRIBUTOR_MIN})`
      );
    }
    if (input.github.distinctIsoWeeks < STANDOUT_THRESHOLDS.GITHUB_DISTINCT_WEEKS_MIN) {
      failedReasons.push(
        `GitHub activity spread across only ${input.github.distinctIsoWeeks} distinct weeks (minimum ${STANDOUT_THRESHOLDS.GITHUB_DISTINCT_WEEKS_MIN})`
      );
    }
  }

  // Check 9: Whole team participation
  const latestReport = validReports[validReports.length - 1];
  if (latestReport && latestReport.perMemberParticipation.length > 0) {
    const lowMember = latestReport.perMemberParticipation.some(
      (m) => m.score < STANDOUT_THRESHOLDS.MEMBER_PARTICIPATION_MIN
    );
    if (lowMember) {
      failedReasons.push(
        `Uneven team contribution: at least one member scored below ${STANDOUT_THRESHOLDS.MEMBER_PARTICIPATION_MIN}% in latest cycle`
      );
    }
  }

  // Check 10: Not derivative
  if (input.hasSevereOverlapFlag) {
    failedReasons.push('Project has an unresolved substantial/near-duplicate overlap flag');
  }

  // Compute Evidence Score (0-100)
  const sustainedQualityNorm = Math.min(100, Math.max(0, meanLast3));
  const authenticityNorm = Math.min(100, Math.max(0, input.authenticityScore));

  const commitNorm = Math.min(100, (input.github.commitCount / 100) * 100);
  const weeksNorm = Math.min(100, (input.github.distinctIsoWeeks / 6) * 100);
  const githubReality = 0.6 * commitNorm + 0.4 * weeksNorm;

  const minMemberScore = latestReport?.perMemberParticipation?.length
    ? Math.min(...latestReport.perMemberParticipation.map((m) => m.score))
    : 50;
  const participationBreadth = Math.min(100, Math.max(0, minMemberScore));

  const trajectoryNorm = Math.min(100, Math.max(0, 50 + trendDelta * 5));

  const evidenceScore =
    0.35 * sustainedQualityNorm +
    0.20 * authenticityNorm +
    0.20 * githubReality +
    0.15 * participationBreadth +
    0.10 * trajectoryNorm;

  const allScores = validReports.map((r) => r.overallScore);
  const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const lastCycleSeen = validReports.length > 0 ? validReports[validReports.length - 1].cycle : 0;

  return {
    passed: failedReasons.length === 0,
    failedReasons,
    evidenceScore: Number(evidenceScore.toFixed(1)),
    metrics: {
      cyclesEvaluated: validReports.length,
      avgScore: Number(avgScore.toFixed(1)),
      minScore: Number(minScore.toFixed(1)),
      trendDelta: Number(trendDelta.toFixed(1)),
      lastCycleSeen,
    },
  };
}
