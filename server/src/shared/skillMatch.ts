/**
 * Shared Skill Matching Utility
 * Replaces naive substring inclusion (e.g. "ML" matching "HTML") with
 * token/word-boundary matching and a canonical synonym normalization dictionary.
 */

const SYNONYM_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  ml: 'machine learning',
  dl: 'deep learning',
  ai: 'artificial intelligence',
  postgres: 'postgresql',
  postgresdb: 'postgresql',
  mongo: 'mongodb',
  reactjs: 'react',
  nodejs: 'node.js',
  node: 'node.js',
  expressjs: 'express',
  k8s: 'kubernetes',
  docker: 'docker containerization',
  tf: 'tensorflow',
  pyt: 'pytorch',
  nlp: 'natural language processing',
  cv: 'computer vision',
};

export function normalizeSkill(skill: string): string {
  const raw = skill.toLowerCase().trim().replace(/[^a-z0-9.+#-]/g, '');
  return SYNONYM_MAP[raw] || raw;
}

export function tokenizeSkill(skill: string): string[] {
  const norm = normalizeSkill(skill);
  return norm.split(/[\s./_-]+/).filter(Boolean);
}

/**
 * Returns true if availableSkill covers requiredSkill.
 * Uses exact token matching or normalized synonym equivalence.
 */
export function matchSkill(requiredSkill: string, availableSkill: string): boolean {
  const reqNorm = normalizeSkill(requiredSkill);
  const availNorm = normalizeSkill(availableSkill);

  if (reqNorm === availNorm) return true;

  const reqTokens = tokenizeSkill(requiredSkill);
  const availTokens = tokenizeSkill(availableSkill);

  // Require full token sequence match or exact token presence
  if (reqTokens.length === 1) {
    const reqTok = reqTokens[0];
    return availTokens.some((t) => t === reqTok || SYNONYM_MAP[t] === reqTok);
  }

  // Multi-word required skill (e.g. "machine learning"): require all required tokens in available
  return reqTokens.every((rt) => availTokens.includes(rt));
}

/**
 * Returns true if availableSkills contains any skill matching requiredSkill.
 */
export function hasSkill(requiredSkill: string, availableSkills: string[]): boolean {
  return availableSkills.some((avail) => matchSkill(requiredSkill, avail));
}

/**
 * Calculates skill gaps per member deterministically.
 */
export function findSkillGaps(
  requiredSkills: string[],
  memberSkillsMap: Record<string, string[]>,
): Array<{ skill: string; missingFor: string[] }> {
  const gaps: Array<{ skill: string; missingFor: string[] }> = [];

  for (const reqSkill of requiredSkills) {
    const missingFor: string[] = [];
    for (const [userId, userSkills] of Object.entries(memberSkillsMap)) {
      if (!hasSkill(reqSkill, userSkills)) {
        missingFor.push(userId);
      }
    }
    if (missingFor.length > 0) {
      gaps.push({ skill: reqSkill, missingFor });
    }
  }

  return gaps;
}
