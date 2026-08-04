import crypto from 'crypto';
import { prisma } from '../../../shared/database';
import { chatJSONWithMeta, isLlmConfigured } from '../../ai/llm.service';
import { buildProjectCorpus, type ProjectDocument } from './corpus';
import { tokenizeText } from './tokenize';
import { buildTfIdfModel } from './tfidf';
import { generateCandidatePairs, type CandidatePair } from './candidates';
import { buildOverlapPrompt, overlapAnalysisSchema, type OverlapAnalysisResult } from './overlap.prompt';

class UnionFind {
  parent: Map<string, string> = new Map();

  find(i: string): string {
    if (!this.parent.has(i)) {
      this.parent.set(i, i);
      return i;
    }
    const root = this.parent.get(i)!;
    if (root === i) return i;
    const parentRoot = this.find(root);
    this.parent.set(i, parentRoot);
    return parentRoot;
  }

  union(i: string, j: string) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent.set(rootI, rootJ);
    }
  }
}

export class OverlapService {
  static async runOverlapDetection(): Promise<{ flagsCreated: number; flagsUpdated: number; skippedCount: number }> {
    // 1. Build corpus
    const docs = await buildProjectCorpus();
    if (docs.length < 2) {
      return { flagsCreated: 0, flagsUpdated: 0, skippedCount: 0 };
    }

    // 2. Tokenize docs & build TF-IDF model
    const docTokensMap = new Map<string, string[]>();
    for (const d of docs) {
      docTokensMap.set(d.projectId, tokenizeText(d.weightedText));
    }

    const tfidfModel = buildTfIdfModel(docTokensMap);

    // 3. Generate candidate pairs
    const candidates = generateCandidatePairs(docs, tfidfModel);
    if (candidates.length === 0) {
      return { flagsCreated: 0, flagsUpdated: 0, skippedCount: 0 };
    }

    // 4. Cluster candidates using Union-Find
    const uf = new UnionFind();
    for (const c of candidates) {
      uf.union(c.p1.projectId, c.p2.projectId);
    }

    const clustersMap = new Map<string, Set<string>>();
    for (const c of candidates) {
      const root1 = uf.find(c.p1.projectId);
      const set1 = clustersMap.get(root1) || new Set();
      set1.add(c.p1.projectId);
      set1.add(c.p2.projectId);
      clustersMap.set(root1, set1);
    }

    // Cap cluster size at 6 (split if larger)
    const docMap = new Map(docs.map((d) => [d.projectId, d]));
    const finalClusters: ProjectDocument[][] = [];

    for (const [, projSet] of clustersMap.entries()) {
      const projIds = Array.from(projSet);
      if (projIds.length <= 6) {
        finalClusters.push(projIds.map((id) => docMap.get(id)!));
      } else {
        // Simple split into chunks of 6
        for (let i = 0; i < projIds.length; i += 6) {
          const chunk = projIds.slice(i, i + 6);
          finalClusters.push(chunk.map((id) => docMap.get(id)!));
        }
      }
    }

    let flagsCreated = 0;
    let flagsUpdated = 0;
    let skippedCount = 0;

    // 5. Process each cluster
    for (const cluster of finalClusters) {
      if (cluster.length < 2) continue;

      const sortedIds = cluster.map((c) => c.projectId).sort();
      const clusterHash = crypto.createHash('sha256').update(sortedIds.join(':')).digest('hex');

      // Check existing flag in database
      const existingFlag = await prisma.projectOverlapFlag.findUnique({
        where: { clusterHash },
        include: { members: true },
      });

      if (existingFlag) {
        // Check if all member contentHashes match
        const memberHashMap = new Map(existingFlag.members.map((m) => [m.projectId, m.contentHash]));
        let hashesUnchanged = true;
        for (const doc of cluster) {
          if (memberHashMap.get(doc.projectId) !== doc.contentHash) {
            hashesUnchanged = false;
            break;
          }
        }
        if (hashesUnchanged) {
          skippedCount++;
          continue;
        }
      }

      // Calculate cluster average similarity score across candidates
      let sumSim = 0;
      let pairCount = 0;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          const id1 = cluster[i].projectId;
          const id2 = cluster[j].projectId;
          const matchedPair = candidates.find(
            (c) =>
              (c.p1.projectId === id1 && c.p2.projectId === id2) ||
              (c.p1.projectId === id2 && c.p2.projectId === id1)
          );
          if (matchedPair) {
            sumSim += matchedPair.combinedScore;
            pairCount++;
          }
        }
      }
      const similarityScore = pairCount > 0 ? sumSim / pairCount : 0.65;

      // Adjudicate
      let analysis: OverlapAnalysisResult;
      let isFallback = false;

      if (isLlmConfigured()) {
        const { system, user } = buildOverlapPrompt(cluster);
        const fallbackValue: OverlapAnalysisResult = {
          verdict: similarityScore >= 0.85 ? 'NEAR_DUPLICATE' : similarityScore >= 0.75 ? 'SUBSTANTIAL_OVERLAP' : 'PARTIAL_OVERLAP',
          confidence: 70,
          overlappingFeatures: cluster.map((c) => c.name),
          sharedTechnologies: Array.from(new Set(cluster.flatMap((c) => c.technologies))),
          keyDifferences: ['Lexical analysis only'],
          rationale: `Automated lexical fallback analysis based on TF-IDF similarity score of ${(similarityScore * 100).toFixed(1)}%.`,
          recommendedAction: 'Review project scopes and schedule an alignment discussion between teams.',
        };

        const llmRes = await chatJSONWithMeta<OverlapAnalysisResult>(
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          fallbackValue,
          { schema: overlapAnalysisSchema, feature: 'overlap_adjudication' }
        );

        analysis = llmRes.data;
        isFallback = llmRes.degraded;
      } else {
        isFallback = true;
        analysis = {
          verdict: similarityScore >= 0.85 ? 'NEAR_DUPLICATE' : similarityScore >= 0.75 ? 'SUBSTANTIAL_OVERLAP' : 'PARTIAL_OVERLAP',
          confidence: 65,
          overlappingFeatures: cluster.map((c) => c.name),
          sharedTechnologies: Array.from(new Set(cluster.flatMap((c) => c.technologies))),
          keyDifferences: ['Lexical analysis only (LLM key not configured)'],
          rationale: `High lexical text and technology overlap detected (${(similarityScore * 100).toFixed(1)}% TF-IDF score).`,
          recommendedAction: 'Review project scopes and verify feature overlap manually.',
        };
      }

      const domain = cluster[0]?.domain || 'General';
      const status = analysis.verdict === 'DISTINCT' ? 'SUPPRESSED' : (existingFlag?.status && existingFlag.status !== 'SUPPRESSED' ? existingFlag.status : 'OPEN');

      const flagData = {
        clusterHash,
        domain,
        severity: analysis.verdict === 'DISTINCT' ? 'PARTIAL_OVERLAP' : analysis.verdict,
        similarityScore: Number(similarityScore.toFixed(3)),
        confidence: analysis.confidence,
        overlappingFeatures: analysis.overlappingFeatures,
        sharedTechnologies: analysis.sharedTechnologies,
        keyDifferences: analysis.keyDifferences,
        rationale: analysis.rationale,
        recommendedAction: analysis.recommendedAction,
        isFallback,
        status,
      };

      if (existingFlag) {
        await prisma.$transaction([
          prisma.projectOverlapFlag.update({
            where: { id: existingFlag.id },
            data: flagData,
          }),
          prisma.projectOverlapMember.deleteMany({
            where: { flagId: existingFlag.id },
          }),
          prisma.projectOverlapMember.createMany({
            data: cluster.map((c) => ({
              flagId: existingFlag.id,
              projectId: c.projectId,
              teamId: c.teamId,
              contentHash: c.contentHash,
            })),
          }),
        ]);
        flagsUpdated++;
      } else {
        const newFlag = await prisma.projectOverlapFlag.create({
          data: flagData,
        });

        await prisma.projectOverlapMember.createMany({
          data: cluster.map((c) => ({
            flagId: newFlag.id,
            projectId: c.projectId,
            teamId: c.teamId,
            contentHash: c.contentHash,
          })),
        });
        flagsCreated++;
      }
    }

    return { flagsCreated, flagsUpdated, skippedCount };
  }
}
