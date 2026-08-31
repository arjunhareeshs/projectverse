# Database Module

This module contains Prisma schema, migrations, and seed scripts for ProjectVerse.

## Commands

- `pnpm --filter @projectverse/server prisma:generate`
- `pnpm --filter @projectverse/server prisma:migrate:dev`
- `pnpm --filter @projectverse/server prisma:seed`



rm "c:/SSG projects/ProjectVerse/projectverse/server/src/scripts/_smokeTest.ts"
cd "c:/SSG projects/ProjectVerse/projectverse/server" && cat > /tmp/finalcheck.ts <<'TS'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const [users, teams, projects, riskScores, fitScores, cohortSnaps] = await Promise.all([
    prisma.user.count(), prisma.team.count(), prisma.project.count(),
    prisma.projectRiskScore.count(), prisma.projectFitScore.count(), prisma.cohortMetricSnapshot.count(),
  ]);
  console.log(JSON.stringify({ users, teams, projects, riskScores, fitScores, cohortSnaps }));
}
main().finally(() => prisma.$disconnect());
TS
cp /tmp/finalcheck.ts src/scripts/_finalcheck.ts
npx tsx src/scripts/_finalcheck.ts
rm src/scripts/_finalcheck.ts /tmp/finalcheck.ts