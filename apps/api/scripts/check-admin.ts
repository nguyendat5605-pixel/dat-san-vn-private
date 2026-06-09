import { prisma } from './config';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@test.com' },
    select: { 
      id: true, 
      email: true, 
      role: true, 
      clerkId: true
    }
  });

  if (user) {
    console.log('User found:');
    console.table([user]);
  } else {
    console.log('User admin@test.com not found.');
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
