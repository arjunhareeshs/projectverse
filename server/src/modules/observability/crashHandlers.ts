import { logger } from '../../shared/logger';

/**
 * Backend "crash" tracking — catches what would otherwise be a silent process
 * death or an unlogged rejected promise, and records it before exiting.
 * Node's own guidance is to exit after an uncaughtException once the state
 * may be corrupted; we log first so the observability dashboard sees it.
 */
export function registerCrashHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`, {
      source: 'process.uncaughtException',
      stack: err.stack,
    });
    // Give the async DB write a moment to flush before the process dies.
    setTimeout(() => process.exit(1), 250);
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.error(`Unhandled promise rejection: ${reason?.message || reason}`, {
      source: 'process.unhandledRejection',
      stack: reason?.stack,
    });
  });
}
