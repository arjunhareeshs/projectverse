import { prisma } from '../shared/database';
import { projectLogService } from '../modules/lifecycle/projectLog.service';

async function main() {
  console.log('[Backfill] Backfilling ProjectLog records for active projects...');
  const projects = await prisma.project.findMany({
    where: {
      projectLog: null,
    },
    include: {
      team: true,
    },
  });

  console.log(`[Backfill] Found ${projects.length} projects without a ProjectLog.`);

  for (const project of projects) {
    console.log(`[Backfill] Initializing ProjectLog for project: ${project.name} (${project.id})`);
    await projectLogService.initLog(project.id, {
      title: project.name,
      category: (project.category as any) || 'FINAL_YEAR',
      teamId: project.teamId || undefined,
    });

    await projectLogService.appendEvent(project.id, {
      type: 'MANUAL_NOTE',
      actorUserId: 'SYSTEM',
      data: { action: 'backfill' },
      note: 'Backfilled canonical ProjectLog state for existing project.',
    });
  }

  console.log('[Backfill] Backfill completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Backfill] Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
