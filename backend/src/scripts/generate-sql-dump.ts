import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function generateSQLDump() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = '/home/timlihk/staffing-tracker/backups';
  const filename = `migration-to-supabase-${timestamp}.sql`;
  const filepath = `${backupDir}/${filename}`;

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('Generating SQL dump for Supabase migration...\n');

    let sql = `-- Supabase Migration SQL Dump
-- Generated: ${new Date().toISOString()}
-- Source: Railway Database
-- Target: Supabase PostgreSQL

-- Disable triggers for faster import
SET session_replication_role = replica;

BEGIN;

`;

    // Fetch all data
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    const staff = await prisma.staff.findMany({ orderBy: { id: 'asc' } });
    const projects = await prisma.project.findMany({ orderBy: { id: 'asc' } });
    const assignments = await prisma.projectAssignment.findMany({ orderBy: { id: 'asc' } });
    const projectChanges = await prisma.projectChangeHistory.findMany({ orderBy: { id: 'asc' } });
    const staffChanges = await prisma.staffChangeHistory.findMany({ orderBy: { id: 'asc' } });
    const activityLogs = await prisma.activityLog.findMany({ orderBy: { id: 'asc' } });

    // Helper to escape SQL strings
    const escape = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (typeof val === 'number') return val.toString();
      if (val instanceof Date) return `'${val.toISOString()}'`;
      return `'${val.toString().replace(/'/g, "''")}'`;
    };

    // Insert Users
    sql += `-- Insert Users (${users.length} records)\n`;
    for (const user of users) {
      sql += `INSERT INTO users (id, username, email, password_hash, role, must_reset_password, staff_id, last_login, created_at) VALUES (${user.id}, ${escape(user.username)}, ${escape(user.email)}, ${escape(user.passwordHash)}, ${escape(user.role)}, ${escape(user.mustResetPassword)}, ${escape(user.staffId)}, ${escape(user.lastLogin)}, ${escape(user.createdAt)});\n`;
    }

    // Insert Staff
    sql += `\n-- Insert Staff (${staff.length} records)\n`;
    for (const s of staff) {
      sql += `INSERT INTO staff (id, name, email, position, department, status, notes, created_at, updated_at) VALUES (${s.id}, ${escape(s.name)}, ${escape(s.email)}, ${escape(s.position)}, ${escape(s.department)}, ${escape(s.status)}, ${escape(s.notes)}, ${escape(s.createdAt)}, ${escape(s.updatedAt)});\n`;
    }

    // Insert Projects
    sql += `\n-- Insert Projects (${projects.length} records)\n`;
    for (const p of projects) {
      sql += `INSERT INTO projects (id, name, category, status, priority, el_status, timetable, bc_attorney, filing_date, listing_date, notes, created_at, updated_at) VALUES (${p.id}, ${escape(p.name)}, ${escape(p.category)}, ${escape(p.status)}, ${escape(p.priority)}, ${escape(p.elStatus)}, ${escape(p.timetable)}, ${escape(p.bcAttorney)}, ${escape(p.filingDate)}, ${escape(p.listingDate)}, ${escape(p.notes)}, ${escape(p.createdAt)}, ${escape(p.updatedAt)});\n`;
    }

    // Insert Project Assignments
    sql += `\n-- Insert Project Assignments (${assignments.length} records)\n`;
    for (const a of assignments) {
      sql += `INSERT INTO project_assignments (id, project_id, staff_id, jurisdiction, start_date, end_date, notes, created_at, updated_at) VALUES (${a.id}, ${a.projectId}, ${a.staffId}, ${escape(a.jurisdiction)}, ${escape(a.startDate)}, ${escape(a.endDate)}, ${escape(a.notes)}, ${escape(a.createdAt)}, ${escape(a.updatedAt)});\n`;
    }

    // Insert Project Change History
    sql += `\n-- Insert Project Change History (${projectChanges.length} records)\n`;
    for (const c of projectChanges) {
      sql += `INSERT INTO project_change_history (id, project_id, field_name, old_value, new_value, change_type, changed_by, changed_at) VALUES (${c.id}, ${c.projectId}, ${escape(c.fieldName)}, ${escape(c.oldValue)}, ${escape(c.newValue)}, ${escape(c.changeType)}, ${escape(c.changedBy)}, ${escape(c.changedAt)});\n`;
    }

    // Insert Staff Change History
    sql += `\n-- Insert Staff Change History (${staffChanges.length} records)\n`;
    for (const c of staffChanges) {
      sql += `INSERT INTO staff_change_history (id, staff_id, field_name, old_value, new_value, change_type, changed_by, changed_at) VALUES (${c.id}, ${c.staffId}, ${escape(c.fieldName)}, ${escape(c.oldValue)}, ${escape(c.newValue)}, ${escape(c.changeType)}, ${escape(c.changedBy)}, ${escape(c.changedAt)});\n`;
    }

    // Insert Activity Logs
    sql += `\n-- Insert Activity Logs (${activityLogs.length} records)\n`;
    for (const log of activityLogs) {
      sql += `INSERT INTO activity_log (id, user_id, action_type, entity_type, entity_id, description, created_at) VALUES (${log.id}, ${escape(log.userId)}, ${escape(log.actionType)}, ${escape(log.entityType)}, ${escape(log.entityId)}, ${escape(log.description)}, ${escape(log.createdAt)});\n`;
    }

    // Update sequences
    sql += `\n-- Update sequences to continue from max IDs\n`;
    sql += `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));\n`;
    sql += `SELECT setval('staff_id_seq', (SELECT MAX(id) FROM staff));\n`;
    sql += `SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));\n`;
    sql += `SELECT setval('project_assignments_id_seq', (SELECT MAX(id) FROM project_assignments));\n`;
    sql += `SELECT setval('project_change_history_id_seq', (SELECT MAX(id) FROM project_change_history));\n`;
    sql += `SELECT setval('staff_change_history_id_seq', (SELECT MAX(id) FROM staff_change_history));\n`;
    sql += `SELECT setval('activity_log_id_seq', (SELECT MAX(id) FROM activity_log));\n`;

    sql += `\nCOMMIT;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Verify record counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'staff', COUNT(*) FROM staff
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'project_assignments', COUNT(*) FROM project_assignments
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log;
`;

    fs.writeFileSync(filepath, sql);

    const stats = fs.statSync(filepath);
    console.log(`✅ SQL dump generated successfully!\n`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
    console.log(`📋 Records to migrate:`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Staff: ${staff.length}`);
    console.log(`   Projects: ${projects.length}`);
    console.log(`   Assignments: ${assignments.length}`);
    console.log(`   Activity Logs: ${activityLogs.length}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Run Prisma migrations on Supabase first`);
    console.log(`   2. Then execute this SQL file`);

  } catch (error) {
    console.error('❌ SQL dump generation failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generateSQLDump();
