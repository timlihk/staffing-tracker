ALTER TABLE "projects"
  RENAME COLUMN "actual_filing_date" TO "filing_date";

ALTER TABLE "projects"
  ADD COLUMN     "listing_date" TIMESTAMP;
