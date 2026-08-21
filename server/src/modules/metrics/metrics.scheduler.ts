import cron from 'node-cron';
import { prisma } from '../../shared/database';
import { logger } from '../../shared/logger';
import { buildRiskInputForProject } from './riskInputBuilder';
import { computeAndPersistProjectRisk } from './riskModel';
import { resolvePendingInterventions } from './intervention';
import {
  onboardingFunnel,
  formationHealth,
  earlyWarningBoard,
  catalogDemand,
  cohortRoiReport,
  snapshotCohortReport,
} from './cohortMetrics';

const ACTIVE_PROJECT_STATUSES = ['active', 'pending_approval', 'planned'];

/**
 * Nightly: computes and persists a ProjectRiskScore for every project that
 * has run intake (has a ProjectLog), then resolves any Intervention whose
 * 14-day follow-up window has elapsed. Tracked as a MetricComputeRun so
 * failures and run history are visible the same way InsightsRun tracks the
 * insights pipeline, instead of only ever existing in server logs.
 */
export async function runRiskScoringPipeline(): Promise<{
  subjectsProcessed: number;
  snapshotsWritten: number;
  interventionsResolved: number;
}> {
  const run = await prisma.metricComputeRun.create({
    data: { kind: 'RISK', status: 'RUNNING' },
  });

  let subjectsProcessed = 0;
  let snapshotsWritten = 0;

  try {
    const projects = await prisma.project.findMany({
      where: {
        isTemplate: false,
        status: { in: ACTIVE_PROJECT_STATUSES },
        projectLog: { isNot: null },
      },
      select: { id: true, name: true },
    });

    for (const project of projects) {
      subjectsProcessed++;
      try {
        const input = await buildRiskInputForProject(project.id);
        await computeAndPersistProjectRisk(project.id, input, run.id);
        snapshotsWritten++;
      } catch (perProjectErr: any) {
        logger.error(`[MetricsScheduler] Risk scoring failed for project ${project.id} (${project.name}):`, {
          message: perProjectErr.message,
        });
      }
    }

    const { resolved: interventionsResolved } = await resolvePendingInterventions();

    await prisma.metricComputeRun.update({
      where: { id: run.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), subjectsProcessed, snapshotsWritten },
    });

    return { subjectsProcessed, snapshotsWritten, interventionsResolved };
  } catch (err: any) {
    await prisma.metricComputeRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), subjectsProcessed, snapshotsWritten, errorMessage: err.message },
    });
    throw err;
  }
}

/**
 * Weekly: computes the six org-wide cohort reports (the same functions
 * admin.service.ts calls on-demand for the Admin analytics pages) and
 * persists each as a CohortMetricSnapshot per organization, so cohort trend
 * over time is queryable instead of only ever existing as a point-in-time
 * cache hit. This is the scheduled counterpart to admin.service.ts's
 * request-time snapshotInBackground calls — it ensures a snapshot exists
 * even for organizations whose admin never opens the analytics pages.
 */
export async function runCohortSnapshotPipeline(): Promise<{ organizationsProcessed: number }> {
  const run = await prisma.metricComputeRun.create({
    data: { kind: 'COHORT', status: 'RUNNING' },
  });

  let organizationsProcessed = 0;

  try {
    const organizations = await prisma.organization.findMany({ select: { id: true } });

    for (const org of organizations) {
      organizationsProcessed++;
      try {
        const [funnel, formation, warning, demand, roi] = await Promise.all([
          onboardingFunnel(org.id),
          formationHealth(org.id),
          earlyWarningBoard(org.id),
          catalogDemand(org.id),
          cohortRoiReport(org.id),
        ]);

        await Promise.all([
          snapshotCohortReport(org.id, 'ONBOARDING_FUNNEL', funnel, { computeRunId: run.id }),
          snapshotCohortReport(org.id, 'FORMATION_HEALTH', formation, { computeRunId: run.id }),
          snapshotCohortReport(org.id, 'EARLY_WARNING', warning, { computeRunId: run.id }),
          snapshotCohortReport(org.id, 'CATALOG_DEMAND', demand, { computeRunId: run.id }),
          snapshotCohortReport(org.id, 'ROI', roi, { computeRunId: run.id }),
        ]);
      } catch (perOrgErr: any) {
        logger.error(`[MetricsScheduler] Cohort snapshot failed for organization ${org.id}:`, { message: perOrgErr.message });
      }
    }

    await prisma.metricComputeRun.update({
      where: { id: run.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), subjectsProcessed: organizationsProcessed },
    });

    return { organizationsProcessed };
  } catch (err: any) {
    await prisma.metricComputeRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), subjectsProcessed: organizationsProcessed, errorMessage: err.message },
    });
    throw err;
  }
}

export function startMetricsScheduler(): void {
  // Nightly at 03:00 AM — after the 01:00 evaluation cron and 02:30 insights
  // cron, so risk scoring can see the freshest evaluation/insight data.
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await runRiskScoringPipeline();
      logger.info('[MetricsScheduler] Nightly risk scoring complete:', result);
    } catch (err: any) {
      logger.error('[MetricsScheduler] Nightly risk scoring failed:', { message: err.message });
    }
  });

  // Weekly, Sunday at 04:00 AM.
  cron.schedule('0 4 * * 0', async () => {
    try {
      const result = await runCohortSnapshotPipeline();
      logger.info('[MetricsScheduler] Weekly cohort snapshot complete:', result);
    } catch (err: any) {
      logger.error('[MetricsScheduler] Weekly cohort snapshot failed:', { message: err.message });
    }
  });

  logger.info('[MetricsScheduler] Scheduled nightly risk scoring (03:00) and weekly cohort snapshots (Sun 04:00)');
}
