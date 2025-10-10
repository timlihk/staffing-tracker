const { PrismaClient } = require('@prisma/client');

async function checkBillingSettings() {
  const prisma = new PrismaClient();

  try {
    console.log('Checking billing access settings...');

    // Check if billing_access_settings table exists and has data
    const settings = await prisma.$queryRaw`
      SELECT * FROM billing_access_settings ORDER BY id DESC LIMIT 1
    `;

    if (settings && settings.length > 0) {
      console.log('Current billing access settings:', settings[0]);
    } else {
      console.log('No billing access settings found. Default settings would be used.');
      console.log('Default: billing_module_enabled = false, access_level = admin_only');
    }

    // Check if there are any users with admin role
    const adminUsers = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, username: true, role: true }
    });

    console.log('\nAdmin users:', adminUsers);

  } catch (error) {
    console.error('Error checking billing settings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBillingSettings();