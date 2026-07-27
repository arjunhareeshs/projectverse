import cron from 'node-cron';
import { prisma } from '../../shared/database';
import { logger } from '../../shared/logger';
import { evaluationEngine } from './engines/evaluation.engine';

export function startEvaluationScheduler() {
  // Run daily at 01:00 AM
  cron.schedule('0 1 * * *', async () => {
    logger.info('[EvaluationScheduler] Running daily 15-day project evaluation check...');
    try {
      const activeProjects = await prisma.project.findMany({
        where: {
          projectLog: { isNot: null },
        },
        include: {
          projectLog: true,
          evaluationReports: { select: { cycle: true } },
        },
      });

      for (const project of activeProjects) {
        if (!project.projectLog) continue;
        const state = project.projectLog.state as any;
        if (!state?.duration?.startDate) continue;

        const startDate = new Date(state.duration.startDate);
        const now = new Date();
        const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysElapsed <= 0) continue;

        const currentCycleNeeded = Math.floor(daysElapsed / 15);
        if (currentCycleNeeded < 1) continue;

        const existingCycles = new Set(project.evaluationReports.map((r) => r.cycle));

        for (let cycle = 1; cycle <= currentCycleNeeded; cycle++) {
          if (!existingCycles.has(cycle)) {
            logger.info(`[EvaluationScheduler] Executing missing cycle #${cycle} for project ${project.id} (${project.name})`);
            await evaluationEngine.runEvaluationCycle(project.id, cycle);
          }
        }
      }
    } catch (err: any) {
      logger.error('[EvaluationScheduler] Error running daily evaluation check:', { message: err.message });
    }
  });
}
