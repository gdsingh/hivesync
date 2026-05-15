"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Cell, LabelList } from "recharts";
import type { FoursquareSticker } from "@/lib/sync";
import {
  LuCrown, LuTrophy, LuTag, LuMapPin, LuCalendarDays, LuCalendar,
  LuCoffee, LuUtensils, LuWine, LuShoppingBag, LuTreePine,
  LuDumbbell, LuBedDouble, LuPlane, LuTrainFront, LuLandmark,
  LuFilm, LuFuel, LuBuilding2, LuGraduationCap, LuHeart,
  LuMusic, LuChevronDown, LuClock, LuChartNoAxesColumn,
} from "react-icons/lu";

interface Props {
  totalCheckins: number;
  uniqueVenues: number;
  mayorGains: number;
  mayorLosses: number;
  mayorshipsAllTime: number;
  topVenues: { venueId: string | null; venueName: string | null; count: number }[];
  topCities: { city: string; count: number }[];
  topCategories: { category: string; count: number }[];
  byYear: { year: number; count: number }[];
  foursquareByYear?: { year: number; total: number }[];
  byDayOfWeek: { day: string; count: number }[];
  byHourOfDay: { hour: number; count: number }[];
  lastSyncedAt: Date | null;
  firstCheckinTimestamp: number | null;
  mapUrl: string | null;
  stickers: FoursquareSticker[];
  featuredSticker: FoursquareSticker | null;
  isPreview?: boolean;
  previewPeriodData?: Record<string, PreviewPeriodDatum>;
}

function getCategoryIcon(category: string | null) {
  if (!category) return LuMapPin;
  const c = category.toLowerCase();
  if (/coffee|café|cafe|tea/.test(c)) return LuCoffee;
  if (/bar|cocktail|beer|brewery|pub|nightlife|lounge/.test(c)) return LuWine;
  if (/restaurant|food|pizza|burger|sushi|diner|bistro|steakhouse|bbq|taco|noodle|sandwich|bakery|dessert|ice cream/.test(c)) return LuUtensils;
  if (/shop|store|market|mall|boutique|retail|supermarket|grocery/.test(c)) return LuShoppingBag;
  if (/park|garden|trail|nature|beach|lake|mountain|outdoors|recreation/.test(c)) return LuTreePine;
  if (/gym|fitness|sport|yoga|crossfit|pool|stadium|arena/.test(c)) return LuDumbbell;
  if (/hotel|motel|inn|hostel|resort|lodge/.test(c)) return LuBedDouble;
  if (/airport|terminal|airline/.test(c)) return LuPlane;
  if (/train|subway|metro|transit|bus|station/.test(c)) return LuTrainFront;
  if (/museum|gallery|theater|theatre|cinema|film|concert|arts/.test(c)) return LuFilm;
  if (/landmark|monument|historic|government|library/.test(c)) return LuLandmark;
  if (/gas|fuel|parking|garage/.test(c)) return LuFuel;
  if (/office|coworking|work|building/.test(c)) return LuBuilding2;
  if (/school|university|college|campus|education/.test(c)) return LuGraduationCap;
  if (/hospital|clinic|pharmacy|medical|health/.test(c)) return LuHeart;
  if (/music|club|dj|karaoke/.test(c)) return LuMusic;
  return LuMapPin;
}

function RankedList({ items, renderLabel }: {
  items: { count: number; label: string; icon?: React.ReactNode }[];
  renderLabel: (item: { count: number; label: string; icon?: React.ReactNode }, rank: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3 py-1">
          <span className="text-xs text-muted-foreground/40 font-[family-name:var(--font-geist-mono)] w-4 text-right shrink-0">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            {renderLabel(item, i + 1)}
          </div>
          <span className="text-xs font-[family-name:var(--font-geist-mono)] text-muted-foreground shrink-0">
            {item.count.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

const chartConfig = {
  count: { label: "Check-ins", color: "hsl(var(--foreground))" },
} satisfies ChartConfig;

function yearCompletionFill(synced: number, total: number): string {
  if (total <= 0) return "#888";
  const ratio = Math.min(synced / total, 1);
  if (ratio >= 1.0) return "hsl(142, 71%, 45%)";
  if (ratio >= 0.75) return "hsl(142, 60%, 55%)";
  if (ratio >= 0.5) return "hsl(25, 95%, 53%)";
  if (ratio >= 0.25) return "hsl(38, 92%, 50%)";
  return "#888";
}

function YearBarChart({ items, foursquareByYear }: {
  items: { label: string; count: number }[];
  foursquareByYear?: { year: number; total: number }[];
}) {
  const data = items.map((i) => ({ label: `'${i.label.slice(2)}`, count: i.count, year: parseInt(i.label) }));
  return (
    <ChartContainer config={chartConfig} className="h-28 w-full">
      <BarChart data={data} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent hideLabel={false} nameKey="count" />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
          {data.map((d, i) => {
            const fsq = foursquareByYear?.find((f) => f.year === d.year);
            const fill = fsq ? yearCompletionFill(d.count, fsq.total) : "#888";
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function DayBarChart({ items }: { items: { label: string; count: number }[] }) {
  const data = items.map((i) => ({ label: i.label[0], count: i.count }));
  return (
    <ChartContainer config={chartConfig} className="h-28 w-full">
      <BarChart data={data} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent hideLabel={false} nameKey="count" />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
          {data.map((_, i) => <Cell key={i} fill="#888" />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Groups 24 hourly buckets into 8 × 3-hour slots: 12a 3a 6a 9a 12p 3p 6p 9p
const HOUR_BUCKETS = [
  { label: "12a", hours: [0, 1, 2] },
  { label: "3a",  hours: [3, 4, 5] },
  { label: "6a",  hours: [6, 7, 8] },
  { label: "9a",  hours: [9, 10, 11] },
  { label: "12p", hours: [12, 13, 14] },
  { label: "3p",  hours: [15, 16, 17] },
  { label: "6p",  hours: [18, 19, 20] },
  { label: "9p",  hours: [21, 22, 23] },
];

function HourBarChart({ items }: { items: { hour: number; count: number }[] }) {
  const data = HOUR_BUCKETS.map((b) => ({
    label: b.label,
    count: b.hours.reduce((sum, h) => sum + (items.find((i) => i.hour === h)?.count ?? 0), 0),
  }));
  return (
    <ChartContainer config={chartConfig} className="h-28 w-full">
      <BarChart data={data} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent hideLabel={false} nameKey="count" />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
          {data.map((_, i) => <Cell key={i} fill="#888" />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Matches the tierConfig in the cities API / stats page map URL builder.
const CITY_TIER_RGB = [
  "147,197,253",
  "96,165,250",
  "251,191,36",
  "249,115,22",
  "239,68,68",
];

function cityTierRgb(i: number, n: number): string {
  const tier = n === 1 ? 4 : Math.min(4, Math.floor((i / n) * 5));
  return CITY_TIER_RGB[4 - tier];
}

type VenueRow = { venueId: string | null; venueName: string | null; count: number };

export type PreviewPeriodDatum = {
  venues: VenueRow[];
  categories: { category: string; count: number }[];
  cities: { city: string; count: number }[];
  byHour: { hour: number; count: number }[];
  summary: { total: number; avgPerWeek: number; mayorships: number };
  mapUrl: string | null;
};

export function StatsClient({
  totalCheckins,
  uniqueVenues,
  mayorGains,
  mayorLosses,
  mayorshipsAllTime,
  topVenues,
  topCities,
  topCategories,
  byYear,
  foursquareByYear,
  byDayOfWeek,
  byHourOfDay,
  lastSyncedAt,
  firstCheckinTimestamp,
  mapUrl,
  stickers,
  featuredSticker,
  isPreview = false,
  previewPeriodData,
}: Props) {
  const currentYear = new Date().getFullYear();
  const pastYears = byYear
    .filter((y) => y.year !== currentYear)
    .map((y) => y.year)
    .sort((a, b) => b - a);

  const pills = [
    { key: "week",  label: "7d" },
    { key: "30d",   label: "30d" },
    { key: "90d",   label: "90d" },
    ...(pastYears.length === 0 ? [{ key: "year", label: "this year" }] : []),
  ];

  const [period, setPeriod] = useState(isPreview && !previewPeriodData ? "all" : "90d");
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);
  const [showCustomRange, setShowCustomRange] = useState(false);

  const activeRange = rangeFrom
    ? { from: format(rangeFrom, "yyyy-MM-dd"), to: rangeTo ? format(rangeTo, "yyyy-MM-dd") : format(rangeFrom, "yyyy-MM-dd") }
    : null;
  const [periodVenues, setPeriodVenues] = useState<VenueRow[] | null>(null);
  const [periodCategories, setPeriodCategories] = useState<{ category: string; count: number }[] | null>(null);
  const [periodCities, setPeriodCities] = useState<{ city: string; count: number }[] | null>(null);
  const [periodMapUrl, setPeriodMapUrl] = useState<string | null | undefined>(undefined);
  const [periodByHour, setPeriodByHour] = useState<{ hour: number; count: number }[] | null>(null);
  const [periodSummary, setPeriodSummary] = useState<{ total: number; avgPerWeek: number; mayorships: number } | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  const allTimeAvgPerWeek = (() => {
    if (!firstCheckinTimestamp) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const weeks = (nowSec - firstCheckinTimestamp) / (7 * 24 * 3600);
    return weeks > 0 ? Math.round((totalCheckins / weeks) * 10) / 10 : null;
  })();

  useEffect(() => {
    if (period === "all" && !activeRange) {
      setPeriodVenues(null); setPeriodCategories(null); setPeriodCities(null);
      setPeriodMapUrl(undefined); setPeriodByHour(null); setPeriodSummary(null);
      return;
    }
    if (isPreview) {
      const d = previewPeriodData?.[period];
      if (d) {
        setPeriodVenues(d.venues);
        setPeriodCategories(d.categories);
        setPeriodCities(d.cities);
        setPeriodMapUrl(d.mapUrl);
        setPeriodByHour(d.byHour);
        setPeriodSummary(d.summary);
      }
      return;
    }
    const params = activeRange
      ? `from=${activeRange.from}&to=${activeRange.to}`
      : `period=${period}`;
    setPeriodLoading(true);
    setPeriodVenues(null); setPeriodCategories(null); setPeriodCities(null); setPeriodByHour(null); setPeriodSummary(null);
    Promise.all([
      fetch(`/api/stats/venues?${params}`).then((r) => r.json()),
      fetch(`/api/stats/categories?${params}`).then((r) => r.json()),
      fetch(`/api/stats/cities?${params}`).then((r) => r.json()),
      fetch(`/api/stats/by-hour?${params}`).then((r) => r.json()),
      fetch(`/api/stats/summary?${params}`).then((r) => r.json()),
    ])
      .then(([v, c, ci, h, s]) => {
        setPeriodVenues(v);
        setPeriodCategories(c);
        setPeriodCities(ci.cities);
        setPeriodMapUrl(ci.mapUrl ?? null);
        setPeriodByHour(h);
        setPeriodSummary(s);
      })
      .catch(() => {
        setPeriodVenues([]); setPeriodCategories([]); setPeriodCities([]);
        setPeriodByHour([]); setPeriodMapUrl(null);
      })
      .finally(() => setPeriodLoading(false));
  }, [period, rangeFrom, rangeTo, isPreview, previewPeriodData]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPeriodYear = pastYears.includes(Number(period)) || Number(period) === currentYear;
  const isFiltered = activeRange || period !== "all";
  const displayedVenues = isFiltered ? (periodVenues ?? []) : topVenues;
  const displayedCategories = isFiltered ? (periodCategories ?? []) : topCategories;
  const displayedCities = isFiltered ? (periodCities ?? []) : topCities;
  const displayedMapUrl = isFiltered ? (periodMapUrl === undefined ? null : periodMapUrl) : mapUrl;
  const displayedByHour = isFiltered ? (periodByHour ?? []) : byHourOfDay;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8 sm:px-4">
      <AppHeader lastSyncedAt={lastSyncedAt} />

      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <LuChartNoAxesColumn size={16} className="text-muted-foreground" />
              Stats
            </h1>
            <p className="text-xs text-muted-foreground mt-1">All-time check-in stats.</p>
          </div>
          {featuredSticker && (
            <a href="/stickers" className="group relative hidden flex-col items-center self-center min-[380px]:flex">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center p-1.5">
                <img
                  src={`${featuredSticker.image.prefix}300${featuredSticker.image.name}`}
                  alt={featuredSticker.name}
                  width={32}
                  height={32}
                  className="shrink-0"
                />
              </div>
              <div className="absolute top-0 left-full ml-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-44 z-10">
                <div className="bg-popover text-popover-foreground text-[11px] rounded-md px-2.5 py-1.5 shadow-md border leading-relaxed text-center">
                  {featuredSticker.group?.name && <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">{featuredSticker.group.name}</p>}
                  <p className="font-medium text-xs mb-0.5">{featuredSticker.name}</p>
                  {featuredSticker.unlockText && <p className="text-muted-foreground">{featuredSticker.unlockText.trim()}</p>}
                  {featuredSticker.teaseText && <p className="text-muted-foreground/70 italic mt-1">{featuredSticker.teaseText.trim()}</p>}
                </div>
              </div>
            </a>
          )}
        </div>
        <div className="shrink-0 text-right flex flex-col gap-1">
          <p className="text-sm font-medium font-[family-name:var(--font-geist-mono)]">{uniqueVenues.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">unique venues</p>
        </div>
      </div>

      <Separator />

      {totalCheckins === 0 ? (
        <div className="flex justify-center">
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">⚠️ No check-ins found — run a <a href="/home#manual-sync" className="underline hover:opacity-70 transition-opacity">manual sync</a> or wait for a scheduled run.</span>
        </div>
      ) : (<>

      {/* period picker */}
      <div className="space-y-2">
        {/* row: summary left, pills right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* left: summary */}
          <div className="text-xs text-muted-foreground sm:shrink-0">
            {period === "all" && !activeRange ? (
              <span>
                <span className="font-medium text-foreground font-[family-name:var(--font-geist-mono)]">{totalCheckins.toLocaleString()}</span>
                {" "}check-ins
                {allTimeAvgPerWeek !== null && (
                  <>
                    <span className="mx-1.5 text-border">·</span>
                    <span className="font-medium text-foreground font-[family-name:var(--font-geist-mono)]">~{allTimeAvgPerWeek}</span>
                    {" "}/wk
                  </>
                )}
                {mayorshipsAllTime > 0 && (
                  <>
                    <span className="mx-1.5 text-border">·</span>
                    <LuCrown size={10} className="inline text-amber-400 mr-0.5 -mt-0.5" />
                    <span className="font-medium text-foreground font-[family-name:var(--font-geist-mono)]">{mayorshipsAllTime}</span>
                    {" "}earned
                  </>
                )}
              </span>
            ) : periodLoading ? (
              <Skeleton className="h-3 w-32" />
            ) : periodSummary ? (
              <span>
                <span className="font-medium text-foreground font-[family-name:var(--font-geist-mono)]">{periodSummary.total.toLocaleString()}</span>
                {" "}check-ins
                <span className="mx-1.5 text-border">·</span>
                <span className="font-medium text-foreground font-[family-name:var(--font-geist-mono)]">~{periodSummary.avgPerWeek}</span>
                {" "}/wk
                {periodSummary.mayorships > 0 && (
                  <>
                    <span className="mx-1.5 text-border">·</span>
                    <LuCrown size={10} className="inline text-amber-400 mr-0.5 -mt-0.5" />
                    <span className="font-medium text-foreground font-[family-name:var(--font-geist-mono)]">{periodSummary.mayorships}</span>
                    {" "}earned
                  </>
                )}
              </span>
            ) : null}
          </div>

          {/* right: pills */}
          <div className="flex flex-wrap gap-1 items-center sm:justify-end">
            {pills.map((p) => (
              <button
                key={p.key}
                onClick={() => { setRangeFrom(undefined); setRangeTo(undefined); setShowCustomRange(false); setPeriod(period === p.key ? "all" : p.key); }}
                className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                  period === p.key && !activeRange
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
            {pastYears.length > 0 && (
              <>
                <span className="text-border text-xs">·</span>
                {isPeriodYear && !activeRange && (
                  <button
                    onClick={() => { setRangeFrom(undefined); setRangeTo(undefined); setShowCustomRange(false); setPeriod("all"); }}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium transition-colors"
                  >
                    {period}
                  </button>
                )}
                <div className="relative inline-flex items-center">
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) { setRangeFrom(undefined); setRangeTo(undefined); setShowCustomRange(false); setPeriod(e.target.value); } }}
                    className="text-[11px] px-2 py-0.5 pr-5 rounded-full appearance-none cursor-pointer transition-colors bg-transparent border-0 outline-none text-muted-foreground hover:text-foreground"
                  >
                    <option value="">by year</option>
                    {[...pastYears].reverse().map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                    <option value={String(currentYear)}>{currentYear}</option>
                  </select>
                  <LuChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </>
            )}
            <span className="text-border text-xs">·</span>
            <button
              onClick={() => { setRangeFrom(undefined); setRangeTo(undefined); setShowCustomRange(false); setPeriod("all"); }}
              className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                period === "all" && !activeRange && !showCustomRange
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              all time
            </button>
            <span className="text-border text-xs">·</span>
            <button
              onClick={() => { setPeriod("all"); setShowCustomRange((v) => !v); if (showCustomRange) { setRangeFrom(undefined); setRangeTo(undefined); } }}
              className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                showCustomRange || activeRange
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              custom
            </button>
          </div>
        </div>

        {/* custom date range row — shown below when toggled */}
        {(showCustomRange || activeRange) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={`h-auto min-h-7 w-full whitespace-normal text-left text-xs justify-start font-normal gap-1.5 sm:h-7 sm:w-auto sm:whitespace-nowrap ${!rangeFrom && !rangeTo && "text-muted-foreground"}`}>
                  <LuCalendar size={11} />
                  {rangeFrom ? (
                    !rangeTo || format(rangeFrom, "yyyy-MM-dd") === format(rangeTo, "yyyy-MM-dd") ? (
                      <>{format(rangeFrom, "MMM")} <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom, "d")}</span>, <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom, "yyyy")}</span></>
                    ) : (
                      <>
                        {format(rangeFrom, "MMM")} <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom, "d")}</span>, <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom, "yyyy")}</span>
                        <span className="mx-1 opacity-40">→</span>
                        {format(rangeTo, "MMM")} <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeTo, "d")}</span>, <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeTo, "yyyy")}</span>
                      </>
                    )
                  ) : "select date or range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-[calc(100vw-3rem)] overflow-x-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: rangeFrom, to: rangeTo }}
                  onSelect={(r: DateRange | undefined) => { setRangeFrom(r?.from); setRangeTo(r?.to); }}
                  initialFocus
                  numberOfMonths={1}
                  className="p-2"
                  classNames={{
                    month: "space-y-2",
                    caption_label: "text-xs font-medium",
                    head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem]",
                    row: "flex w-full mt-1",
                    cell: "h-8 w-8 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                  }}
                />
              </PopoverContent>
            </Popover>
            {(rangeFrom || rangeTo) && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <button
                  onClick={() => { setRangeFrom(undefined); setRangeTo(undefined); }}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* top venues + categories */}
      {(displayedVenues.length > 0 || displayedCategories.length > 0 || periodLoading) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <LuTrophy size={13} className="text-muted-foreground" />
              <h2 className="text-sm font-medium">Top venues</h2>
            </div>
            {periodLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                ))}
              </div>
            ) : displayedVenues.length === 0 ? (
              <p className="text-xs text-muted-foreground">no check-ins in this period</p>
            ) : (
              <RankedList
                items={displayedVenues.map((v) => ({ label: v.venueName ?? "unknown", count: v.count }))}
                renderLabel={(item) => <span className="text-sm truncate block">{item.label}</span>}
              />
            )}
          </div>
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <LuTag size={13} className="text-muted-foreground" />
              <h2 className="text-sm font-medium">Top categories</h2>
            </div>
            {periodLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                ))}
              </div>
            ) : displayedCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground">no check-ins in this period</p>
            ) : (
              <RankedList
                items={displayedCategories.map((c) => ({ label: c.category, count: c.count }))}
                renderLabel={(item) => {
                  const Icon = getCategoryIcon(item.label);
                  return (
                    <span className="flex items-center gap-1.5 text-sm truncate">
                      <Icon size={12} className="text-muted-foreground shrink-0" />
                      {item.label}
                    </span>
                  );
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* top cities + map */}
      {(displayedCities.length > 0 || periodLoading) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LuMapPin size={13} className="text-muted-foreground" />
            <h2 className="text-sm font-medium">Top cities</h2>
          </div>
          {periodLoading ? (
            <Skeleton className="w-full h-40 rounded-xl" />
          ) : displayedMapUrl ? (
            <img src={displayedMapUrl} className="w-full rounded-xl border object-cover" alt="check-in locations" />
          ) : null}
          <div className="flex flex-wrap justify-between gap-y-1.5 pt-1">
            {periodLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-20 rounded-full" />)
              : displayedCities.map((c, i) => {
                  const rgb = cityTierRgb(i, displayedCities.length);
                  return (
                    <span
                      key={c.city}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]"
                      style={{ borderColor: `rgba(${rgb},0.4)`, color: `rgb(${rgb})`, backgroundColor: `rgba(${rgb},0.08)` }}
                    >
                      {c.city}
                      <span className="opacity-40">·</span>
                      <span className="font-[family-name:var(--font-geist-mono)]">{c.count}</span>
                    </span>
                  );
                })
            }
          </div>
        </div>
      )}

      {/* charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        {period === "all" ? (
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <LuCalendar size={13} className="text-muted-foreground" />
              <h2 className="text-sm font-medium">Check-ins by year</h2>
            </div>
            <YearBarChart items={byYear.map((y) => ({ label: String(y.year), count: y.count }))} foursquareByYear={foursquareByYear} />
          </div>
        ) : (
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <LuClock size={13} className="text-muted-foreground" />
              <h2 className="text-sm font-medium">Time of day</h2>
            </div>
            {periodLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <HourBarChart items={displayedByHour} />
            )}
          </div>
        )}

        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <LuCalendarDays size={13} className="text-muted-foreground" />
            <h2 className="text-sm font-medium">Most active day</h2>
          </div>
          <DayBarChart items={byDayOfWeek.map((d) => ({ label: d.day, count: d.count }))} />
        </div>
      </div>

      </>)}
    </div>
  );
}
