import { prisma } from '../shared/database';

async function main() {
  const tables: any[] = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name ILIKE '%capstone%' OR table_name = 'Project')
    ORDER BY table_name;
  `;
  console.info('Database tables:', tables);

  const projectCols: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Project' AND column_name IN ('mode', 'differentiationApproach');
  `;
  console.info('Project columns:', projectCols);

  const problemCols: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns 
    WHERE table_name = 'CapstoneProblemStatement';
  `;
  console.info('CapstoneProblemStatement columns:', problemCols);

  const enums: any[] = await prisma.$queryRaw`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('ProjectMode', 'CapstoneStatus')
    ORDER BY t.typname, e.enumsortorder;
  `;
  console.info('Enums in DB:', enums);

  const migrations: any[] = await prisma.$queryRawUnsafe(
    'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'
  );
  console.info('Applied migrations:', migrations);
}

main().catch(console.error).finally(() => prisma.$disconnect());
