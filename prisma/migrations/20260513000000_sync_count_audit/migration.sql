CREATE TABLE "sync_count_audits" (
    "id" INTEGER NOT NULL,
    "firstYear" INTEGER NOT NULL,
    "lastYear" INTEGER NOT NULL,
    "checkedYears" JSONB NOT NULL,
    "totalCheckins" INTEGER,
    "totalSynced" INTEGER NOT NULL,
    "foundInCheckedYears" INTEGER NOT NULL DEFAULT 0,
    "unaccountedCheckins" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_count_audits_pkey" PRIMARY KEY ("id")
);
