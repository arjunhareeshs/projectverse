import { prisma } from '../shared/database';

async function main() {
  console.log('Adding questionCount column to CapstoneProblemStatement...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CapstoneProblemStatement" 
    ADD COLUMN IF NOT EXISTS "questionCount" INTEGER NOT NULL DEFAULT 15;
  `);

  const cols: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns 
    WHERE table_name = 'CapstoneProblemStatement' AND column_name = 'questionCount';
  `;

  console.log('Verified column in DB:', cols);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
