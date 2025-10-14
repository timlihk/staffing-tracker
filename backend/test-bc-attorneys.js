const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBcAttorneys() {
  try {
    console.log('Testing B&C attorneys data...\n');

    // Test 1: Check if project_bc_attorneys table exists and has data
    const bcAttorneys = await prisma.projectBcAttorney.findMany({
      take: 5,
      include: {
        project: {
          select: { name: true }
        },
        staff: {
          select: { name: true, position: true }
        }
      }
    });

    console.log(`Found ${bcAttorneys.length} B&C attorney entries:`);
    bcAttorneys.forEach(entry => {
      console.log(`- Project: ${entry.project.name}, Staff: ${entry.staff.name} (${entry.staff.position})`);
    });

    // Test 2: Check a specific project with B&C attorneys
    console.log('\nChecking project "Elite" (ID 1) for B&C attorneys:');
    const eliteProject = await prisma.project.findUnique({
      where: { id: 1 },
      include: {
        bcAttorneys: {
          include: {
            staff: {
              select: { id: true, name: true, position: true }
            }
          }
        },
        assignments: {
          include: {
            staff: {
              select: { id: true, name: true, position: true }
            }
          }
        }
      }
    });

    if (eliteProject) {
      console.log(`Project: ${eliteProject.name}`);
      console.log('B&C Attorneys:');
      eliteProject.bcAttorneys.forEach(bc => {
        console.log(`- ${bc.staff.name} (ID: ${bc.staff.id})`);
      });

      console.log('\nAll Team Members:');
      eliteProject.assignments.forEach(assignment => {
        const isBcAttorney = eliteProject.bcAttorneys.some(bc => bc.staff.id === assignment.staff.id);
        console.log(`- ${assignment.staff.name} (ID: ${assignment.staff.id}) - B&C: ${isBcAttorney}`);
      });
    } else {
      console.log('Project "Elite" not found');
    }

    // Test 3: Check if any assignments have "B&C" in jurisdiction
    console.log('\nChecking for assignments with "B&C" in jurisdiction:');
    const bcJurisdictionAssignments = await prisma.projectAssignment.findMany({
      where: {
        jurisdiction: {
          contains: 'B&C'
        }
      },
      include: {
        staff: {
          select: { name: true }
        },
        project: {
          select: { name: true }
        }
      },
      take: 10
    });

    console.log(`Found ${bcJurisdictionAssignments.length} assignments with "B&C" in jurisdiction:`);
    bcJurisdictionAssignments.forEach(assignment => {
      console.log(`- Project: ${assignment.project.name}, Staff: ${assignment.staff.name}, Jurisdiction: ${assignment.jurisdiction}`);
    });

  } catch (error) {
    console.error('Error testing B&C attorneys:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testBcAttorneys();