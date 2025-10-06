# Database Backup & Restore Guide

## Backup Strategy

**Tiered Retention:**
- **Hourly**: Every hour, retained for 1 day (~24 backups)
- **Daily**: Daily at 2 AM UTC, retained for 7 days (7 backups)
- **Weekly**: Sunday at 3 AM UTC, retained for 30 days (~4 backups)

**Total**: ~35 backups at any given time

**Storage Locations:**
- **GitHub Artifacts**: Short-term, fast access (retention as above)
- **Google Drive**: Long-term durable storage (kept indefinitely)
  - Organized by: `staffing-tracker-backups/[hourly|daily|weekly]/YYYY/MM/`
  - Provides redundancy and off-site backup

## Finding Backups

**From GitHub Actions (recent backups):**
1. Go to: https://github.com/timlihk/staffing-tracker/actions
2. Click on any completed backup workflow (Hourly/Daily/Weekly)
3. Scroll to "Artifacts" section
4. Download the backup file

**From Google Drive (all backups):**
1. Open Google Drive
2. Navigate to `staffing-tracker-backups/` folder
3. Choose from `hourly/`, `daily/`, or `weekly/` subfolder
4. Download the backup file you need

## How to Restore

### Prerequisites
- PostgreSQL 17 client installed
- Database URL for target database

### Restore Steps

1. **Download backup artifact** from GitHub Actions

2. **Extract the backup:**
   ```bash
   gunzip railway-backup-*.dump.gz
   ```

3. **Restore to database:**
   ```bash
   pg_restore --verbose \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --dbname="$DATABASE_URL" \
     railway-backup-*.dump
   ```

### Using the Restore Script

A restore script is provided for convenience:

```bash
./scripts/restore-backup.sh path/to/backup.dump.gz
```

**Environment variables needed:**
- `DATABASE_URL` - Target database connection string

## Testing Restores

**IMPORTANT**: Always test restore procedures regularly!

### Automated Testing
- A weekly automated restore test runs every Sunday at 4 AM UTC
- Check workflow results at: https://github.com/timlihk/staffing-tracker/actions/workflows/test-restore.yml

### Manual Testing

1. Create a test database on Railway
2. Download a recent backup
3. Restore to test database
4. Verify data integrity
5. Delete test database

## Restore to Production

⚠️ **WARNING**: Restoring to production will overwrite all current data!

### Safe Restore Procedure:

1. **Create a current backup first:**
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --file=pre-restore-backup.dump
   ```

2. **Download and verify the backup you want to restore**

3. **Restore to production:**
   ```bash
   pg_restore --verbose \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --dbname="$DATABASE_URL" \
     your-backup.dump
   ```

4. **Verify the restore:**
   ```bash
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM staff;"
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM projects;"
   ```

## Important Notes

- **Dual Storage**: Backups are stored in both GitHub Artifacts (fast access) and Google Drive (long-term durability)
- **Validation**: All backups are validated with `pg_restore --list` before upload
- **Google Drive**: Provides unlimited retention and off-site backup redundancy
- **Railway Backups**: Consider enabling Railway's built-in backups as a third backup layer
- **Test Regularly**: Untested backups are just hopeful files

## Emergency Contact

If restore fails:
1. Check backup file integrity: `gzip -t backup.dump.gz`
2. Test restore to local database first
3. Check Railway dashboard for built-in backups
4. Review restore test workflow logs

## Future Improvements

- [ ] Add S3/external storage for durable long-term backups
- [ ] Implement point-in-time recovery
- [ ] Add database migration rollback scripts
- [ ] Set up backup failure alerts
