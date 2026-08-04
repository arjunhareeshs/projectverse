import crypto from 'crypto';
import { prisma } from '../../../shared/database';

export interface ProjectDocument {
  projectId: string;
  teamId: string | null;
  domain: string;
  name: string;
  problemStatement: string | null;
  objective: string | null;
  technologies: string[];
  hardwareComponents: string[];
  weightedText: string;
  contentHash: string;
  workPackageTitles: string[];
  milestoneTitles: string[];
  differentiationApproach: string | null;
}

export async function buildProjectCorpus(): Promise<ProjectDocument[]> {
  const projects = await prisma.project.findMany({
    where: {
      isTemplate: false,
      teamId: { not: null },
    },
    include: {
      team: { select: { id: true, domain: true, name: true } },
      githubRepo: { select: { topics: true, language: true } },
      projectLog: { select: { state: true } },
      dailyWorkLogs: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // last 60 days
          },
        },
        select: { workDone: true },
      },
    },
  });

  const docs: ProjectDocument[] = [];

  for (const p of projects) {
    const textSegments: string[] = [];

    // ×3 weight
    const x3Fields = [p.problemStatement, p.objective, p.soul, p.expectedOutcome];
    for (const f of x3Fields) {
      if (f && f.trim()) {
        const text = f.trim();
        textSegments.push(text, text, text);
      }
    }

    // ×2 weight
    const x2Fields = [
      p.name,
      p.shortName,
      p.description,
      p.innovation,
      p.requirements,
      p.targetUsers,
      p.differentiationApproach,
    ];
    for (const f of x2Fields) {
      if (f && f.trim()) {
        const text = f.trim();
        textSegments.push(text, text);
      }
    }

    // Work-package + milestone titles/descriptions from ProjectLog.state (x2 weight)
    const workPackageTitles: string[] = [];
    const milestoneTitles: string[] = [];
    if (p.projectLog?.state && typeof p.projectLog.state === 'object') {
      const stateObj = p.projectLog.state as any;
      if (Array.isArray(stateObj.workPackages)) {
        for (const wp of stateObj.workPackages) {
          if (wp.title) {
            workPackageTitles.push(wp.title);
            textSegments.push(wp.title, wp.title);
          }
          if (wp.description) {
            textSegments.push(wp.description, wp.description);
          }
        }
      }
      if (Array.isArray(stateObj.milestones)) {
        for (const m of stateObj.milestones) {
          if (m.title) {
            milestoneTitles.push(m.title);
            textSegments.push(m.title, m.title);
          }
          if (m.description) {
            textSegments.push(m.description, m.description);
          }
        }
      }
    }

    // ×1 weight
    const x1Arrays = [
      p.technologies,
      p.skillsGained,
      p.hardwareComponents,
      p.differentiationKeywords,
      p.githubRepo?.topics || [],
    ];
    for (const arr of x1Arrays) {
      if (Array.isArray(arr) && arr.length > 0) {
        textSegments.push(arr.join(' '));
      }
    }
    if (p.githubRepo?.language) {
      textSegments.push(p.githubRepo.language);
    }
    for (const log of p.dailyWorkLogs) {
      if (log.workDone && log.workDone.trim()) {
        textSegments.push(log.workDone.trim());
      }
    }

    const weightedText = textSegments.join(' ');
    const contentHash = crypto.createHash('sha256').update(weightedText).digest('hex');

    docs.push({
      projectId: p.id,
      teamId: p.teamId,
      domain: (p.domain && p.domain.trim()) ? p.domain.trim() : ((p.team?.domain && p.team.domain.trim()) ? p.team.domain.trim() : 'General'),
      name: p.name,
      problemStatement: p.problemStatement,
      objective: p.objective,
      technologies: p.technologies || [],
      hardwareComponents: p.hardwareComponents || [],
      weightedText,
      contentHash,
      workPackageTitles,
      milestoneTitles,
      differentiationApproach: p.differentiationApproach,
    });
  }

  return docs;
}
