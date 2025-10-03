DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'actual_filing_date'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'filing_date'
    ) THEN
      EXECUTE 'UPDATE "projects" SET "filing_date" = COALESCE("filing_date", "actual_filing_date")';
      EXECUTE 'ALTER TABLE "projects" DROP COLUMN "actual_filing_date"';
    ELSE
      EXECUTE 'ALTER TABLE "projects" RENAME COLUMN "actual_filing_date" TO "filing_date"';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'filing_date'
  ) THEN
    EXECUTE 'ALTER TABLE "projects" ADD COLUMN "filing_date" TIMESTAMP';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'listing_date'
  ) THEN
    EXECUTE 'ALTER TABLE "projects" ADD COLUMN "listing_date" TIMESTAMP';
  END IF;
END $$;
