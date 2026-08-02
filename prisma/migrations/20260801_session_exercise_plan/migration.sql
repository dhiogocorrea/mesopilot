-- Mid-session edits: swap a movement, add one, drop one.
--
-- The block's plan is the sessions themselves — next week is generated from
-- this week's entries — so any edit made in the logger is permanent by
-- default. These two columns are what lets an edit be *just for today*
-- instead: `plan` says whether the row survives into next week, and
-- `plannedExerciseId` remembers the movement a substitution replaced.

ALTER TABLE "SessionExercise" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE "SessionExercise" ADD COLUMN "plannedExerciseId" TEXT;

CREATE INDEX "SessionExercise_plannedExerciseId_idx" ON "SessionExercise"("plannedExerciseId");

-- SET NULL rather than CASCADE: an exercise being deleted should not take the
-- session that once substituted for it down with it. The row simply loses the
-- memory of what it was standing in for.
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_plannedExerciseId_fkey"
    FOREIGN KEY ("plannedExerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
