# Database Reset and Import Guide

## Issue
The local DATABASE_URL points to `localhost:5432`, but PostgreSQL is not running locally.

## Solutions

### Option 1: Use Railway Production Database (Recommended)

1. **Login to Railway:**
   ```bash
   railway login
   ```

2. **Link to your project:**
   ```bash
   railway link
   ```

3. **Run the reset and import directly on Railway:**
   ```bash
   railway run npm run db:reset-import
   ```

   Or step by step:
   ```bash
   railway run npm run db:truncate
   railway run npm run db:import
   ```

### Option 2: Get Railway Database URL and Run Locally

1. **Get the DATABASE_URL from Railway:**
   ```bash
   railway variables --service backend | grep DATABASE_URL
   ```

2. **Set it in your `.env` file:**
   ```bash
   # Replace the DATABASE_URL in .env with the Railway URL
   DATABASE_URL="postgresql://user:password@railway.app:5432/railway?schema=public"
   ```

3. **Run the reset and import:**
   ```bash
   npm run db:reset-import
   ```

### Option 3: Start Local PostgreSQL (Development Only)

1. **Install PostgreSQL:**
   ```bash
   sudo apt-get update
   sudo apt-get install postgresql postgresql-contrib
   ```

2. **Start PostgreSQL:**
   ```bash
   sudo service postgresql start
   ```

3. **Create database and user:**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE staffing_tracker;
   CREATE USER "user" WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE staffing_tracker TO "user";
   \q
   ```

4. **Run migrations:**
   ```bash
   npx prisma migrate deploy
   ```

5. **Run the reset and import:**
   ```bash
   npm run db:reset-import
   ```

## Available Scripts

- `npm run db:truncate` - Delete all data from all tables
- `npm run db:import` - Import data from Excel file
- `npm run db:reset-import` - Truncate and import in one command

## Excel File Location

The import script looks for:
```
/home/timlihk/staffing-tracker/CM Asia_Staffing List - 2025.09.09_2.xlsx
```

To use a different file, set the EXCEL_FILE environment variable:
```bash
EXCEL_FILE="/path/to/file.xlsx" npm run db:import
```
