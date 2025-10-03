UPDATE "projects" SET "category" = 'HK Trx' WHERE "category" IN ('HK Transaction', 'HK Transaction Projects');
UPDATE "projects" SET "category" = 'US Trx' WHERE "category" IN ('US Transaction', 'US Transaction Projects');
UPDATE "projects" SET "category" = 'HK Comp' WHERE "category" IN ('HK Compliance', 'HK Compliance Projects');
UPDATE "projects" SET "category" = 'US Comp' WHERE "category" IN ('US Compliance', 'US Compliance Projects');
UPDATE "projects" SET "category" = 'Others' WHERE "category" NOT IN ('HK Trx', 'US Trx', 'HK Comp', 'US Comp');
