import cron from 'node-cron';
import { OverlapService } from './overlap/overlap.service';
import { StandoutService } from './standout/standout.service';
import { OpportunityService } from '../recommendation/opportunity.service';
import { withLock } from '../../shared/redis';

let isRunning = false;
let lastRunAt: Date | null = null;
let lastRunStats: any = null;

export async function runInsightsPipeline(scope: 'overlap' | 'standout' | 'recommendation' | 'all' = 'all'): Promise<{
  running: boolean;
  lastRunAt: Date | null;
  stats: any;
}> {
  if (isRunning) {
    return { running: true, lastRunAt, stats: lastRunStats };
  }

  isRunning = true;
  try {
    console.info(`[Insights] Starting insights computation pipeline (scope: ${scope})...`);
    let overlapStats = null;
    let standoutStats = null;
    let recommendationStats = null;

    if (scope === 'overlap' || scope === 'all') {
      overlapStats = await OverlapService.runOverlapDetection();
      console.info('[Insights] Overlap detection complete:', overlapStats);
    }

    if (scope === 'standout' || scope === 'all') {
      standoutStats = await StandoutService.runStandoutDetection();
      console.info('[Insights] Standout detection complete:', standoutStats);
    }

    if (scope === 'recommendation' || scope === 'all') {
      // Runs after standout detection so EvaluationReport data is fresh
      recommendationStats = await OpportunityService.runOpportunityMatching();
      console.info('[Insights] Opportunity matching complete:', recommendationStats);
    }

    lastRunAt = new Date();
    lastRunStats = { overlapStats, standoutStats, recommendationStats };
    return { running: false, lastRunAt, stats: lastRunStats };
  } catch (err: any) {
    console.error('[Insights] Pipeline error:', err);
    throw err;
  } finally {
    isRunning = false;
  }
}

export function startInsightsScheduler(): void {
  // Daily at 02:30 AM (after 01:00 AM evaluation cron)
  cron.schedule('30 2 * * *', () => withLock('cron:insights', 60 * 60_000, async () => {
    try {
      await runInsightsPipeline('all');
    } catch (err) {
      console.error('[InsightsScheduler] Daily cron execution failed:', err);
    }
  }));
  console.info('[InsightsScheduler] Scheduled daily insights pipeline cron (02:30 AM)');
}

export function getInsightsStatus() {
  return {
    isRunning,
    lastRunAt,
    lastRunStats,
  };
}
