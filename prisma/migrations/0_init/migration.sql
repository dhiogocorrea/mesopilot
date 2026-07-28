-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usernameLower" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "sex" TEXT,
    "heightCm" DOUBLE PRECISION,
    "bodyweightKg" DOUBLE PRECISION,
    "experience" TEXT NOT NULL DEFAULT 'intermediate',
    "trainingYears" DOUBLE PRECISION,
    "primaryGoal" TEXT NOT NULL DEFAULT 'hypertrophy',
    "daysPerWeek" INTEGER NOT NULL DEFAULT 4,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "sleepQuality" INTEGER NOT NULL DEFAULT 3,
    "stressLevel" INTEGER NOT NULL DEFAULT 3,
    "nutritionQuality" INTEGER NOT NULL DEFAULT 3,
    "caloricState" TEXT NOT NULL DEFAULT 'maintenance',
    "injuries" TEXT,
    "equipment" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuscleGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "mv" INTEGER NOT NULL DEFAULT 6,
    "mev" INTEGER NOT NULL DEFAULT 8,
    "mav" INTEGER NOT NULL DEFAULT 16,
    "mrv" INTEGER NOT NULL DEFAULT 22,

    CONSTRAINT "MuscleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMuscleLandmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "mev" INTEGER NOT NULL,
    "mav" INTEGER NOT NULL,
    "mrv" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMuscleLandmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "secondary" TEXT,
    "equipment" TEXT NOT NULL DEFAULT 'barbell',
    "movementType" TEXT NOT NULL DEFAULT 'compound',
    "defaultRepMin" INTEGER NOT NULL DEFAULT 8,
    "defaultRepMax" INTEGER NOT NULL DEFAULT 12,
    "defaultRestSec" INTEGER NOT NULL DEFAULT 120,
    "sfr" INTEGER NOT NULL DEFAULT 3,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "demoUrl" TEXT,
    "demoSource" TEXT,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "descEn" TEXT NOT NULL DEFAULT '',
    "descPt" TEXT NOT NULL DEFAULT '',
    "daysPerWeek" INTEGER NOT NULL,
    "weeks" INTEGER NOT NULL DEFAULT 5,
    "level" TEXT NOT NULL DEFAULT 'intermediate',
    "goal" TEXT NOT NULL DEFAULT 'hypertrophy',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "source" TEXT,

    CONSTRAINT "ProgramTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTrack" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "descEn" TEXT NOT NULL DEFAULT '',
    "descPt" TEXT NOT NULL DEFAULT '',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "source" TEXT,

    CONSTRAINT "ProgramTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTrackEntry" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "ProgramTrackEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTemplateDay" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelPt" TEXT NOT NULL,

    CONSTRAINT "ProgramTemplateDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTemplateSlot" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "startingSets" INTEGER NOT NULL DEFAULT 3,
    "repMin" INTEGER NOT NULL DEFAULT 8,
    "repMax" INTEGER NOT NULL DEFAULT 12,
    "restSec" INTEGER NOT NULL DEFAULT 120,

    CONSTRAINT "ProgramTemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesocycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "trackId" TEXT,
    "trackPosition" INTEGER,
    "name" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL DEFAULT 5,
    "daysPerWeek" INTEGER NOT NULL,
    "startRir" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Mesocycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "mesocycleId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isDeload" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "targetSets" INTEGER NOT NULL,
    "repMin" INTEGER NOT NULL,
    "repMax" INTEGER NOT NULL,
    "targetRir" INTEGER NOT NULL,
    "restSec" INTEGER NOT NULL DEFAULT 120,
    "soreness" INTEGER,
    "pump" INTEGER,
    "workload" INTEGER,
    "jointPain" INTEGER,
    "aiNote" TEXT,

    CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "rir" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "loggedAt" TIMESTAMP(3),

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionDecision" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "sourceExerciseId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'rule',
    "setDelta" INTEGER NOT NULL DEFAULT 0,
    "loadDeltaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetRir" INTEGER NOT NULL,
    "reasonEn" TEXT NOT NULL,
    "reasonPt" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameLower_key" ON "User"("usernameLower");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MuscleGroup_key_key" ON "MuscleGroup"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserMuscleLandmark_userId_muscleGroupId_key" ON "UserMuscleLandmark"("userId", "muscleGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_key_key" ON "Exercise"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTemplate_key_key" ON "ProgramTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTrack_key_key" ON "ProgramTrack"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTrackEntry_trackId_order_key" ON "ProgramTrackEntry"("trackId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTemplateDay_templateId_order_key" ON "ProgramTemplateDay"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTemplateSlot_dayId_order_key" ON "ProgramTemplateSlot"("dayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Session_mesocycleId_week_dayIndex_key" ON "Session"("mesocycleId", "week", "dayIndex");

-- CreateIndex
CREATE UNIQUE INDEX "SessionExercise_sessionId_order_key" ON "SessionExercise"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_sessionExerciseId_order_key" ON "SetLog"("sessionExerciseId", "order");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMuscleLandmark" ADD CONSTRAINT "UserMuscleLandmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMuscleLandmark" ADD CONSTRAINT "UserMuscleLandmark_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplate" ADD CONSTRAINT "ProgramTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTrack" ADD CONSTRAINT "ProgramTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTrackEntry" ADD CONSTRAINT "ProgramTrackEntry_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ProgramTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTrackEntry" ADD CONSTRAINT "ProgramTrackEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplateDay" ADD CONSTRAINT "ProgramTemplateDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplateSlot" ADD CONSTRAINT "ProgramTemplateSlot_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ProgramTemplateDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplateSlot" ADD CONSTRAINT "ProgramTemplateSlot_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplateSlot" ADD CONSTRAINT "ProgramTemplateSlot_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesocycle" ADD CONSTRAINT "Mesocycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesocycle" ADD CONSTRAINT "Mesocycle_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesocycle" ADD CONSTRAINT "Mesocycle_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ProgramTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_mesocycleId_fkey" FOREIGN KEY ("mesocycleId") REFERENCES "Mesocycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
