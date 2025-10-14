const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSpecificProject() {
  try {
    console.log('Testing specific project with B&C attorneys...\n');

    // Find a project that has B&C attorneys
    const projectWithBc = await prisma.project.findFirst({
      where: {
        bcAttorneys: {
          some: {}
        }
      },
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

    if (projectWithBc) {
      console.log(`Project: ${projectWithBc.name} (ID: ${projectWithBc.id})`);
      console.log('B&C Attorneys:');
      projectWithBc.bcAttorneys.forEach(bc => {
        console.log(`- ${bc.staff.name} (ID: ${bc.staff.id})`);
      });

      console.log('\nAll Team Members:');
      projectWithBc.assignments.forEach(assignment => {
        const isBcAttorney = projectWithBc.bcAttorneys.some(bc => bc.staff.id === assignment.staff.id);
        console.log(`- ${assignment.staff.name} (ID: ${assignment.staff.id}) - B&C: ${isBcAttorney}`);
      });

      // Test the toggle logic that the frontend uses
      console.log('\nTesting frontend toggle logic:');
      projectWithBc.assignments.forEach(assignment => {
        const isBcAttorney = projectWithBc.bcAttorneys.some(bc => bc.staff?.id === assignment.staffId);
        console.log(`- ${assignment.staff.name} (staffId: ${assignment.staffId}) - B&C Toggle: ${isBcAttorney}`);
      });
    } else {
      console.log('No projects with B&C attorneys found');
    }

  } catch (error) {
    console.error('Error testing specific project:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSpecificProject();