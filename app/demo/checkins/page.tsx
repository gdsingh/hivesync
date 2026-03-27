import { CheckinsClient } from "@/components/checkins-client";

const DUMMY_CHECKINS = [
  { checkinId: "1",  calendarEventId: "evt1",  calendarEventUrl: null, venueId: "v1",  venueName: "Cafe Grumpy",             venueCity: "Brooklyn, NY",     venueCategory: "Coffee Shop",      checkinTimestamp: 1742600400, isMayor: true,  description: "💬 morning cortado before the studio\n\nhttps://foursquare.com/checkin/abc1", stickerImageUrl: null, syncedAt: new Date("2026-03-21T10:00:00Z") },
  { checkinId: "2",  calendarEventId: "evt2",  calendarEventUrl: null, venueId: "v2",  venueName: "Le Comptoir du Relais",   venueCity: "Paris, France",    venueCategory: "French Restaurant", checkinTimestamp: 1742514000, isMayor: false, description: "💬 sole meunière. finally.\n\n👥 with Marie Curie, F. Scott Fitzgerald\n\nhttps://foursquare.com/checkin/abc2", stickerImageUrl: null, syncedAt: new Date("2026-03-20T09:00:00Z") },
  { checkinId: "3",  calendarEventId: "evt3",  calendarEventUrl: null, venueId: "v3",  venueName: "Roberta's Pizza",         venueCity: "Brooklyn, NY",     venueCategory: "Pizza Place",       checkinTimestamp: 1742427600, isMayor: false, description: "💬 pepperoni + fennel sausage, no notes\n\nhttps://foursquare.com/checkin/abc3", stickerImageUrl: null, syncedAt: new Date("2026-03-19T08:30:00Z") },
  { checkinId: "4",  calendarEventId: "evt4",  calendarEventUrl: null, venueId: "v4",  venueName: "Borough Market",          venueCity: "London, England",  venueCategory: "Market",            checkinTimestamp: 1742341200, isMayor: false, description: "• Foodie! 5pts\n\nhttps://foursquare.com/checkin/abc4", stickerImageUrl: null, syncedAt: new Date("2026-03-18T15:00:00Z") },
  { checkinId: "5",  calendarEventId: "evt5",  calendarEventUrl: null, venueId: "v5",  venueName: "Café de Flore",           venueCity: "Paris, France",    venueCategory: "Café",              checkinTimestamp: 1742254800, isMayor: false, description: "❤️ liked by Gertrude Stein, James Joyce\n\nhttps://foursquare.com/checkin/abc5", stickerImageUrl: null, syncedAt: new Date("2026-03-17T16:45:00Z") },
  { checkinId: "6",  calendarEventId: "evt6",  calendarEventUrl: null, venueId: "v6",  venueName: "Prospect Park",           venueCity: "Brooklyn, NY",     venueCategory: "Park",              checkinTimestamp: 1742168400, isMayor: false, description: null, stickerImageUrl: null, syncedAt: new Date("2026-03-16T12:00:00Z") },
  { checkinId: "7",  calendarEventId: "evt7",  calendarEventUrl: null, venueId: "v7",  venueName: "Bar Marsella",            venueCity: "Barcelona, Spain", venueCategory: "Bar",               checkinTimestamp: 1742082000, isMayor: false, description: "💬 the absinthe is older than everyone in here\n\n👥 with F. Scott Fitzgerald\n\nhttps://foursquare.com/checkin/abc7", stickerImageUrl: null, syncedAt: new Date("2026-03-15T22:00:00Z") },
  { checkinId: "8",  calendarEventId: "evt8",  calendarEventUrl: null, venueId: "v8",  venueName: "The Shard",               venueCity: "London, England",  venueCategory: "Landmark",          checkinTimestamp: 1741995600, isMayor: false, description: null, stickerImageUrl: null, syncedAt: new Date("2026-03-14T14:00:00Z") },
  { checkinId: "9",  calendarEventId: "evt9",  calendarEventUrl: null, venueId: "v9",  venueName: "Roscioli",                venueCity: "Rome, Italy",      venueCategory: "Restaurant",        checkinTimestamp: 1741909200, isMayor: false, description: "💬 cacio e pepe that made me reconsider everything\n\n❤️ liked by James Joyce\n\nhttps://foursquare.com/checkin/abc9", stickerImageUrl: null, syncedAt: new Date("2026-03-13T20:00:00Z") },
  { checkinId: "10", calendarEventId: "evt10", calendarEventUrl: null, venueId: "v10", venueName: "JFK International Airport", venueCity: "New York, NY",   venueCategory: "Airport",           checkinTimestamp: 1741822800, isMayor: false, description: null, stickerImageUrl: null, syncedAt: new Date("2026-03-12T07:00:00Z") },
  { checkinId: "11", calendarEventId: "evt11", calendarEventUrl: null, venueId: "v11", venueName: "Sweetleaf Coffee",         venueCity: "Brooklyn, NY",     venueCategory: "Coffee Shop",       checkinTimestamp: 1741736400, isMayor: true,  description: "• Local! 10pts\n\nhttps://foursquare.com/checkin/abc11", stickerImageUrl: null, syncedAt: new Date("2026-03-11T09:45:00Z") },
  { checkinId: "12", calendarEventId: "evt12", calendarEventUrl: null, venueId: "v12", venueName: "Shakespeare and Company", venueCity: "Paris, France",    venueCategory: "Bookstore",         checkinTimestamp: 1741650000, isMayor: false, description: "💬 found a first edition. didn't buy it. still thinking about it.\n\nhttps://foursquare.com/checkin/abc12", stickerImageUrl: null, syncedAt: new Date("2026-03-10T15:30:00Z") },
  { checkinId: "13", calendarEventId: "evt13", calendarEventUrl: null, venueId: "v13", venueName: "Barrafina",                venueCity: "London, England",  venueCategory: "Tapas Restaurant",  checkinTimestamp: 1741563600, isMayor: false, description: null, stickerImageUrl: null, syncedAt: new Date("2026-03-09T19:00:00Z") },
  { checkinId: "14", calendarEventId: "evt14", calendarEventUrl: null, venueId: "v14", venueName: "Piazza Navona",            venueCity: "Rome, Italy",      venueCategory: "Landmark",          checkinTimestamp: 1741477200, isMayor: false, description: "👥 with Gertrude Stein\n\nhttps://foursquare.com/checkin/abc14", stickerImageUrl: null, syncedAt: new Date("2026-03-08T13:30:00Z") },
  { checkinId: "15", calendarEventId: "evt15", calendarEventUrl: null, venueId: "v15", venueName: "Diner",                   venueCity: "Brooklyn, NY",     venueCategory: "Diner",             checkinTimestamp: 1741390800, isMayor: false, description: "💬 eggs and the Times. perfect Sunday.\n\nhttps://foursquare.com/checkin/abc15", stickerImageUrl: null, syncedAt: new Date("2026-03-07T11:00:00Z") },
];

export default function PreviewCheckins() {
  return (
    <CheckinsClient
      initialCheckins={DUMMY_CHECKINS}
      total={2847}
      unfilteredTotal={2847}
      page={1}
      pageSize={15}
      lastSyncedAt={new Date("2026-03-22T14:32:00Z")}
      initialFoursquareTotal={3241}
    />
  );
}
