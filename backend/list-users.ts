import prisma from './src/utils/prisma';

async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true
    },
    orderBy: {
      username: 'asc'
    }
  });

  console.log('Current users:');
  users.forEach((user, index) => {
    console.log(`${index + 1}. ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
  });

  await prisma.$disconnect();
}

listUsers().catch(console.error);
