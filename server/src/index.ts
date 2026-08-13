import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { bootstrapSocket } from './infrastructure/socket';
import { logger } from './shared/logger';
import { startEvaluationScheduler } from './modules/lifecycle/evaluation.scheduler';
import { startInsightsScheduler } from './modules/insights/insights.scheduler';
import { recoverStalePendingProposals } from './modules/projects/proposal.worker';
import { getLocalNetworkIPs } from './config/network';

const app = createApp();
const httpServer = createServer(app);

bootstrapSocket(httpServer);
startEvaluationScheduler();
startInsightsScheduler();
// Proposal analysis runs in-process, so a restart mid-analysis would otherwise
// leave the submitter's proposal PENDING forever.
void recoverStalePendingProposals();

httpServer.listen(env.SERVER_PORT, () => {
  logger.info(`Server running on port ${env.SERVER_PORT}`);

  // Auto-detect and log every LAN IP so the developer always knows
  // which network addresses are reachable from other devices.
  const lanIPs = getLocalNetworkIPs();
  if (lanIPs.length > 0) {
    logger.info(`Network access (CORS auto-allowed):`);
    lanIPs.forEach((ip) => {
      logger.info(`  → http://${ip}:7333  (frontend)`);
      logger.info(`    http://${ip}:${env.SERVER_PORT}  (API)`);
    });
  } else {
    logger.info('No active LAN interfaces detected — only localhost is allowed.');
  }
});
