import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeStaff() {
  try {
    console.log('Starting staff merge and cleanup...\n');

    // 1. Find William duplicates
    const williams = await prisma.staff.findMany({
      where: {
        name: {
          in: ['William', 'WIlliam'],
        },
      },
      include: {
        assignments: true,
      },
    });

    console.log('Found William duplicates:', williams.map(s => ({ id: s.id, name: s.name })));

    if (williams.length === 2) {
      const correctWilliam = williams.find(s => s.name === 'William');
      const incorrectWilliam = williams.find(s => s.name === 'WIlliam');

      if (correctWilliam && incorrectWilliam) {
        // Move assignments from incorrect to correct
        await prisma.projectAssignment.updateMany({
          where: { staffId: incorrectWilliam.id },
          data: { staffId: correctWilliam.id },
        });

        // Delete incorrect William
        await prisma.staff.delete({
          where: { id: incorrectWilliam.id },
        });

        console.log(`✅ Merged WIlliam (ID: ${incorrectWilliam.id}) into William (ID: ${correctWilliam.id})`);
      }
    }

    // 2. Find Tingting duplicates
    const tingtings = await prisma.staff.findMany({
      where: {
        name: {
          in: ['Tingting', 'TIngting'],
        },
      },
      include: {
        assignments: true,
      },
    });

    console.log('\nFound Tingting duplicates:', tingtings.map(s => ({ id: s.id, name: s.name })));

    if (tingtings.length === 2) {
      const correctTingting = tingtings.find(s => s.name === 'Tingting');
      const incorrectTingting = tingtings.find(s => s.name === 'TIngting');

      if (correctTingting && incorrectTingting) {
        // Move assignments from incorrect to correct
        await prisma.projectAssignment.updateMany({
          where: { staffId: incorrectTingting.id },
          data: { staffId: correctTingting.id },
        });

        // Delete incorrect Tingting
        await prisma.staff.delete({
          where: { id: incorrectTingting.id },
        });

        console.log(`✅ Merged TIngting (ID: ${incorrectTingting.id}) into Tingting (ID: ${correctTingting.id})`);
      }
    }

    // 3. Delete Suspended staff
    const suspendedStaff = await prisma.staff.findMany({
      where: { status: 'Suspended' },
      include: {
        assignments: true,
      },
    });

    console.log('\nFound suspended staff:', suspendedStaff.map(s => ({ id: s.id, name: s.name, status: s.status })));

    for (const staff of suspendedStaff) {
      // Delete assignments first
      await prisma.projectAssignment.deleteMany({
        where: { staffId: staff.id },
      });

      // Delete staff
      await prisma.staff.delete({
        where: { id: staff.id },
      });

      console.log(`✅ Deleted suspended staff: ${staff.name} (ID: ${staff.id})`);
    }

    console.log('\n✅ All merges and deletions completed successfully!');
  } catch (error) {
    console.error('Error during merge:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

mergeStaff();
