-- Enums
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "SyncType" AS ENUM ('QUICK', 'POLL', 'FULL', 'RANGE', 'DELETE', 'RESYNC');

-- user_config
CREATE TABLE "user_config" (
    "id" SERIAL NOT NULL,
    "foursquareToken" TEXT,
    "foursquareUserId" TEXT,
    "foursquareDisplayName" TEXT,
    "foursquarePhotoUrl" TEXT,
    "googleCredentialsJson" TEXT,
    "googleEmail" TEXT,
    "googlePhotoUrl" TEXT,
    "swarmCalendarId" TEXT,
    "ogMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_config_pkey" PRIMARY KEY ("id")
);

-- synced_checkins
CREATE TABLE "synced_checkins" (
    "checkinId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "calendarEventUrl" TEXT,
    "venueId" TEXT,
    "venueName" TEXT,
    "venueCity" TEXT,
    "venueCategory" TEXT,
    "checkinTimestamp" INTEGER,
    "isMayor" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "stickerImageUrl" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "synced_checkins_pkey" PRIMARY KEY ("checkinId")
);

-- sync_jobs
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "afterTimestamp" INTEGER,
    "beforeTimestamp" INTEGER,
    "currentOffset" INTEGER NOT NULL DEFAULT 0,
    "totalSynced" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- sync_logs
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "type" "SyncType" NOT NULL,
    "synced" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "fromDate" TEXT,
    "toDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);
