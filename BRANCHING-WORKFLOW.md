# Git Branching Workflow

## Strategy

**`development`** - Active development branch (day-to-day work)
**`main`** - Production-ready code (deployed to Railway)

## Daily Workflow

### 1. Work on Development Branch

```bash
# Make sure you're on development
git checkout development

# Pull latest changes
git pull origin development

# Make your changes, test locally
# ... code, test, commit ...

git add .
git commit -m "your commit message"
git push origin development
```

### 2. When Ready for Production

```bash
# Ensure development is clean and tested
git checkout main
git merge development
git push origin main

# This triggers Railway deployment
# Switch back to development for next work
git checkout development
```

## Branch Purposes

### Development Branch
- ✅ All new features and bug fixes go here first
- ✅ Test thoroughly on local environment
- ✅ Can have experimental/WIP commits
- ✅ Safe to break things temporarily
- ❌ Not deployed to production

### Main Branch
- ✅ Only production-ready, tested code
- ✅ Automatically deployed to Railway
- ✅ Always stable and working
- ✅ Clean commit history
- ❌ Never commit directly to main

## Quick Commands

```bash
# Check current branch
git branch

# Switch to development (for daily work)
git checkout development

# Push to production (when ready)
git checkout main && git merge development && git push origin main && git checkout development
```

## Benefits

1. **Safety**: Test changes without affecting production
2. **Iteration**: Experiment freely on development
3. **Control**: Choose exactly when to deploy
4. **Rollback**: Easy to revert main if needed
5. **Clarity**: Clear separation between dev and prod

## Railway Configuration

Verify Railway deploys from `main` branch:
1. Railway Dashboard → Your Project
2. Click on service (backend/frontend)
3. Settings → Environment
4. Check "Branch" = `main`

## Current Status

- ✅ You're on `development` branch
- ✅ Both branches synced at commit `ac8bf12`
- ✅ Ready for development work!
