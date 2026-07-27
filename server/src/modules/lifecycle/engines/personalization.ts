import { prisma } from '../../../shared/database';
import { wordOverlapRatio } from '../../../shared/stringUtils';
import { chatJSON, isLlmConfigured } from '../../ai/llm.service';
import { buildPersonalizationPrompt } from '../prompts/personalization.prompt';

export class PersonalizationEngine {
  async getVariationDirectives(projectId: string, planningCtx: any): Promise<any | null> {
    // Retrieve other execution documents in same domain/category
    const otherDocs = await prisma.executionDocument.findMany({
      where: {
        projectId: { not: projectId },
      },
      include: {
        project: {
          select: { id: true, name: true, problemStatement: true, domain: true, category: true },
        },
      },
      take: 20,
    });

    const candidates = otherDocs
      .map((doc) => {
        const p = doc.project;
        if (!p) return null;
        const titleOverlap = wordOverlapRatio(planningCtx.title, p.name);
        const problemOverlap = wordOverlapRatio(planningCtx.title, p.problemStatement || '');
        const overlap = Math.max(titleOverlap, problemOverlap);
        return overlap > 0.45 ? { doc, overlap } : null;
      })
      .filter((c): c is { doc: (typeof otherDocs)[number]; overlap: number } => c !== null)
      .sort((a, b) => b.overlap - a.overlap)
      .map((c) => c.doc);

    if (candidates.length === 0) {
      return null;
    }

    const top3 = candidates.slice(0, 3).map((c) => ({
      title: c.project.name,
      overview: (c.content as any)?.overview,
      workPackages: (c.content as any)?.workBreakdown?.map((w: any) => w.name),
    }));

    if (!isLlmConfigured()) {
      // Deterministic fallback per project ID
      const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const dimensions = ['target dataset', 'deployment hardware', 'evaluation metrics'];
      return {
        dimensionsToVary: dimensions,
        directives: [
          `Vary the dataset source relative to existing team implementations (Variant #${hash % 10}).`,
          `Target a distinct edge deployment platform or validation metric.`,
        ],
        summaryOfSimilarProjects: `Found ${candidates.length} similar existing project documents. Derived deterministic variation.`,
      };
    }

    const prompt = buildPersonalizationPrompt(planningCtx, top3);
    const fallback = {
      dimensionsToVary: ['dataset', 'evaluation methodology'],
      directives: ['Use a custom benchmark dataset and different baseline metrics.'],
      summaryOfSimilarProjects: 'Resembles existing project templates; applied core variation directives.',
    };

    return chatJSON(prompt, fallback);
  }
}

export const personalizationEngine = new PersonalizationEngine();
