import { hasSkill } from '../../shared/skillMatch';

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
