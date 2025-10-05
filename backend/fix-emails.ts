import prisma from './src/utils/prisma';

async function fixEmails() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true
    }
  });

  console.log('Fixing capitalized emails...');

  for (const user of users) {
    const lowercaseEmail = user.email.toLowerCase();
    if (user.email !== lowercaseEmail) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: lowercaseEmail }
      });
      console.log(`Updated ${user.username}: ${user.email} -> ${lowercaseEmail}`);
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

fixEmails().catch(console.error);
