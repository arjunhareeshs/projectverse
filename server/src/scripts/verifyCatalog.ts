import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED_TOTAL = 1436;
const EXPECTED_DOMAINS = 26;
const EXPECTED_TYPE_COUNTS: Record<string, number> = {
  Software: 1034,
  Hardware: 311,
  'Hardware & Software': 91,
};

async function verify() {
  let failures = 0;
  const fail = (msg: string) => {
    failures++;
    console.error(`❌ ${msg}`);
  };
  const pass = (msg: string) => console.log(`✅ ${msg}`);

  const total = await prisma.project.count({ where: { isTemplate: true, status: 'CATALOG' } });
  if (total >= EXPECTED_TOTAL) {
    pass(`Catalog has ${total} templates (>= ${EXPECTED_TOTAL} expected)`);
  } else {
    fail(`Catalog has ${total} templates, expected >= ${EXPECTED_TOTAL}`);
  }

  const byDomain = await prisma.project.groupBy({
    by: ['domain'],
    where: { isTemplate: true, status: 'CATALOG' },
    _count: true,
  });
  if (byDomain.length >= EXPECTED_DOMAINS) {
    pass(`Found ${byDomain.length} distinct domains (>= ${EXPECTED_DOMAINS} expected)`);
  } else {
    fail(`Found only ${byDomain.length} distinct domains, expected >= ${EXPECTED_DOMAINS}`);
  }

  const rogueLeftover = await prisma.project.count({
    where: {
      isTemplate: true,
      status: 'CATALOG',
      domain: { in: ['AI', 'General'] },
      sector: 'Technology',
    },
  });
  if (rogueLeftover === 0) {
    pass('No rogue AI/General + Technology rows remain');
  } else {
    fail(`${rogueLeftover} rogue AI/General + Technology row(s) still present`);
  }

  const byType = await prisma.project.groupBy({
    by: ['type'],
    where: { isTemplate: true, status: 'CATALOG' },
    _count: true,
  });
  const typeCounts: Record<string, number> = {};
  for (const t of byType) typeCounts[t.type || 'null'] = t._count;

  // >= rather than === : the catalog grows over time as teams propose new
  // problem statements through the chat flow, so exact equality against the
  // one-time Excel-import baseline would break the moment that feature is used.
  for (const [type, expected] of Object.entries(EXPECTED_TYPE_COUNTS)) {
    const actual = typeCounts[type] || 0;
    if (actual >= expected) {
      pass(`type="${type}" count = ${actual} (>= ${expected} expected)`);
    } else {
      fail(`type="${type}" count = ${actual}, expected >= ${expected}`);
    }
  }

  const sample = await prisma.project.findMany({
    where: { isTemplate: true, status: 'CATALOG', domain: 'AgriTech' },
    take: 1,
  });
  if (sample.length > 0 && sample[0].sector && sample[0].sector !== 'Technology') {
    pass(`Sample AgriTech row has real sector: "${sample[0].sector}"`);
  } else {
    fail('AgriTech sample row missing a real sector value');
  }

  console.log(failures === 0 ? '\n🎉 All checks passed.' : `\n💥 ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

verify()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
