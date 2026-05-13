CREATE TABLE "venue_enrichments" (
    "foursquareVenueId" TEXT NOT NULL,
    "foursquareName" TEXT,
    "foursquareAddress" TEXT,
    "foursquareCity" TEXT,
    "foursquareState" TEXT,
    "foursquareCountry" TEXT,
    "foursquarePostalCode" TEXT,
    "foursquareLatitude" DOUBLE PRECISION,
    "foursquareLongitude" DOUBLE PRECISION,
    "googlePlaceId" TEXT,
    "googleMapsUri" TEXT,
    "googleFormattedAddress" TEXT,
    "googleLookupStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "googleError" TEXT,
    "googleFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_enrichments_pkey" PRIMARY KEY ("foursquareVenueId")
);

CREATE TABLE "google_places_usage" (
    "date" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_places_usage_pkey" PRIMARY KEY ("date")
);

ALTER TABLE "sync_jobs"
ADD COLUMN "googlePlacesCalls" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "googlePlacesRunLimit" INTEGER,
ADD COLUMN "googlePlacesApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googlePlacesAllowFallback" BOOLEAN NOT NULL DEFAULT true;
