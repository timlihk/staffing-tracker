import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeJiawei() {
  try {
    // Find both staff members
    const staffMembers = await prisma.staff.findMany({
      where: {
        name: {
          in: ['Jiawei', 'Jiawei Zhao', 'jiawei', 'jiawei zhao'],
          mode: 'insensitive',
        },
      },
      include: {
        assignments: true,
      },
    });

    console.log('Found staff members:', staffMembers.map(s => ({ id: s.id, name: s.name, assignments: s.assignments.length })));

    if (staffMembers.length < 2) {
      console.log('Less than 2 staff members found. Nothing to merge.');
      return;
    }

    // Determine which one to keep (prefer the one with more complete info or more assignments)
    const sortedStaff = staffMembers.sort((a, b) => {
      // Prefer "Jiawei Zhao" as it's the full name
      if (a.name.toLowerCase().includes('zhao')) return -1;
      if (b.name.toLowerCase().includes('zhao')) return 1;
      return b.assignments.length - a.assignments.length;
    });

    const keepStaff = sortedStaff[0];
    const mergeStaff = sortedStaff.slice(1);

    console.log(`\nKeeping: ${keepStaff.name} (ID: ${keepStaff.id})`);
    console.log(`Merging: ${mergeStaff.map(s => `${s.name} (ID: ${s.id})`).join(', ')}`);

    // Update all assignments from the staff to be merged
    for (const staff of mergeStaff) {
      console.log(`\nProcessing assignments for ${staff.name} (ID: ${staff.id})...`);

      // Update project assignments
      const updateResult = await prisma.projectAssignment.updateMany({
        where: { staffId: staff.id },
        data: { staffId: keepStaff.id },
      });
      console.log(`Updated ${updateResult.count} project assignments`);

      // Update user associations
      const userUpdate = await prisma.user.updateMany({
        where: { staffId: staff.id },
        data: { staffId: keepStaff.id },
      });
      console.log(`Updated ${userUpdate.count} user associations`);

      // Delete the staff member
      await prisma.staff.delete({
        where: { id: staff.id },
      });
      console.log(`Deleted staff member: ${staff.name}`);
    }

    // Update the kept staff member to ensure name is correct
    await prisma.staff.update({
      where: { id: keepStaff.id },
      data: { name: 'Jiawei Zhao' },
    });

    console.log('\n✅ Merge completed successfully!');
    console.log(`Final staff: Jiawei Zhao (ID: ${keepStaff.id})`);

  } catch (error) {
    console.error('Error merging Jiawei:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

mergeJiawei();
