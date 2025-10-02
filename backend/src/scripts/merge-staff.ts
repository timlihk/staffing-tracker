import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeStaff(fromStaffId: number, toStaffId: number) {
  try {
    // Get staff details
    const fromStaff = await prisma.staff.findUnique({
      where: { id: fromStaffId },
      include: { assignments: { include: { project: true } } },
    });

    const toStaff = await prisma.staff.findUnique({
      where: { id: toStaffId },
      include: { assignments: { include: { project: true } } },
    });

    if (!fromStaff || !toStaff) {
      console.error('Staff not found');
      process.exit(1);
    }

    console.log(`\nMerging: ${fromStaff.name} (ID:${fromStaffId}) → ${toStaff.name} (ID:${toStaffId})`);
    console.log(`From staff has ${fromStaff.assignments.length} assignments`);
    console.log(`To staff has ${toStaff.assignments.length} assignments`);

    // Transfer all assignments
    const updated = await prisma.projectAssignment.updateMany({
      where: { staffId: fromStaffId },
      data: { staffId: toStaffId },
    });

    console.log(`Transferred ${updated.count} assignments`);

    // List the projects
    if (fromStaff.assignments.length > 0) {
      console.log('Projects transferred:');
      fromStaff.assignments.forEach(a => {
        console.log(`  - ${a.project.name} (${a.roleInProject})`);
      });
    }

    // Delete the old staff record
    await prisma.staff.delete({
      where: { id: fromStaffId },
    });

    console.log(`Deleted staff: ${fromStaff.name} (ID:${fromStaffId})`);
    console.log(`✅ Merge complete\n`);

  } catch (error) {
    console.error('Error merging staff:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const fromId = parseInt(process.argv[2]);
const toId = parseInt(process.argv[3]);

if (isNaN(fromId) || isNaN(toId)) {
  console.error('Usage: npx ts-node merge-staff.ts <fromStaffId> <toStaffId>');
  process.exit(1);
}

mergeStaff(fromId, toId);
