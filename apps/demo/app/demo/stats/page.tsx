import { StatsClient, type PreviewPeriodDatum } from "@/components/stats-client";
import type { FoursquareSticker } from "@/lib/demo-types";
import { sitePath } from "@/lib/site-path";

const OH_HEY_STICKER: FoursquareSticker = {
  id: "hi_e31743",
  name: "Oh Hey",
  image: { prefix: "https://fastly.4sqi.net/img/sticker/", name: "/hi_e31743.png" },
  group: { name: "Special" },
  unlockText: "Hello, Bonjour, Hola, Ciao, Konnichiwa, this sticker.",
};

const TOP_CITIES = [
  { city: "New York", count: 1203 },
  { city: "Paris", count: 487 },
  { city: "London", count: 312 },
  { city: "Barcelona", count: 198 },
  { city: "Rome", count: 156 },
];

// Pre-generated static map images — no API key needed at runtime.
// Regenerate with: node scripts/generate-demo-maps.js
const MAP_ALLTIME = sitePath("/demo-map-alltime.png");
const MAP_WEEK    = sitePath("/demo-map-week.png");
const MAP_30D     = sitePath("/demo-map-30d.png");
const MAP_90D     = sitePath("/demo-map-90d.png");

function makePeriodData(
  total: number,
  avgPerWeek: number,
  mayorships: number,
  venues: PreviewPeriodDatum["venues"],
  categories: PreviewPeriodDatum["categories"],
  cities: PreviewPeriodDatum["cities"],
  byHour: PreviewPeriodDatum["byHour"],
  mapUrl: string | null,
): PreviewPeriodDatum {
  return { venues, categories, cities, byHour, summary: { total, avgPerWeek, mayorships }, mapUrl };
}

export default function PreviewStats() {
  const previewPeriodData: Record<string, PreviewPeriodDatum> = {
    week: makePeriodData(9, 9, 0,
      [
        { venueId: "v1", venueName: "Cafe Grumpy",     count: 3 },
        { venueId: "v3", venueName: "Roberta's Pizza", count: 2 },
        { venueId: "v6", venueName: "Prospect Park",   count: 1 },
        { venueId: "v11", venueName: "Sweetleaf Coffee", count: 1 },
        { venueId: "v15", venueName: "Diner",           count: 1 },
      ],
      [
        { category: "Coffee Shop", count: 4 },
        { category: "Restaurant",  count: 3 },
        { category: "Park",        count: 1 },
      ],
      [
        { city: "New York", count: 8 },
        { city: "Paris",    count: 1 },
      ],
      [
        { hour: 8, count: 2 }, { hour: 9, count: 2 }, { hour: 12, count: 2 },
        { hour: 19, count: 1 }, { hour: 20, count: 2 },
      ],
      MAP_WEEK,
    ),
    "30d": makePeriodData(38, 8.7, 1,
      [
        { venueId: "v1",  venueName: "Cafe Grumpy",          count: 11 },
        { venueId: "v3",  venueName: "Roberta's Pizza",      count: 8  },
        { venueId: "v2",  venueName: "Le Comptoir du Relais", count: 5 },
        { venueId: "v6",  venueName: "Prospect Park",        count: 4  },
        { venueId: "v11", venueName: "Sweetleaf Coffee",     count: 3  },
      ],
      [
        { category: "Coffee Shop", count: 19 },
        { category: "Restaurant",  count: 11 },
        { category: "Park",        count: 5  },
        { category: "Bar",         count: 3  },
      ],
      [
        { city: "New York", count: 28 },
        { city: "Paris",    count: 7  },
        { city: "London",   count: 3  },
      ],
      [
        { hour: 7, count: 2 }, { hour: 8, count: 6 }, { hour: 9, count: 7 },
        { hour: 10, count: 3 }, { hour: 12, count: 6 }, { hour: 13, count: 4 },
        { hour: 18, count: 3 }, { hour: 19, count: 5 }, { hour: 20, count: 2 },
      ],
      MAP_30D,
    ),
    "90d": makePeriodData(112, 8.6, 4,
      [
        { venueId: "v1",  venueName: "Cafe Grumpy",          count: 28 },
        { venueId: "v3",  venueName: "Roberta's Pizza",      count: 19 },
        { venueId: "v2",  venueName: "Le Comptoir du Relais", count: 11 },
        { venueId: "v6",  venueName: "Prospect Park",        count: 9  },
        { venueId: "v13", venueName: "Barrafina",            count: 7  },
      ],
      [
        { category: "Coffee Shop", count: 48 },
        { category: "Restaurant",  count: 34 },
        { category: "Park",        count: 15 },
        { category: "Bar",         count: 12 },
        { category: "Gym",         count: 8  },
      ],
      [
        { city: "New York",  count: 82 },
        { city: "Paris",     count: 18 },
        { city: "London",    count: 9  },
        { city: "Barcelona", count: 4  },
      ],
      [
        { hour: 7, count: 4  }, { hour: 8, count: 14 }, { hour: 9, count: 18 },
        { hour: 10, count: 9 }, { hour: 11, count: 7  }, { hour: 12, count: 16 },
        { hour: 13, count: 12 }, { hour: 17, count: 8 }, { hour: 18, count: 11 },
        { hour: 19, count: 16 }, { hour: 20, count: 14 }, { hour: 21, count: 9 },
      ],
      MAP_90D,
    ),
  };

  return (
    <StatsClient
      totalCheckins={2847}
      uniqueVenues={892}
      mayorGains={47}
      mayorLosses={31}
      mayorshipsAllTime={23}
      topVenues={[
        { venueId: "v1", venueName: "Cafe Grumpy", count: 45 },
        { venueId: "v2", venueName: "Roberta's Pizza", count: 38 },
        { venueId: "v3", venueName: "Le Comptoir du Relais", count: 31 },
        { venueId: "v4", venueName: "Prospect Park", count: 27 },
        { venueId: "v5", venueName: "Barrafina", count: 22 },
      ]}
      topCities={TOP_CITIES}
      topCategories={[
        { category: "Coffee Shop", count: 312 },
        { category: "Restaurant", count: 278 },
        { category: "Park", count: 189 },
        { category: "Bar", count: 156 },
        { category: "Gym", count: 134 },
      ]}
      byYear={[
        { year: 2014, count: 89 },
        { year: 2015, count: 234 },
        { year: 2016, count: 312 },
        { year: 2017, count: 298 },
        { year: 2018, count: 356 },
        { year: 2019, count: 412 },
        { year: 2020, count: 87 },
        { year: 2021, count: 156 },
        { year: 2022, count: 289 },
        { year: 2023, count: 312 },
        { year: 2024, count: 198 },
        { year: 2025, count: 87 },
        { year: 2026, count: 17 },
      ]}
      byDayOfWeek={[
        { day: "Monday", count: 312 },
        { day: "Tuesday", count: 287 },
        { day: "Wednesday", count: 334 },
        { day: "Thursday", count: 398 },
        { day: "Friday", count: 467 },
        { day: "Saturday", count: 589 },
        { day: "Sunday", count: 460 },
      ]}
      byHourOfDay={[
        { hour: 0, count: 12 }, { hour: 1, count: 8 }, { hour: 2, count: 4 },
        { hour: 3, count: 3 }, { hour: 4, count: 2 }, { hour: 5, count: 6 },
        { hour: 6, count: 18 }, { hour: 7, count: 45 }, { hour: 8, count: 134 },
        { hour: 9, count: 187 }, { hour: 10, count: 112 }, { hour: 11, count: 98 },
        { hour: 12, count: 201 }, { hour: 13, count: 178 }, { hour: 14, count: 89 },
        { hour: 15, count: 76 }, { hour: 16, count: 92 }, { hour: 17, count: 134 },
        { hour: 18, count: 167 }, { hour: 19, count: 234 }, { hour: 20, count: 256 },
        { hour: 21, count: 198 }, { hour: 22, count: 123 }, { hour: 23, count: 67 },
      ]}
      lastSyncedAt={new Date("2026-03-22T14:32:00Z")}
      firstCheckinTimestamp={1394841600}
      mapUrl={MAP_ALLTIME}
      stickers={[OH_HEY_STICKER]}
      featuredSticker={OH_HEY_STICKER}
      isPreview={true}
      previewPeriodData={previewPeriodData}
    />
  );
}
