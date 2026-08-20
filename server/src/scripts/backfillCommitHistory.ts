import { prisma } from '../shared/database';
import { logger } from '../shared/logger';
import { githubService } from '../modules/github/github.service';

async function main() {
  logger.info('Starting GitHub commit history backfill...');

  const repos = await prisma.githubRepository.findMany({
    select: {
      id: true,
      owner: true,
      repository: true,
      projectId: true,
    },
  });

  logger.info(`Found ${repos.length} repositories to backfill.`);

  let totalSynced = 0;
  let successCount = 0;
  let failCount = 0;

  for (const repo of repos) {
    try {
      logger.info(`Backfilling commits for ${repo.owner}/${repo.repository} (repoId: ${repo.id})...`);
      const count = await githubService.syncCommitHistory(repo.id, repo.owner, repo.repository, 20);
      totalSynced += count;
      successCount++;
      logger.info(`Synced ${count} commits for ${repo.owner}/${repo.repository}.`);
    } catch (err: any) {
      failCount++;
      logger.error(`Failed to backfill ${repo.owner}/${repo.repository}: ${err?.message}`);
    }
  }

  // Check attribution statistics
  const totalCommitsInDb = await prisma.githubCommit.count();
  const attributedCommitsInDb = await prisma.githubCommit.count({
    where: { linkedUserId: { not: null } },
  });

  const rate = totalCommitsInDb > 0 ? ((attributedCommitsInDb / totalCommitsInDb) * 100).toFixed(1) : '0';

  logger.info('GitHub commit history backfill complete!', {
    repositoriesProcessed: repos.length,
    successfulRepos: successCount,
    failedRepos: failCount,
    commitsProcessedThisRun: totalSynced,
    totalCommitsInDb,
    attributedCommitsInDb,
    attributionPercentage: `${rate}%`,
  });
}

main()
  .catch((e) => {
    logger.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
