const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@projectverse.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('User found:', user.email);
  const isValid = await bcrypt.compare('password123', user.passwordHash);
  console.log('Password valid:', isValid);
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
