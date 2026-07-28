-- Default rest drops from 2 minutes to 1. This only sets the column default for
-- rows created without one — the seeded library carries explicit values, and
-- `npm run db:seed` is what rewrites those.
ALTER TABLE "Exercise" ALTER COLUMN "defaultRestSec" SET DEFAULT 60;
