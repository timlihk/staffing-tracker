const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAuroraFix() {
  try {
    const now = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 120);

    console.log('=== Testing Aurora Fix ===');
    console.log('Current date:', now);
    console.log('Window end:', windowEnd);

    // Test the FIXED query logic (date-only comparison)
    const startDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDateOnly = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), windowEnd.getDate());

    console.log('\n=== Date-Only Comparison ===');
    console.log('Start date (date only):', startDateOnly);
    console.log('End date (date only):', endDateOnly);

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { filingDate: { gte: startDateOnly, lte: endDateOnly } },
          { listingDate: { gte: startDateOnly, lte: endDateOnly } },
        ],
      },
      select: {
        id: true,
        name: true,
        filingDate: true,
        listingDate: true,
      },
    });

    console.log('\nProjects found with DATE-ONLY comparison:');
    projects.forEach(p => {
      console.log(`- ${p.name}: filing=${p.filingDate}, listing=${p.listingDate}`);
    });

    // Check specifically for Aurora
    const aurora = projects.find(p => p.name.includes('Aurora'));
    console.log('\nIs Aurora in results?', aurora ? 'YES ✅' : 'NO ❌');

    if (aurora) {
      console.log('Aurora filing date:', aurora.filingDate);
      console.log('Comparison with start date (date only):', aurora.filingDate >= startDateOnly);
      console.log('Comparison with end date (date only):', aurora.filingDate <= endDateOnly);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuroraFix();