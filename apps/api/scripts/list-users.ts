import { prisma } from './config';

async function main() {
  const users = await prisma.user.findMany({
    select: { 
      id: true, 
      email: true, 
      role: true, 
      createdAt: true 
    },
    orderBy: { createdAt: 'desc' }
  });

  console.table(users);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
