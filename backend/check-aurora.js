const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProjectAurora() {
  try {
    const project = await prisma.project.findFirst({
      where: { name: { contains: 'Aurora' } },
      select: {
        id: true,
        name: true,
        status: true,
        filingDate: true,
        listingDate: true,
        timetable: true,
        category: true
      }
    });

    console.log('Project Aurora data:', project);

    if (project && project.filingDate) {
      const now = new Date();
      const fourMonthsFromNow = new Date();
      fourMonthsFromNow.setDate(now.getDate() + 120);

      console.log('Current date:', now);
      console.log('Four months from now:', fourMonthsFromNow);
      console.log('Filing date:', project.filingDate);
      console.log('Is filing date within range?', project.filingDate >= now && project.filingDate <= fourMonthsFromNow);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProjectAurora();