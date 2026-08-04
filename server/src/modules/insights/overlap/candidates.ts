import type { ProjectDocument } from './corpus';
import { type TfIdfModel, cosineSimilarity } from './tfidf';
import { tokenizeText } from './tokenize';

export interface CandidatePair {
  p1: ProjectDocument;
  p2: ProjectDocument;
  cosineScore: number;
  featureScore: number;
  techScore: number;
  combinedScore: number;
}

export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0.0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount++;
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount > 0 ? intersectionCount / unionCount : 0.0;
}

export function generateCandidatePairs(
  docs: ProjectDocument[],
  tfidfModel: TfIdfModel,
  overlapThreshold: number = process.env.OVERLAP_THRESHOLD ? Number(process.env.OVERLAP_THRESHOLD) : 0.62,
  maxPairs: number = process.env.INSIGHTS_MAX_PAIRS ? Number(process.env.INSIGHTS_MAX_PAIRS) : 5000
): CandidatePair[] {
  const docMap = new Map(docs.map((d) => [d.projectId, d]));
  const pairKeys = new Set<string>();

  const candidatePairsList: Array<[ProjectDocument, ProjectDocument]> = [];

  // 1. Inverted index of top-40 terms per document
  const termInvertedIndex = new Map<string, string[]>();

  for (const doc of docs) {
    const vec = tfidfModel.vectors.get(doc.projectId);
    if (!vec || vec.size === 0) continue;

    // Sort terms by weight desc
    const sortedTerms = Array.from(vec.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map((entry) => entry[0]);

    for (const term of sortedTerms) {
      const list = termInvertedIndex.get(term) || [];
      list.push(doc.projectId);
      termInvertedIndex.set(term, list);
    }
  }

  // 2. Domain blocking — sort groups so specialized domains run before giant "general" bucket
  const domainGroups = new Map<string, ProjectDocument[]>();
  for (const doc of docs) {
    const dKey = doc.domain.toLowerCase().trim();
    const list = domainGroups.get(dKey) || [];
    list.push(doc);
    domainGroups.set(dKey, list);
  }

  const sortedDomainEntries = Array.from(domainGroups.entries()).sort((a, b) => {
    if (a[0] === 'general') return 1;
    if (b[0] === 'general') return -1;
    return a[0].localeCompare(b[0]);
  });

  for (const [, group] of sortedDomainEntries) {
    if (group.length < 2) continue;
    let groupPairs = 0;
    const maxPerDomain = 1000;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const p1 = group[i];
        const p2 = group[j];
        const key = p1.projectId < p2.projectId ? `${p1.projectId}:${p2.projectId}` : `${p2.projectId}:${p1.projectId}`;
        if (!pairKeys.has(key)) {
          pairKeys.add(key);
          candidatePairsList.push([p1, p2]);
          groupPairs++;
          if (groupPairs >= maxPerDomain || candidatePairsList.length >= maxPairs) break;
        }
      }
      if (groupPairs >= maxPerDomain || candidatePairsList.length >= maxPairs) break;
    }
    if (candidatePairsList.length >= maxPairs) break;
  }

  // 3. Cross-domain pairs via inverted index (if under maxPairs)
  if (candidatePairsList.length < maxPairs) {
    for (const [, docIds] of termInvertedIndex.entries()) {
      if (docIds.length < 2 || docIds.length > 50) continue; // Skip ultra-frequent terms
      for (let i = 0; i < docIds.length; i++) {
        for (let j = i + 1; j < docIds.length; j++) {
          const id1 = docIds[i];
          const id2 = docIds[j];
          if (id1 === id2) continue;
          const p1 = docMap.get(id1);
          const p2 = docMap.get(id2);
          if (!p1 || !p2) continue;

          const key = id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
          if (!pairKeys.has(key)) {
            pairKeys.add(key);
            candidatePairsList.push([p1, p2]);
            if (candidatePairsList.length >= maxPairs) break;
          }
        }
        if (candidatePairsList.length >= maxPairs) break;
      }
      if (candidatePairsList.length >= maxPairs) break;
    }
  }

  // 4. Score candidates
  const scoredCandidates: CandidatePair[] = [];

  for (const [p1, p2] of candidatePairsList) {
    const v1 = tfidfModel.vectors.get(p1.projectId);
    const v2 = tfidfModel.vectors.get(p2.projectId);
    if (!v1 || !v2) continue;

    const cosineScore = cosineSimilarity(v1, v2);

    // Feature overlap (Jaccard over work-package / milestone titles, or problemStatement/objective fallback)
    const f1Tokens = new Set<string>();
    const f2Tokens = new Set<string>();

    const f1Sources = [...p1.workPackageTitles, ...p1.milestoneTitles];
    if (f1Sources.length === 0) {
      if (p1.problemStatement) f1Sources.push(p1.problemStatement);
      if (p1.objective) f1Sources.push(p1.objective);
    }
    for (const title of f1Sources) {
      for (const t of tokenizeText(title)) f1Tokens.add(t);
    }

    const f2Sources = [...p2.workPackageTitles, ...p2.milestoneTitles];
    if (f2Sources.length === 0) {
      if (p2.problemStatement) f2Sources.push(p2.problemStatement);
      if (p2.objective) f2Sources.push(p2.objective);
    }
    for (const title of f2Sources) {
      for (const t of tokenizeText(title)) f2Tokens.add(t);
    }

    const featureScore = jaccardSimilarity(f1Tokens, f2Tokens);

    // Tech overlap (Jaccard over technologies[] ∪ hardwareComponents[])
    const t1 = new Set<string>([
      ...p1.technologies.map((t) => t.toLowerCase().trim()),
      ...p1.hardwareComponents.map((h) => h.toLowerCase().trim()),
    ]);
    const t2 = new Set<string>([
      ...p2.technologies.map((t) => t.toLowerCase().trim()),
      ...p2.hardwareComponents.map((h) => h.toLowerCase().trim()),
    ]);
    const techScore = jaccardSimilarity(t1, t2);

    const combinedScore = 0.55 * cosineScore + 0.25 * featureScore + 0.20 * techScore;

    if (combinedScore >= overlapThreshold) {
      scoredCandidates.push({
        p1,
        p2,
        cosineScore,
        featureScore,
        techScore,
        combinedScore,
      });
    }
  }

  return scoredCandidates;
}
