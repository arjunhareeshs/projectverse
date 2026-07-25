const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    console.log('Users:', userCount);

    const sample = await prisma.user.findMany({
      take: 5,
      select: { email: true }
    });
    console.log('Sample emails:');
    sample.forEach(u => console.log('  ' + u.email));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
