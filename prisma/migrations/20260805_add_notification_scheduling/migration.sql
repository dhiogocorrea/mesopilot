-- Everything a scheduled reminder needs that a reactive one did not.
--
-- Purely additive: one nullable column and two new tables. Nothing rewrites an
-- existing row, and `timezone` starts null for every account that predates it —
-- which is read as UTC until the browser reports the real one.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOptOut" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");

-- The idempotency mechanism itself, not a lookup aid. The scheduler claims this
-- row before it sends, so two overlapping cron runs race for the insert and
-- exactly one wins — a push cannot be un-sent, so under-sending is the only
-- acceptable direction to fail in. `day` is the recipient's local date.
CREATE UNIQUE INDEX "NotificationLog_userId_kind_day_key" ON "NotificationLog"("userId", "kind", "day");

-- CreateIndex
CREATE INDEX "NotificationOptOut_userId_idx" ON "NotificationOptOut"("userId");

-- One row per muted kind. Absence means subscribed, so a kind added later is on
-- by default rather than silently off for everyone who signed up before it.
CREATE UNIQUE INDEX "NotificationOptOut_userId_kind_key" ON "NotificationOptOut"("userId", "kind");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOptOut" ADD CONSTRAINT "NotificationOptOut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
