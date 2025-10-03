import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncStaffRoles() {
  try {
    console.log('Starting role sync from Staff to ProjectAssignments...\n');

    // Get all staff members
    const staffMembers = await prisma.staff.findMany({
      include: {
        assignments: true,
      },
    });

    let totalUpdated = 0;

    for (const staff of staffMembers) {
      console.log(`\nProcessing: ${staff.name} (Role: ${staff.role})`);

      // Update all assignments for this staff member to use their role
      const result = await prisma.projectAssignment.updateMany({
        where: {
          staffId: staff.id,
          // Only update if different from staff role
          NOT: {
            roleInProject: staff.role,
          },
        },
        data: {
          roleInProject: staff.role,
        },
      });

      if (result.count > 0) {
        console.log(`  ✓ Updated ${result.count} assignments`);
        totalUpdated += result.count;
      } else {
        console.log(`  - No updates needed (${staff.assignments.length} assignments already correct)`);
      }
    }

    console.log(`\n✅ Sync completed!`);
    console.log(`Total assignments updated: ${totalUpdated}`);

  } catch (error) {
    console.error('Error syncing staff roles:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

syncStaffRoles();
