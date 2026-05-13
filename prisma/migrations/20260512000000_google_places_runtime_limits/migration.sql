CREATE TABLE "google_places_settings" (
    "id" INTEGER NOT NULL,
    "dailyLimit" INTEGER,
    "monthlyLimit" INTEGER,
    "backfillRunLimit" INTEGER,
    "warningThreshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_places_settings_pkey" PRIMARY KEY ("id")
);
