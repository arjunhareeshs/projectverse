import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve(__dirname, '../../../data/Combined_Problem_Statements.xlsx');
const SHEET_NAME = 'All Problem Statements';

// Rows seeded from the Excel always carry a Problem ID matching this shape
// (H0001, S0001, HS0001, ...). Anything in the CATALOG that doesn't match
// this pattern is foreign data (e.g. a manual/rogue import) and is a
// candidate for cleanup during re-seed.
const VALID_PROBLEM_ID = /^(H|S|HS)\d+$/i;

type ExcelRow = {
  'Problem ID': string | number;
  'Category (Hard/Soft/Hard&Soft)': string;
  'Domain': string;
  'Sector / Niche': string;
  'Short Name': string;
  'Difficulty (0-4)': string | number;
  'Problem Statement': string;
};

function mapCategoryToType(category: string): string {
  const c = (category || '').trim().toLowerCase();
  if (c === 'hard') return 'Hardware';
  if (c === 'soft') return 'Software';
  if (c === 'hard & soft') return 'Hardware & Software';
  return category;
}

function mapRow(row: ExcelRow) {
  const problemId = String(row['Problem ID'] || '').trim();
  const category = String(row['Category (Hard/Soft/Hard&Soft)'] || '').trim();
  const domain = String(row['Domain'] || '').trim();
  const sector = String(row['Sector / Niche'] || '').trim();
  const shortName = String(row['Short Name'] || '').trim();
  const difficulty = String(row['Difficulty (0-4)'] ?? '').trim();
  const problemStatement = String(row['Problem Statement'] || '').trim();

  return { problemId, category, domain, sector, shortName, difficulty, problemStatement };
}

async function purgeRogueTemplates(organizationId: string) {
  const rogue = await prisma.project.findMany({
    where: { isTemplate: true, status: 'CATALOG', organizationId },
    include: { _count: { select: { childProjects: true } } },
  });

  const toDelete = rogue.filter(
    (p) => !p.problemId || !VALID_PROBLEM_ID.test(p.problemId),
  );

  const deletable = toDelete.filter((p) => p._count.childProjects === 0);
  const retained = toDelete.filter((p) => p._count.childProjects > 0);

  if (deletable.length > 0) {
    await prisma.project.deleteMany({
      where: { id: { in: deletable.map((p) => p.id) } },
    });
  }

  console.log(
    `🧹 Purge: removed ${deletable.length} rogue catalog template(s) with no team selections.`,
  );
  if (retained.length > 0) {
    console.warn(
      `⚠️  Retained ${retained.length} rogue catalog template(s) that already have teams — ` +
        'not deleted. Review manually:',
    );
    for (const p of retained) {
      console.warn(
        `   - id=${p.id} name="${p.name}" problemId=${p.problemId} teams=${p._count.childProjects}`,
      );
    }
  }
}

async function runSeed() {
  console.log('📖 Reading Excel file:', EXCEL_PATH);
  const workbook = XLSX.readFile(EXCEL_PATH);

  if (!workbook.SheetNames.includes(SHEET_NAME)) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Sheets: ${workbook.SheetNames.join(', ')}`);
  }

  const sheet = workbook.Sheets[SHEET_NAME];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`📄 Found ${rows.length} problem statements`);

  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found. Please run the main seed first.');
    process.exit(1);
  }

  await purgeRogueTemplates(org.id);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of rows) {
    const { problemId, category, domain, sector, shortName, difficulty, problemStatement } =
      mapRow(raw);

    if (!problemId || !domain || !problemStatement) {
      skipped++;
      continue;
    }

    const data = {
      organizationId: org.id,
      name: shortName || problemId,
      problemStatement,
      domain,
      difficultyLevel: difficulty,
      type: mapCategoryToType(category),
      problemId,
      sector,
      shortName,
      status: 'CATALOG',
      isTemplate: true,
    };

    const existing = await prisma.project.findUnique({ where: { problemId } });
    if (existing) {
      await prisma.project.update({ where: { problemId }, data });
      updated++;
    } else {
      await prisma.project.create({ data });
      created++;
    }
  }

  console.log(`✅ Done. Created: ${created}, Updated: ${updated}, Skipped (bad row): ${skipped}`);
}

runSeed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
