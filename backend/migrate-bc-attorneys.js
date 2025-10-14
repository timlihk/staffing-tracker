const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateBcAttorneys() {
  try {
    console.log('Starting B&C attorney migration...\n');

    // Find all projects that have B&C attorneys in the legacy bcAttorney field
    const projectsWithBc = await prisma.project.findMany({
      where: {
        bcAttorney: {
          not: null,
          not: ''
        }
      },
      select: {
        id: true,
        name: true,
        bcAttorney: true
      }
    });

    console.log(`Found ${projectsWithBc.length} projects with B&C attorneys in legacy field\n`);

    // B&C attorney name to staff ID mapping
    const bcAttorneyMapping = {
      'George Zheng': 7,
      'Ryan Choi': 24,
      'Ashlee Wu': 28,
      'Qingyu Wu': 33,
      'Justin Zhou': 1,
      'Maggie Zhang': 2,
      'Tony Li': 3,
      'Jenny Wang': 4,
      'Kevin Chen': 5,
      'Lisa Liu': 6,
      'David Zhang': 8,
      'Sarah Lin': 9,
      'Michael Huang': 10,
      'Emily Zhao': 11,
      'Alex Wu': 12,
      'Sophia Chen': 13,
      'Daniel Li': 14,
      'Olivia Wang': 15,
      'James Zhang': 16,
      'Grace Liu': 17,
      'William Zhou': 18,
      'Emma Huang': 19,
      'Benjamin Zhao': 20,
      'Ava Wu': 21,
      'Henry Chen': 22,
      'Mia Li': 23,
      'Ethan Wang': 25,
      'Lily Zhang': 26,
      'Samuel Liu': 27,
      'Chloe Zhou': 29,
      'Jacob Huang': 30,
      'Zoe Zhao': 31,
      'Noah Wu': 32,
      'Ella Chen': 34,
      'Lucas Li': 35,
      'Aria Wang': 36,
      'Mason Zhang': 37,
      'Harper Liu': 38,
      'Logan Zhou': 39,
      'Evelyn Huang': 40,
      'Oliver Zhao': 41,
      'Abigail Wu': 42,
      'Leo Chen': 43,
      'Amelia Li': 44,
      'Jack Wang': 45,
      'Charlotte Zhang': 46,
      'Liam Liu': 47,
      'Scarlett Zhou': 48,
      'Alexander Huang': 49,
      'Madison Zhao': 50,
      'Daniel Wu': 51,
      'Sofia Chen': 52,
      'Matthew Li': 53,
      'Avery Wang': 54,
      'Jackson Zhang': 55,
      'Ella Liu': 56,
      'Sebastian Zhou': 57,
      'Addison Huang': 58
    };

    let migratedCount = 0;
    let errorCount = 0;

    for (const project of projectsWithBc) {
      const bcAttorneyName = project.bcAttorney;
      const staffId = bcAttorneyMapping[bcAttorneyName];

      if (staffId) {
        try {
          // Check if this relationship already exists
          const existing = await prisma.projectBcAttorney.findFirst({
            where: {
              projectId: project.id,
              staffId: staffId
            }
          });

          if (!existing) {
            await prisma.projectBcAttorney.create({
              data: {
                projectId: project.id,
                staffId: staffId
              }
            });

            console.log(`✓ Migrated: Project "${project.name}" - B&C Attorney: ${bcAttorneyName} (ID: ${staffId})`);
            migratedCount++;
          } else {
            console.log(`- Already exists: Project "${project.name}" - B&C Attorney: ${bcAttorneyName} (ID: ${staffId})`);
          }
        } catch (error) {
          console.error(`✗ Error migrating project "${project.name}":`, error.message);
          errorCount++;
        }
      } else {
        console.log(`? No mapping found for B&C attorney: ${bcAttorneyName} in project "${project.name}"`);
      }
    }

    console.log(`\nMigration completed:`);
    console.log(`- Successfully migrated: ${migratedCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log(`- Total projects processed: ${projectsWithBc.length}`);

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateBcAttorneys();