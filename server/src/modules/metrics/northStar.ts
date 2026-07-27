export interface MetricNode {
  id: string;
  name: string;
  type: 'LEADING' | 'LAGGING';
  unit: string;
  description: string;
  target?: string;
}

export const NORTH_STAR_TREE: {
  northStar: MetricNode;
  leading: MetricNode[];
  lagging: MetricNode[];
} = {
  northStar: {
    id: 'NS_01',
    name: 'On-Track Evidence-Backed Completion Rate',
    type: 'LAGGING',
    unit: '%',
    description: 'Percentage of projects finishing on-track with dispute-free, evidence-backed grades.',
    target: '> 85%',
  },
  leading: [
    {
      id: 'L_LOG_COMPLIANCE',
      name: 'Daily Log Compliance Rate',
      type: 'LEADING',
      unit: '%',
      description: 'Percentage of working days with at least one validated daily work log per member.',
      target: '> 80%',
    },
    {
      id: 'L_COMMIT_CADENCE',
      name: 'Commit Cadence Consistency',
      type: 'LEADING',
      unit: 'commits/week',
      description: 'Frequency and consistency of verified GitHub code commits across team members.',
      target: '3+ commits/week/member',
    },
    {
      id: 'L_TIMELINE_SLIPPAGE',
      name: 'Milestone Slippage Rate',
      type: 'LEADING',
      unit: '%',
      description: 'Difference between percentage of elapsed project duration and percentage of completed milestones.',
      target: '< 10%',
    },
    {
      id: 'L_BLOCKER_PERSISTENCE',
      name: 'Unresolved Blocker Duration',
      type: 'LEADING',
      unit: 'days',
      description: 'Average days an reported blocker remains open before escalation or resolution.',
      target: '< 3 days',
    },
    {
      id: 'L_CONTRIBUTION_GINI',
      name: 'Contribution Imbalance Gini',
      type: 'LEADING',
      unit: 'index (0-1)',
      description: 'Gini coefficient measuring workload and commit distribution equity across team members.',
      target: '< 0.35',
    },
  ],
  lagging: [
    {
      id: 'G_ON_TIME_COMPLETION',
      name: 'On-Time Completion Rate',
      type: 'LAGGING',
      unit: '%',
      description: 'Percentage of projects completing all required deliverables within scheduled duration.',
      target: '> 90%',
    },
    {
      id: 'G_GRADE_DISPUTE_RATE',
      name: 'Grade Dispute Rate',
      type: 'LAGGING',
      unit: '%',
      description: 'Percentage of teams formally disputing final evaluation scores.',
      target: '< 2%',
    },
    {
      id: 'G_EVIDENCE_ATTACHMENT_RATE',
      name: 'Evidence-Backed Evaluation Rate',
      type: 'LAGGING',
      unit: '%',
      description: 'Percentage of evaluation criteria backed by automated commit/doc audit trails.',
      target: '> 95%',
    },
    {
      id: 'G_CATALOG_HERDING_HHI',
      name: 'Catalog Concentration HHI',
      type: 'LAGGING',
      unit: 'HHI index',
      description: 'Herfindahl–Hirschman Index measuring distribution of team selections across catalog statements.',
      target: '< 0.15',
    },
  ],
};
