import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// Migration endpoint - should be protected or removed after use
router.post('/run-excel-migration', async (req: Request, res: Response) => {
  try {
    // Check if migration already ran (check if data exists)
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const projectCount = await prisma.project.count();
    const staffCount = await prisma.staff.count();

    if (projectCount > 0 || staffCount > 0) {
      return res.status(400).json({
        error: 'Data already exists. Migration has already been run.',
        projectCount,
        staffCount
      });
    }

    // Run the migration script
    const scriptPath = path.join(__dirname, '../scripts/migrate-excel.ts');
    const { stdout, stderr } = await execAsync(`npx ts-node ${scriptPath}`);

    await prisma.$disconnect();

    res.json({
      success: true,
      message: 'Migration completed successfully',
      output: stdout,
      errors: stderr || null
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Check migration status
router.get('/migration-status', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const [projectCount, staffCount, userCount, assignmentCount] = await Promise.all([
      prisma.project.count(),
      prisma.staff.count(),
      prisma.user.count(),
      prisma.projectAssignment.count()
    ]);

    await prisma.$disconnect();

    res.json({
      hasMigrated: projectCount > 0 || staffCount > 0,
      counts: {
        projects: projectCount,
        staff: staffCount,
        users: userCount,
        assignments: assignmentCount
      }
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
