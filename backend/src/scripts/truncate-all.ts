import prisma from '../utils/prisma';

async function truncateAll() {
  console.log('🗑️  Truncating all database tables...');

  try {
    // Delete all data in order (respecting foreign key constraints)
    await prisma.projectChangeHistory.deleteMany({});
    console.log('  ✓ Deleted project change history');

    await prisma.staffChangeHistory.deleteMany({});
    console.log('  ✓ Deleted staff change history');

    await prisma.projectAssignment.deleteMany({});
    console.log('  ✓ Deleted project assignments');

    await prisma.activityLog.deleteMany({});
    console.log('  ✓ Deleted activity logs');

    await prisma.project.deleteMany({});
    console.log('  ✓ Deleted projects');

    await prisma.staff.deleteMany({});
    console.log('  ✓ Deleted staff');

    await prisma.user.deleteMany({});
    console.log('  ✓ Deleted users');

    console.log('\n✅ All tables truncated successfully!');
  } catch (error) {
    console.error('❌ Error truncating tables:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

truncateAll();
