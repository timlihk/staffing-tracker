-- AlterTable
ALTER TABLE "projects" ADD COLUMN "filing_date" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "listing_date" TIMESTAMP(3);

-- Update category names to shortened versions
UPDATE "projects" SET "category" = 'HK Trx' WHERE "category" = 'HK Transaction Projects';
UPDATE "projects" SET "category" = 'US Trx' WHERE "category" = 'US Transaction Projects';
UPDATE "projects" SET "category" = 'HK Comp' WHERE "category" = 'HK Compliance Projects';
UPDATE "projects" SET "category" = 'US Comp' WHERE "category" = 'US Compliance Projects';
