const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixJurisdictionBC() {
  try {
    console.log('Starting jurisdiction fix for assignments with "B&C"...');

    // Find all assignments where jurisdiction is "B&C"
    const assignmentsWithBC = await prisma.projectAssignment.findMany({
      where: {
        jurisdiction: 'B&C'
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            department: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`Found ${assignmentsWithBC.length} assignments with "B&C" jurisdiction`);

    if (assignmentsWithBC.length === 0) {
      console.log('No assignments with "B&C" jurisdiction found. Nothing to fix.');
      return;
    }

    // Update each assignment with proper jurisdiction based on staff department
    let updatedCount = 0;
    for (const assignment of assignmentsWithBC) {
      const staff = assignment.staff;
      let newJurisdiction = null;

      // Map department to jurisdiction
      if (staff.department) {
        if (staff.department.includes('HK') || staff.department.includes('Hong Kong')) {
          newJurisdiction = 'HK Law';
        } else if (staff.department.includes('US') || staff.department.includes('United States')) {
          newJurisdiction = 'US Law';
        } else if (staff.department.includes('China') || staff.department.includes('PRC')) {
          newJurisdiction = 'PRC Law';
        } else {
          // Default to department name if no specific mapping
          newJurisdiction = staff.department;
        }
      }

      if (newJurisdiction) {
        await prisma.projectAssignment.update({
          where: { id: assignment.id },
          data: { jurisdiction: newJurisdiction }
        });

        console.log(`Updated assignment for ${staff.name} in project "${assignment.project.name}": "B&C" -> "${newJurisdiction}"`);
        updatedCount++;
      } else {
        console.log(`No department found for ${staff.name}, keeping jurisdiction as "B&C"`);
      }
    }

    console.log(`\nJurisdiction fix completed. Updated ${updatedCount} assignments.`);

  } catch (error) {
    console.error('Error fixing jurisdiction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixJurisdictionBC();