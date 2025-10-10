const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAuroraDate() {
  try {
    const project = await prisma.project.findFirst({
      where: { name: { contains: 'Aurora' } },
      select: {
        id: true,
        name: true,
        filingDate: true,
        listingDate: true,
      }
    });

    console.log('Project Aurora data:', project);

    if (project && project.filingDate) {
      const now = new Date();
      const fourMonthsFromNow = new Date();
      fourMonthsFromNow.setDate(now.getDate() + 120);

      console.log('\n=== Date Analysis ===');
      console.log('Current date (with time):', now);
      console.log('Current date (date only):', new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      console.log('Filing date (with time):', project.filingDate);
      console.log('Filing date (date only):', new Date(project.filingDate.getFullYear(), project.filingDate.getMonth(), project.filingDate.getDate()));
      console.log('Four months from now:', fourMonthsFromNow);

      console.log('\n=== Comparisons ===');
      console.log('Is filing date >= current date (with time)?', project.filingDate >= now);
      console.log('Is filing date <= four months from now (with time)?', project.filingDate <= fourMonthsFromNow);

      const filingDateOnly = new Date(project.filingDate.getFullYear(), project.filingDate.getMonth(), project.filingDate.getDate());
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fourMonthsFromNowDateOnly = new Date(fourMonthsFromNow.getFullYear(), fourMonthsFromNow.getMonth(), fourMonthsFromNow.getDate());

      console.log('Is filing date >= current date (date only)?', filingDateOnly >= nowDateOnly);
      console.log('Is filing date <= four months from now (date only)?', filingDateOnly <= fourMonthsFromNowDateOnly);

      console.log('\n=== Deal Radar Query Test ===');
      const startDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endDateOnly = new Date(fourMonthsFromNow.getFullYear(), fourMonthsFromNow.getMonth(), fourMonthsFromNow.getDate());

      console.log('Query start date (date only):', startDateOnly);
      console.log('Query end date (date only):', endDateOnly);
      console.log('Should Aurora appear?', filingDateOnly >= startDateOnly && filingDateOnly <= endDateOnly);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAuroraDate();