import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const r = await p.project.findFirst({
    where: { isTemplate: true, status: 'CATALOG' },
    select: { id: true, name: true, problemStatement: true, description: true, soul: true, domain: true },
  });
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
}
main();
