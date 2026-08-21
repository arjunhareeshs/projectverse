import { hasSkill } from '../../shared/skillMatch';
import { prisma } from '../../shared/database';

export interface FitInput {
  teamSkills: string[];                 // Union of members' UserSkill.skillName
  requiredSkills: string[];             // Derived from statement domain/sector config
  avgPerformance: number;               // 0-100, from ranking or 50 baseline
  weeksAvailable: number;
  difficultyTier: number;               // 0-4
}

export interface FitResult {
  score: number;
  skillCoverage: number;
  reasons: string[];
}

export const WEIGHTS = {
  skillCoverage: 0.55,
  timeFit: 0.25,
  perfFit: 0.20,
} as const;

export const DOMAIN_REQUIRED_SKILLS: Record<string, string[]> = {
  'Artificial Intelligence': ['Python', 'Machine Learning', 'TensorFlow', 'PyTorch', 'Data Analysis'],
  'Web Development': ['JavaScript', 'React', 'Node.js', 'TypeScript', 'HTML/CSS'],
  'Mobile Development': ['Flutter', 'React Native', 'Swift', 'Kotlin', 'REST APIs'],
  'Cybersecurity': ['Network Security', 'Python', 'Cryptography', 'Linux', 'Ethical Hacking'],
  'Cloud Computing': ['AWS', 'Docker', 'Kubernetes', 'Linux', 'CI/CD'],
  'Data Science': ['Python', 'SQL', 'Pandas', 'Machine Learning', 'Data Visualization'],
  'Blockchain': ['Solidity', 'Web3.js', 'Cryptography', 'Smart Contracts', 'Go'],
  'IoT & Embedded': ['C++', 'Python', 'Raspberry Pi', 'Arduino', 'MQTT'],
};

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function buildReasons(
  skillCoverage: number,
  timeFit: number,
  perfFit: number,
  covered: string[],
  required: string[],
): string[] {
  const reasons: string[] = [];

  if (required.length === 0) {
    reasons.push('General domain requirements; default baseline fit applied.');
  } else if (skillCoverage >= 0.8) {
    reasons.push(`Strong skill match: team covers ${covered.length}/${required.length} key domain skills (${covered.slice(0, 3).join(', ')}).`);
  } else if (skillCoverage >= 0.5) {
    reasons.push(`Moderate skill match: team covers ${covered.length}/${required.length} domain skills.`);
  } else {
    reasons.push(`Skill gap detected: team only covers ${covered.length}/${required.length} domain skills.`);
  }

  if (timeFit >= 0.8) {
    reasons.push('Timeline is well suited for the project difficulty level.');
  } else {
    reasons.push('Tight timeline relative to the project difficulty tier.');
  }

  if (perfFit >= 0.7) {
    reasons.push('Team has a solid past performance record.');
  }

  return reasons;
}

export function computeFit(input: FitInput): FitResult {
  const covered = input.requiredSkills.filter((r) =>
    hasSkill(r, input.teamSkills)
  );

  const skillCoverage = input.requiredSkills.length
    ? covered.length / input.requiredSkills.length
    : 0.5;

  const targetWeeks = 6 + input.difficultyTier * 2;
  const timeFit = clamp01(input.weeksAvailable / Math.max(1, targetWeeks));
  const perfFit = clamp01(input.avgPerformance / 100);

  const rawScore = 100 * (
    WEIGHTS.skillCoverage * skillCoverage +
    WEIGHTS.timeFit * timeFit +
    WEIGHTS.perfFit * perfFit
  );

  const score = Math.round(rawScore);
  const reasons = buildReasons(skillCoverage, timeFit, perfFit, covered, input.requiredSkills);

  return { score, skillCoverage: Number(skillCoverage.toFixed(2)), reasons };
}

/**
 * Resolves required skills for a domain from DomainSkillRequirement first,
 * falling back to the hardcoded DOMAIN_REQUIRED_SKILLS map, and seeding the
 * table from that fallback on first use. This is the fix for the defect
 * where a domain outside the hardcoded 8 silently produced zero required
 * skills (and therefore a meaningless fit score) with no way to add a domain
 * short of a code deploy — after this, an admin can add/edit
 * DomainSkillRequirement rows directly.
 */
export async function getRequiredSkillsForDomain(
  organizationId: string | null,
  domain: string | null | undefined,
): Promise<string[]> {
  if (!domain) return [];

  const existing = await prisma.domainSkillRequirement.findMany({
    where: {
      domain,
      OR: [{ organizationId }, { organizationId: null }],
      isRequired: true,
    },
    orderBy: { weight: 'desc' },
  });

  if (existing.length > 0) {
    // Prefer org-specific overrides over the platform default for the same skill.
    const bySkill = new Map<string, (typeof existing)[number]>();
    for (const row of existing) {
      const current = bySkill.get(row.skillName);
      if (!current || (row.organizationId && !current.organizationId)) {
        bySkill.set(row.skillName, row);
      }
    }
    return Array.from(bySkill.keys());
  }

  const fallback = DOMAIN_REQUIRED_SKILLS[domain];
  if (!fallback) return [];

  // Self-heal: seed the platform-default rows so future lookups hit the table
  // and an admin has something to edit instead of a hardcoded constant.
  await prisma.domainSkillRequirement.createMany({
    data: fallback.map((skillName) => ({ organizationId: null, domain, skillName })),
    skipDuplicates: true,
  });

  return fallback;
}

/**
 * Computes a fit score with `computeFit` and persists it as a
 * ProjectFitScore row at the moment a team actually claims a project — this
 * is the decision the score is meant to justify, not the catalog browse list
 * (which computes fit for every template on every page load and must stay a
 * pure, unpersisted calculation to avoid writing a row per browse).
 */
export async function persistProjectFitScore(params: {
  projectId: string;
  teamId: string;
  input: FitInput;
}) {
  const result = computeFit(params.input);

  return prisma.projectFitScore.create({
    data: {
      projectId: params.projectId,
      teamId: params.teamId,
      score: result.score,
      skillCoverage: result.skillCoverage,
      timeFit: Number(clamp01(params.input.weeksAvailable / Math.max(1, 6 + params.input.difficultyTier * 2)).toFixed(2)),
      perfFit: Number(clamp01(params.input.avgPerformance / 100).toFixed(2)),
      avgPerformance: params.input.avgPerformance,
      weeksAvailable: params.input.weeksAvailable,
      difficultyTier: params.input.difficultyTier,
      weightSkillCoverage: WEIGHTS.skillCoverage,
      weightTimeFit: WEIGHTS.timeFit,
      weightPerfFit: WEIGHTS.perfFit,
      reasons: {
        create: result.reasons.map((text, order) => ({ text, order })),
      },
    },
    include: { reasons: true },
  });
}
