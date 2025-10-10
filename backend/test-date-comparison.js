const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDateComparison() {
  try {
    const now = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 120);

    console.log('Current date:', now);
    console.log('Window end:', windowEnd);

    // Test the exact query used in findUpcomingMilestones
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { filingDate: { gte: now, lte: windowEnd } },
          { listingDate: { gte: now, lte: windowEnd } },
        ],
      },
      select: {
        id: true,
        name: true,
        filingDate: true,
        listingDate: true,
      },
    });

    console.log('\nProjects found in Deal Radar query:');
    projects.forEach(p => {
      console.log(`- ${p.name}: filing=${p.filingDate}, listing=${p.listingDate}`);
    });

    // Check specifically for Aurora
    const aurora = projects.find(p => p.name.includes('Aurora'));
    console.log('\nIs Aurora in results?', aurora ? 'YES' : 'NO');

    if (aurora) {
      console.log('Aurora filing date:', aurora.filingDate);
      console.log('Comparison with now:', aurora.filingDate >= now);
      console.log('Comparison with window end:', aurora.filingDate <= windowEnd);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDateComparison();