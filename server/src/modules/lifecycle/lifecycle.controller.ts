import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../shared/database';
import { projectLogService } from './projectLog.service';
import { dailyLogService } from './dailyLog.service';
import { intakeService } from './intake.service';
import { docGeneratorEngine } from './engines/docGenerator.engine';
import { evaluationEngine } from './engines/evaluation.engine';
import { mentorEngine } from './engines/mentor.engine';
import { renderDocPdfBuffer } from './render/docPdf';
import { renderDocMarkdown } from './render/docMarkdown';
import { persistExecutionDocNormalized } from './executionDocNormalizer';
import { intakeSchema, dailyLogSchema, durationCheckSchema, suggestMembersSchema, mentorAskSchema } from './lifecycle.schemas';
import { draftDailyLog } from './dailyLog.prefill';
import { persistBlockerEscalations } from '../metrics/blockerEscalation';
import { teamWorkload } from '../metrics/workload';
import { rescoreFeature } from '../intelligence/ideaIntelligence.service';
import { FEATURE_POINTS_CAP } from '../intelligence/ideaIntelligence.schemas';
import { notificationService } from '../notifications/notification.service';

/**
 * Access guard for project-scoped lifecycle endpoints (Overview §5).
 * Admins may access any project; students only projects whose team they belong
 * to (either as the team owner or as a ProjectMember). Returns false → 403.
 */
async function userCanAccessProject(user: any, projectId: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'FACULTY') return true;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teamId: true },
  });
  if (!project) return false;

  if (project.teamId && user.teamId && project.teamId === user.teamId) return true;

  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId: user.id },
    select: { id: true },
  });
  return Boolean(membership);
}

export class LifecycleController {
  async handleIntake(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      if (!(await userCanAccessProject((req as any).user, projectId))) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this project' });
        return;
      }
      const parsed = intakeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid intake payload', errors: parsed.error.issues });
        return;
      }
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const result = await intakeService.handleIntakeStep(projectId, actorUserId, parsed.data);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async checkDuration(req: Request, res: Response): Promise<void> {
    try {
      const parsed = durationCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid request', errors: parsed.error.flatten() });
        return;
      }
      const { months, category, title } = parsed.data;
      const result = await mentorEngine.checkDurationAdvisory(months, category, title);
      res.status(StatusCodes.OK).json(result);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async suggestMembers(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const parsed = suggestMembersSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid request', errors: parsed.error.flatten() });
        return;
      }
      const { desiredCount, requiredSkills } = parsed.data;
      const result = await mentorEngine.suggestMembers(projectId, desiredCount, requiredSkills);
      res.status(StatusCodes.OK).json(result);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async getLogState(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      if (!(await userCanAccessProject((req as any).user, projectId))) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this project' });
        return;
      }
      const state = await projectLogService.getState(projectId);
      if (!state) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Project log state not found' });
        return;
      }
      res.status(StatusCodes.OK).json(state);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      if (!(await userCanAccessProject((req as any).user, projectId))) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this project' });
        return;
      }
      const { cursor, limit, types } = req.query;
      const typeList = types ? (types as string).split(',') : undefined;
      const limitNum = limit ? parseInt(limit as string, 10) : undefined;

      const result = await projectLogService.getEvents(projectId, {
        cursor: cursor as string,
        limit: limitNum,
        types: typeList,
      });
      res.status(StatusCodes.OK).json(result);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async generateDocument(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const result = await docGeneratorEngine.generateDocument(projectId, actorUserId);
      res.status(StatusCodes.OK).json(result);
    } catch (err: any) {
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: err.message });
    }
  }

  async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const requestedVersion = req.query.version ? parseInt(req.query.version as string, 10) : undefined;

      // Always fetch all version numbers for the version selector
      const allDocs = await prisma.executionDocument.findMany({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const allVersions = allDocs.map((d) => d.version);

      // Fetch the specific version or the latest
      const doc = requestedVersion
        ? await prisma.executionDocument.findFirst({ where: { projectId, version: requestedVersion } })
        : allDocs.length > 0
          ? await prisma.executionDocument.findFirst({ where: { projectId }, orderBy: { version: 'desc' } })
          : null;

      if (!doc) {
        res.status(StatusCodes.OK).json({
          version: 0,
          doc: null,
          allVersions: [],
          generated: false,
          message: 'Execution document not generated yet',
        });
        return;
      }
      res.status(StatusCodes.OK).json({
        version: doc.version,
        doc: doc.content,
        allVersions,
        generatedAt: doc.createdAt,
      });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async saveDocument(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const { doc: newDocContent } = req.body;

      if (!newDocContent || typeof newDocContent !== 'object') {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid document content provided' });
        return;
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
        return;
      }

      const currentDoc = await prisma.executionDocument.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
      });

      const nextVersion = (currentDoc?.version || 0) + 1;
      const markdown = renderDocMarkdown(newDocContent as any, project.name);

      const savedDoc = await prisma.executionDocument.create({
        data: {
          projectId,
          version: nextVersion,
          content: newDocContent,
          markdown,
        },
      });

      await persistExecutionDocNormalized(savedDoc.id, newDocContent);

      res.status(StatusCodes.OK).json({
        version: savedDoc.version,
        doc: savedDoc.content,
        message: 'Execution document updated successfully',
      });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }


  async downloadDocument(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const format = (req.query.format as string) || 'md';
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      const doc = await prisma.executionDocument.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
      });

      if (!doc) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Execution document not generated yet' });
        return;
      }

      const sanitizeTitle = (project?.name || 'execution-plan').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const filename = `${sanitizeTitle}-v${doc.version}.${format}`;

      if (format === 'pdf') {
        const pdfBuffer = await renderDocPdfBuffer(doc.content as any, project?.name || 'Project Execution Plan');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      } else {
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(doc.markdown);
      }
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async getDailyLogDraft(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User ID required' });
        return;
      }
      if (!(await userCanAccessProject((req as any).user, projectId))) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this project' });
        return;
      }
      const dateStr = req.query.date as string | undefined;
      const date = dateStr ? new Date(dateStr) : new Date();
      const draft = await draftDailyLog(projectId, userId, date);
      res.status(StatusCodes.OK).json(draft);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async upsertDailyLog(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User ID required' });
        return;
      }
      if (!(await userCanAccessProject((req as any).user, projectId))) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this project' });
        return;
      }
      const parsed = dailyLogSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid daily log payload', errors: parsed.error.issues });
        return;
      }
      const log = await dailyLogService.upsertDailyLog(projectId, userId, parsed.data);

      // Check for persistent blockers and raise BLOCKER_ESCALATED event if needed (H2).
      // persistBlockerEscalations upserts one BlockerEscalation row per
      // (project, user, firstSeenDate) and reports isNewOrWorsened so a
      // ProjectLogEvent (and the notification it can drive) fires only when
      // the blocker is new or has recurred again — not on every daily log
      // submission from any team member while the same blocker sits unchanged,
      // which is what the previous unconditional loop did.
      try {
        const escalations = await persistBlockerEscalations(projectId);
        for (const { blocker, escalationId, isNewOrWorsened } of escalations) {
          if (!isNewOrWorsened) continue;
          await projectLogService.appendEvent(projectId, {
            type: 'BLOCKER_ESCALATED',
            actorUserId: 'SYSTEM',
            data: {
              id: `blocker-${blocker.userId}-${blocker.firstSeenDate}`,
              escalationId,
              summary: blocker.summary,
              severity: blocker.severity,
            },
          });
        }
      } catch (escErr) {
        // Blocker escalation check is best-effort
      }

      res.status(StatusCodes.OK).json(log);
    } catch (err: any) {
      if (err.message.includes('older than 2 days')) {
        res.status(StatusCodes.CONFLICT).json({ message: err.message });
        return;
      }
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async getDailyLogs(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      if (!(await userCanAccessProject((req as any).user, projectId))) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this project' });
        return;
      }
      const { from, to, userId } = req.query;
      const logs = await dailyLogService.getDailyLogs(projectId, {
        from: from as string,
        to: to as string,
        userId: userId as string,
      });
      res.status(StatusCodes.OK).json(logs);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async getWorkload(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      if (!(await userCanAccessProject((req as any).user, projectId))) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this project' });
        return;
      }
      const workload = await teamWorkload(projectId);
      res.status(StatusCodes.OK).json(workload);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async runEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const { cycle } = req.body;
      const result = await evaluationEngine.runEvaluationCycle(projectId, cycle ? parseInt(cycle, 10) : undefined);
      res.status(StatusCodes.OK).json(result);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async getEvaluations(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const reports = await prisma.evaluationReport.findMany({
        where: { projectId },
        orderBy: { cycle: 'desc' },
        select: {
          id: true,
          cycle: true,
          periodStart: true,
          periodEnd: true,
          createdAt: true,
          content: true,
        },
      });

      const summaries = reports.map((r) => {
        const c: any = r.content;
        return {
          id: r.id,
          cycle: r.cycle,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          authenticity: c?.authenticityConfidence?.score || 0,
          plagiarismRisk: c?.plagiarismRisk || 'LOW',
          overall: Math.round(
            ((c?.scopeAdherence?.score || 0) +
              (c?.technicalProgress?.score || 0) +
              (c?.timelineCompliance?.score || 0) +
              (c?.memberParticipation?.score || 0) +
              (c?.documentationQuality?.score || 0) +
              (c?.authenticityConfidence?.score || 0)) / 6,
          ),
          createdAt: r.createdAt,
        };
      });

      res.status(StatusCodes.OK).json(summaries);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async getEvaluationById(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const reportId = req.params.reportId as string;
      const report = await prisma.evaluationReport.findFirst({
        where: { id: reportId, projectId },
      });
      if (!report) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Evaluation report not found' });
        return;
      }
      res.status(StatusCodes.OK).json(report);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async getMentorStatus(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const status = await mentorEngine.getMentorStatus(projectId);
      res.status(StatusCodes.OK).json(status);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async askMentor(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const parsed = mentorAskSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid request', errors: parsed.error.flatten() });
        return;
      }
      const answer = await mentorEngine.askMentor(projectId, parsed.data.question);
      res.status(StatusCodes.OK).json({ answer });
    } catch (err: any) {
      res.status(StatusCodes.OK).json({ answer: 'AI mentor is not configured or encountered an error.' });
    }
  }


  async updateWorkPackageStatus(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const wpId = req.params.wpId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const { status } = req.body;
      const result = await projectLogService.updateWorkPackageStatus(projectId, wpId, status, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async assignWorkPackage(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const wpId = req.params.wpId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const { assignedTo } = req.body;
      const result = await projectLogService.assignWorkPackage(projectId, wpId, assignedTo, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async updateMilestoneStatus(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const msId = req.params.msId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const { status } = req.body;
      const result = await projectLogService.updateMilestoneStatus(projectId, msId, status, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async changeDeadline(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const msId = req.params.msId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const { dueDate, reason } = req.body;
      const result = await projectLogService.changeDeadline(projectId, msId, dueDate, reason, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async resolveFlag(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const flagId = req.params.flagId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const { note } = req.body;
      const result = await projectLogService.resolveFlag(projectId, flagId, actorUserId, note);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async addManualNote(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const { note } = req.body;
      const result = await projectLogService.addManualNote(projectId, note, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const { userId, name } = req.body;
      const result = await projectLogService.addMember(projectId, userId, name, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const userId = req.params.userId as string;
      const actorUserId = (req as any).user?.id || 'SYSTEM';
      const result = await projectLogService.removeMember(projectId, userId, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, state: result });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async uploadAsset(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'No image file uploaded' });
        return;
      }

      const assetsDir = path.join(__dirname, '../../../uploads/assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const uniqueName = `asset-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
      const filePath = path.join(assetsDir, uniqueName);
      fs.writeFileSync(filePath, file.buffer);

      const url = `/uploads/assets/${uniqueName}`;
      res.status(StatusCodes.CREATED).json({ success: true, url, fileName: file.originalname });
    } catch (err: any) {
      console.error('Asset upload error:', err);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  // ── Features ──────────────────────────────────────────────────────────────

  async getFeatures(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const features = await prisma.projectFeature.findMany({
        where: { projectId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      const total = features.reduce((sum, f) => sum + f.points, 0);
      res.status(StatusCodes.OK).json({ features, totalPoints: total, capPoints: FEATURE_POINTS_CAP });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async addFeature(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const userId = (req as any).user?.id || 'SYSTEM';
      const { name, description, implementationMethod } = req.body;

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
        return;
      }

      const existing = await prisma.projectFeature.findMany({
        where: { projectId, status: 'ACTIVE' },
        select: { id: true, name: true, description: true, points: true },
      });

      const scored = await rescoreFeature({
        problemStatement: project.problemStatement || '',
        projectType: project.type,
        existingFeatures: existing,
        proposed: { name, description, implementationMethod },
      });

      const created = await prisma.projectFeature.create({
        data: {
          projectId,
          name,
          description,
          implementationMethod,
          importance: scored.importance,
          points: scored.points,
          aiRationale: scored.aiRationale,
          addedBy: userId,
        },
      });

      await projectLogService.appendEvent(projectId, {
        type: 'FEATURE_ADDED',
        actorUserId: userId,
        data: { featureId: created.id, name: created.name, points: created.points },
      });

      res.status(StatusCodes.CREATED).json({ feature: created, budgetClamped: scored.budgetClamped, duplicateOfFeatureId: scored.duplicateOfFeatureId });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async updateFeature(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const featureId = req.params.featureId as string;
      const userId = (req as any).user?.id || 'SYSTEM';

      const feature = await prisma.projectFeature.findFirst({ where: { id: featureId, projectId, status: 'ACTIVE' } });
      if (!feature) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Feature not found' });
        return;
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
        return;
      }

      const name = req.body.name ?? feature.name;
      const description = req.body.description ?? feature.description;
      const implementationMethod = req.body.implementationMethod ?? feature.implementationMethod ?? '';

      const otherActive = await prisma.projectFeature.findMany({
        where: { projectId, status: 'ACTIVE', id: { not: featureId } },
        select: { id: true, name: true, description: true, points: true },
      });

      const scored = await rescoreFeature({
        problemStatement: project.problemStatement || '',
        projectType: project.type,
        existingFeatures: otherActive,
        proposed: { name, description, implementationMethod },
      });

      const updated = await prisma.projectFeature.update({
        where: { id: featureId },
        data: {
          name,
          description,
          implementationMethod,
          importance: scored.importance,
          points: scored.points,
          aiRationale: scored.aiRationale,
        },
      });

      await projectLogService.appendEvent(projectId, {
        type: 'FEATURE_UPDATED',
        actorUserId: userId,
        data: { featureId: updated.id, name: updated.name, points: updated.points },
      });

      res.status(StatusCodes.OK).json({ feature: updated, budgetClamped: scored.budgetClamped, duplicateOfFeatureId: scored.duplicateOfFeatureId });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async removeFeature(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const featureId = req.params.featureId as string;
      const userId = (req as any).user?.id || 'SYSTEM';

      const feature = await prisma.projectFeature.findFirst({ where: { id: featureId, projectId, status: 'ACTIVE' } });
      if (!feature) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Feature not found' });
        return;
      }

      await prisma.projectFeature.update({ where: { id: featureId }, data: { status: 'REMOVED' } });

      await projectLogService.appendEvent(projectId, {
        type: 'FEATURE_REMOVED',
        actorUserId: userId,
        data: { featureId, name: feature.name },
      });

      res.status(StatusCodes.OK).json({ success: true });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  // ── Phases ────────────────────────────────────────────────────────────────

  async getPhases(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const phases = await prisma.projectPhase.findMany({
        where: { projectId },
        orderBy: { phaseNumber: 'asc' },
        include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      res.status(StatusCodes.OK).json({ phases });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  }

  async updatePhase(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const phaseId = req.params.phaseId as string;
      const userId = (req as any).user?.id || 'SYSTEM';
      const { title, expectedDeliverables, weekTarget, points, reason } = req.body as {
        title?: string;
        expectedDeliverables?: string;
        weekTarget?: number;
        points?: number;
        reason?: string;
      };

      const phase = await prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } });
      if (!phase) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Phase not found' });
        return;
      }

      // Once a phase has been submitted/reviewed, editing its target
      // retroactively would undermine that review — only PLANNED phases
      // (not yet acted on) can be edited.
      if (phase.status !== 'PLANNED') {
        res.status(StatusCodes.CONFLICT).json({
          message: `Phase ${phase.phaseNumber} is ${phase.status.toLowerCase()} and can no longer be edited.`,
        });
        return;
      }

      if (points !== undefined) {
        // Mirrors the soft cap generatePhasePlan itself enforces at creation
        // time (Math.max(featureTotal * 2.5, 500)) — re-derived here so an
        // edit can't push the project's total phase points past what the
        // feature scope actually supports.
        const [otherPhases, features] = await Promise.all([
          prisma.projectPhase.findMany({ where: { projectId, id: { not: phaseId } }, select: { points: true } }),
          prisma.projectFeature.findMany({ where: { projectId, status: 'ACTIVE' }, select: { points: true } }),
        ]);
        const featureTotal = features.reduce((sum, f) => sum + f.points, 0);
        const softCap = Math.max(featureTotal * 2.5, 500);
        const otherTotal = otherPhases.reduce((sum, p) => sum + p.points, 0);
        if (otherTotal + points > softCap) {
          res.status(StatusCodes.BAD_REQUEST).json({
            message: `Points exceed the project's phase budget (${Math.round(softCap)} total across all phases).`,
          });
          return;
        }
      }

      const updated = await prisma.projectPhase.update({
        where: { id: phaseId },
        data: {
          ...(title !== undefined && { title }),
          ...(expectedDeliverables !== undefined && { expectedDeliverables }),
          ...(weekTarget !== undefined && { weekTarget }),
          ...(points !== undefined && { points }),
        },
      });

      await projectLogService.appendEvent(projectId, {
        type: 'PHASE_UPDATED',
        actorUserId: userId,
        data: {
          phaseId,
          phaseNumber: phase.phaseNumber,
          changes: { title, expectedDeliverables, weekTarget, points },
          reason: reason || null,
        },
      });

      res.status(StatusCodes.OK).json({ phase: updated });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async submitPhase(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const phaseId = req.params.phaseId as string;
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User ID required' });
        return;
      }
      const { submissionNote, evidenceUrls } = req.body;

      const phase = await prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } });
      if (!phase) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Phase not found' });
        return;
      }
      if (phase.status === 'APPROVED') {
        res.status(StatusCodes.CONFLICT).json({ message: 'This phase has already been approved' });
        return;
      }

      const [submission] = await prisma.$transaction([
        prisma.phaseSubmission.create({
          data: {
            phaseId,
            projectId,
            submittedById: userId,
            submissionNote,
            evidenceUrls: evidenceUrls || [],
            status: 'PENDING',
          },
        }),
        prisma.projectPhase.update({ where: { id: phaseId }, data: { status: 'SUBMITTED' } }),
      ]);

      await projectLogService.appendEvent(projectId, {
        type: 'PHASE_SUBMITTED',
        actorUserId: userId,
        data: { phaseId, phaseNumber: phase.phaseNumber, submissionId: submission.id },
      });

      try {
        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true, name: true } });
        if (project?.organizationId) {
          const reviewers = await prisma.user.findMany({
            where: { organizationId: project.organizationId, role: { in: ['ADMIN', 'FACULTY'] } },
            select: { id: true },
          });
          await Promise.all(
            reviewers.map((r) =>
              notificationService.createForUser(
                r.id,
                'Phase submitted for review',
                `${project.name || 'A project'} submitted Phase ${phase.phaseNumber} ("${phase.title}") for review.`,
              ),
            ),
          );
        }
      } catch (notifyErr) {
        // Notification is best-effort
      }

      res.status(StatusCodes.CREATED).json({ submission, phaseStatus: 'SUBMITTED' });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }

  async reviewPhase(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.projectId as string;
      const phaseId = req.params.phaseId as string;
      const reviewerId = (req as any).user?.id;
      if (!reviewerId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User ID required' });
        return;
      }
      const { decision, reviewNote } = req.body as { decision: 'APPROVED' | 'CHANGES_REQUESTED'; reviewNote?: string };

      const phase = await prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } });
      if (!phase) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Phase not found' });
        return;
      }
      const submission = await prisma.phaseSubmission.findFirst({
        where: { phaseId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      if (!submission) {
        res.status(StatusCodes.CONFLICT).json({ message: 'No pending submission for this phase' });
        return;
      }

      if (decision === 'CHANGES_REQUESTED') {
        await prisma.$transaction([
          prisma.phaseSubmission.update({
            where: { id: submission.id },
            data: { status: 'CHANGES_REQUESTED', reviewedById: reviewerId, reviewNote, reviewedAt: new Date() },
          }),
          prisma.projectPhase.update({ where: { id: phaseId }, data: { status: 'CHANGES_REQUESTED' } }),
        ]);

        await projectLogService.appendEvent(projectId, {
          type: 'PHASE_CHANGES_REQUESTED',
          actorUserId: reviewerId,
          data: { phaseId, phaseNumber: phase.phaseNumber, reviewNote: reviewNote || '' },
        });

        try {
          const members = await prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } });
          await Promise.all(
            members.map((m) =>
              notificationService.createForUser(
                m.userId,
                'Phase changes requested',
                `Phase ${phase.phaseNumber} ("${phase.title}") needs changes: ${reviewNote || 'See reviewer notes.'}`,
              ),
            ),
          );
        } catch {
          // best-effort
        }

        res.status(StatusCodes.OK).json({ success: true, status: 'CHANGES_REQUESTED' });
        return;
      }

      // APPROVED — this is the only place reward points are ever credited to
      // User.rewardPoints for phase work. Points come from phase.points (server
      // state, computed at generation time), never from the request body.
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      const executionDoc = await prisma.executionDocument.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { content: true },
      });
      const teamShare = (executionDoc?.content as any)?.teamShare as
        | Array<{ userId: string; sharePercent: number }>
        | undefined;

      const members = await prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } });
      let splits: Array<{ userId: string; points: number }>;

      if (teamShare && teamShare.length > 0) {
        const totalShare = teamShare.reduce((sum, m) => sum + (m.sharePercent || 0), 0) || 100;
        splits = teamShare.map((m) => ({
          userId: m.userId,
          points: Math.round(phase.points * ((m.sharePercent || 0) / totalShare)),
        }));
      } else if (members.length > 0) {
        const equalShare = Math.floor(phase.points / members.length);
        splits = members.map((m, idx) => ({
          userId: m.userId,
          points: idx === members.length - 1 ? phase.points - equalShare * (members.length - 1) : equalShare,
        }));
      } else {
        splits = [];
      }

      await prisma.$transaction(async (tx) => {
        await tx.phaseSubmission.update({
          where: { id: submission.id },
          data: { status: 'APPROVED', reviewedById: reviewerId, reviewNote, reviewedAt: new Date() },
        });
        await tx.projectPhase.update({ where: { id: phaseId }, data: { status: 'APPROVED' } });

        for (const split of splits) {
          if (split.points <= 0) continue;
          await tx.user.update({
            where: { id: split.userId },
            data: { rewardPoints: { increment: split.points } },
          });
          await tx.rewardTransaction.create({
            data: {
              userId: split.userId,
              projectId,
              source: 'PHASE_APPROVAL',
              sourceRefId: submission.id,
              points: split.points,
              note: `Phase ${phase.phaseNumber} approved: ${phase.title}`,
            },
          });
        }
      });

      await projectLogService.appendEvent(projectId, {
        type: 'PHASE_APPROVED',
        actorUserId: reviewerId,
        data: { phaseId, phaseNumber: phase.phaseNumber, pointsAwarded: phase.points, splits },
      });

      try {
        await Promise.all(
          splits.map((s) =>
            notificationService.createForUser(
              s.userId,
              'Phase approved!',
              `Phase ${phase.phaseNumber} ("${phase.title}") of ${project?.name || 'your project'} was approved — +${s.points} pts awarded.`,
            ),
          ),
        );
      } catch {
        // best-effort
      }

      res.status(StatusCodes.OK).json({ success: true, status: 'APPROVED', splits });
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  }
}

export const lifecycleController = new LifecycleController();

