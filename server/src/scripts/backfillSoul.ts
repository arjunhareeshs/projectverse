import { prisma } from '../shared/database';

async function backfillSoul() {
  console.log('Starting backfill for Project.soul...');
  const templates = await prisma.project.findMany({
    where: {
      isTemplate: true,
      status: 'CATALOG',
      soul: null,
    },
    select: {
      id: true,
      name: true,
      problemStatement: true,
      description: true,
    },
  });

  console.log(`Found ${templates.length} catalog templates missing soul.`);
  let count = 0;

  for (const t of templates) {
    const rawText = t.problemStatement || t.description || '';
    if (!rawText) continue;

    // Extract first sentence up to punctuation (. ! ?) or line break
    const sentenceMatch = rawText.match(/^.*?[.!?](?:\s|$)/);
    let soul = sentenceMatch ? sentenceMatch[0].trim() : rawText.trim();
    if (soul.length > 180) {
      soul = soul.slice(0, 177) + '...';
    }

    if (soul) {
      await prisma.project.update({
        where: { id: t.id },
        data: { soul },
      });
      count++;
    }
  }

  console.log(`Successfully updated ${count} project templates with soul.`);
}

backfillSoul()
  .catch((err) => {
    console.error('Error during soul backfill:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
