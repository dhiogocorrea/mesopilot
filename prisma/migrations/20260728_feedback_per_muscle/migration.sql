-- Feedback moves from per-exercise to per-muscle-group.
--
-- The four questions are about a muscle, not a movement. Asking them of every
-- exercise produced several answers to the same question in one session, and
-- where they disagreed the engine read the same muscle's recovery two different
-- ways while deciding how to split that muscle's volume.

CREATE TABLE "SessionMuscleFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "soreness" INTEGER NOT NULL,
    "pump" INTEGER NOT NULL,
    "workload" INTEGER NOT NULL,
    "jointPain" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionMuscleFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionMuscleFeedback_sessionId_muscleGroupId_key"
    ON "SessionMuscleFeedback"("sessionId", "muscleGroupId");
CREATE INDEX "SessionMuscleFeedback_sessionId_idx" ON "SessionMuscleFeedback"("sessionId");

ALTER TABLE "SessionMuscleFeedback" ADD CONSTRAINT "SessionMuscleFeedback_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionMuscleFeedback" ADD CONSTRAINT "SessionMuscleFeedback_muscleGroupId_fkey"
    FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry existing answers across before the columns go. Where a muscle was
-- answered more than once in a session, the worst answer wins: soreness,
-- workload and joint pain are all limiters, and taking the mildest of two
-- contradicting reports would tell the engine to add volume on the strength of
-- the answer the athlete gave about a different exercise. Pump is the one
-- stimulus signal, so its best reading is the honest one.
INSERT INTO "SessionMuscleFeedback"
    ("id", "sessionId", "muscleGroupId", "soreness", "pump", "workload", "jointPain", "answeredAt")
SELECT
    gen_random_uuid()::text,
    "sessionId",
    "muscleGroupId",
    MAX("soreness"),
    MAX("pump"),
    MAX("workload"),
    MAX("jointPain"),
    CURRENT_TIMESTAMP
FROM "SessionExercise"
WHERE "workload" IS NOT NULL
  AND "soreness" IS NOT NULL
  AND "pump" IS NOT NULL
  AND "jointPain" IS NOT NULL
GROUP BY "sessionId", "muscleGroupId";

ALTER TABLE "SessionExercise" DROP COLUMN "soreness";
ALTER TABLE "SessionExercise" DROP COLUMN "pump";
ALTER TABLE "SessionExercise" DROP COLUMN "workload";
ALTER TABLE "SessionExercise" DROP COLUMN "jointPain";
