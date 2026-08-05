-- One browser that agreed to receive push notifications.
--
-- Purely additive: one table, its indexes and one foreign key. Nothing here
-- reads or rewrites an existing row.

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- The endpoint *is* the device: a browser that re-subscribes gets the same URL
-- back, so this constraint is what lets the save be an upsert, and what stops
-- one phone collecting a row per sign-in and receiving everything twice.
CREATE UNIQUE INDEX "PushDevice_endpoint_key" ON "PushDevice"("endpoint");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- Cascade, like AuthSession: deleting an account takes its devices with it, and
-- nothing should be able to push to a user who no longer exists.
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
