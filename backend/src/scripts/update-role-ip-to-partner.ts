import prisma from '../utils/prisma';

async function main() {
  console.log('🔄 Updating project assignments: IP → Partner');
  const result = await prisma.projectAssignment.updateMany({
    where: { roleInProject: 'IP' },
    data: { roleInProject: 'Partner' },
  });

  console.log(`✅ Updated ${result.count} assignment${result.count === 1 ? '' : 's'}.`);

  const stillIp = await prisma.projectAssignment.count({
    where: { roleInProject: 'IP' },
  });

  if (stillIp > 0) {
    console.warn(`⚠️  ${stillIp} assignment${stillIp === 1 ? '' : 's'} still marked as "IP" – please inspect manually.`);
  } else {
    console.log('🎉 All assignments now use "Partner".');
  }
}

main()
  .catch((error) => {
    console.error('❌ Failed to update assignments:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
