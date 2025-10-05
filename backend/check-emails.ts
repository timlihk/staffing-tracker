import prisma from './src/utils/prisma';

async function checkEmails() {
  const users = await prisma.user.findMany({
    where: {
      username: {
        in: ['Justin Zhou', 'Qingyu Wu', 'Ryan choi', 'Ashlee Wu', 'George Zheng']
      }
    },
    select: {
      username: true,
      email: true
    }
  });

  console.log('Users and their emails:');
  users.forEach(user => {
    console.log(`${user.username}: ${user.email}`);
  });

  await prisma.$disconnect();
}

checkEmails().catch(console.error);
