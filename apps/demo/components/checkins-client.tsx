"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { sitePath } from "@/lib/site-path";
import { format } from "date-fns";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FaFoursquare } from "react-icons/fa";
import {
  LuCalendarRange, LuX, LuCrown, LuLayoutList, LuRefreshCw,
  LuCoffee, LuUtensils, LuWine, LuShoppingBag, LuTreePine,
  LuDumbbell, LuBedDouble, LuPlane, LuTrainFront, LuLandmark,
  LuFilm, LuFuel, LuBuilding2, LuGraduationCap, LuHeart,
  LuMusic, LuMapPin,
} from "react-icons/lu";
import type { DateRange } from "react-day-picker";

interface Checkin {
  checkinId: string;
  calendarEventId: string;
  calendarEventUrl: string | null;
  venueId: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueCategory: string | null;
  checkinTimestamp: number | null;
  isMayor: boolean;
  description: string | null;
  stickerImageUrl: string | null;
  syncedAt: Date;
}

interface Props {
  initialCheckins: Checkin[];
  total: number;
  unfilteredTotal: number;
  page: number;
  pageSize: number;
  lastSyncedAt: Date | null;
  fromParam?: string;
  toParam?: string;
  initialFoursquareTotal?: number;
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

function getDayKey(ts: number | null): string {
  if (!ts) return "1970-01-01";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDayDisplay(key: string): React.ReactNode {
  if (key === "1970-01-01") return "unknown date";
  const d = new Date(key + "T12:00:00");
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return (
    <>
      {weekday}, {month}{" "}
      <span className="font-[family-name:var(--font-geist-mono)]">{d.getDate()}</span>,{" "}
      <span className="font-[family-name:var(--font-geist-mono)]">{d.getFullYear()}</span>
    </>
  );
}

function DayCheckbox({
  ids,
  selected,
  onToggle,
}: {
  ids: string[];
  selected: Set<string>;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const checkedCount = ids.filter((id) => selected.has(id)).length;
  const allChecked = checkedCount === ids.length;
  const someChecked = checkedCount > 0 && !allChecked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allChecked}
      onChange={onToggle}
      className="w-3.5 h-3.5 accent-foreground shrink-0"
    />
  );
}

function formatDateRange(from: Date | undefined, to: Date | undefined): React.ReactNode {
  if (!from) return null;
  const fmtDate = (d: Date) => (
    <>{format(d, "MMM")} <span className="font-[family-name:var(--font-geist-mono)]">{format(d, "d")}</span>, <span className="font-[family-name:var(--font-geist-mono)]">{format(d, "yyyy")}</span></>
  );
  if (!to || format(from, "yyyy-MM-dd") === format(to, "yyyy-MM-dd")) return fmtDate(from);
  return <>{fmtDate(from)} – {fmtDate(to)}</>;
}

export function CheckinsClient({ initialCheckins, total, unfilteredTotal, page, pageSize, lastSyncedAt, fromParam, toParam, initialFoursquareTotal }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isPreview = pathname.startsWith("/preview") || pathname.startsWith("/demo");
  const prefix = pathname.startsWith("/preview") ? "/preview" : pathname.startsWith("/demo") ? "/demo" : "";
  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ deleted: number; errors: number } | null>(null);
  const [resyncLoading, setResyncLoading] = useState(false);
  const [resyncResult, setResyncResult] = useState<{ synced: number; errors: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [showStop, setShowStop] = useState(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [foursquareTotal, setFoursquareTotal] = useState<number | null>(initialFoursquareTotal ?? null);

  useEffect(() => {
    if (initialFoursquareTotal != null) return;
    fetch("/api/foursquare/stats")
      .then((r) => r.json())
      .then((d) => setFoursquareTotal(d.totalCheckins ?? null))
      .catch(() => {});
  }, [initialFoursquareTotal]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const initialRange: DateRange | undefined = fromParam
    ? { from: new Date(fromParam + "T12:00:00"), to: toParam ? new Date(toParam + "T12:00:00") : undefined }
    : undefined;
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialRange);

  const totalPages = Math.ceil(total / pageSize);

  const grouped = useMemo(() => {
    const map = new Map<string, Checkin[]>();
    for (const c of checkins) {
      const key = getDayKey(c.checkinTimestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [checkins]);

  function buildUrl(range: DateRange | undefined, p = 1) {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"));
    if (range?.to && format(range.to, "yyyy-MM-dd") !== format(range.from!, "yyyy-MM-dd")) {
      params.set("to", format(range.to, "yyyy-MM-dd"));
    }
    const qs = params.toString();
    return sitePath(`${prefix}/checkins${qs ? `?${qs}` : ""}`);
  }

  function handleRangeSelect(range: DateRange | undefined) {
    setDateRange(range);
    if (range?.from && range?.to) {
      router.push(buildUrl(range));
      setCalendarOpen(false);
    } else if (range?.from && !range?.to) {
      // single date — navigate immediately
      router.push(buildUrl({ from: range.from, to: range.from }));
      setCalendarOpen(false);
    }
  }

  function clearFilter() {
    setDateRange(undefined);
    router.push(sitePath(`${prefix}/checkins`));
  }

  function getPageUrl(p: number) {
    return buildUrl(dateRange, p);
  }

  function PaginationBar() {
    const delta = 1;
    const pages: (number | "ellipsis")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "ellipsis") {
        pages.push("ellipsis");
      }
    }
    return (
      <div className="flex items-center justify-between">
        <PaginationPrevious
          href={page > 1 ? getPageUrl(page - 1) : undefined}
          className={`h-7 text-xs px-2 gap-1 ${page <= 1 ? "pointer-events-none opacity-30" : ""}`}
        />
        <Pagination className="w-auto flex-1 mx-2">
          <PaginationContent className="gap-0.5">
            {pages.map((p, i) =>
              p === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis className="h-7 w-7" />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink href={getPageUrl(p)} isActive={p === page} className="h-7 w-7 text-xs">
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
          </PaginationContent>
        </Pagination>
        <PaginationNext
          href={page < totalPages ? getPageUrl(page + 1) : undefined}
          className={`h-7 text-xs px-2 gap-1 ${page >= totalPages ? "pointer-events-none opacity-30" : ""}`}
        />
      </div>
    );
  }

  function clearResults() {
    setBulkResult(null);
    setResyncResult(null);
  }

  function autoClearResults() {
    setTimeout(() => { setBulkResult(null); setResyncResult(null); }, 3000);
  }

  function toggleSelect(id: string) {
    clearResults();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleDay(ids: string[]) {
    clearResults();
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function startStopTimer() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => setShowStop(true), 500);
  }

  function clearStopTimer() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    setShowStop(false);
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    clearStopTimer();
    setBulkLoading(false);
    setResyncLoading(false);
  }

  async function handleResync() {
    const controller = new AbortController();
    abortRef.current = controller;
    setResyncLoading(true);
    setResyncResult(null);
    setBulkResult(null);
    startStopTimer();
    const ids = Array.from(selected);
    if (isPreview) {
      setResyncResult({ synced: ids.length, errors: 0 });
      autoClearResults();
      setSelected(new Set());
      abortRef.current = null;
      clearStopTimer();
      setResyncLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/checkins/resync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
        signal: controller.signal,
      });
      const data = await res.json();
      setResyncResult({ synced: data.synced ?? 0, errors: data.errors ?? 0 });
      autoClearResults();
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
    } finally {
      abortRef.current = null;
      clearStopTimer();
      setResyncLoading(false);
    }
  }

  async function handleBulk() {
    const controller = new AbortController();
    abortRef.current = controller;
    setBulkLoading(true);
    setBulkResult(null);
    startStopTimer();
    const ids = Array.from(selected);
    if (isPreview) {
      setCheckins((prev) => prev.filter((c) => !selected.has(c.checkinId)));
      setSelected(new Set());
      setBulkResult({ deleted: ids.length, errors: 0 });
      autoClearResults();
      abortRef.current = null;
      clearStopTimer();
      setBulkLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/checkins/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, mode: "delete" }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok) {
        setCheckins((prev) => prev.filter((c) => !selected.has(c.checkinId)));
        setSelected(new Set());
        setBulkResult({ deleted: data.deleted, errors: data.errors ?? 0 });
        autoClearResults();
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
    } finally {
      abortRef.current = null;
      clearStopTimer();
      setBulkLoading(false);
    }
  }

  const hasFilter = !!fromParam;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <AppHeader lastSyncedAt={lastSyncedAt} />

      {/* header */}
      <div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <LuLayoutList size={16} className="text-muted-foreground" />
              Check-ins
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground text-background text-xs font-medium font-[family-name:var(--font-geist-mono)]">
                {total.toLocaleString()}
              </span>
            </h1>
            {foursquareTotal == null ? (
              <Skeleton className="h-4 w-48 mt-1" />
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-[family-name:var(--font-geist-mono)]">{foursquareTotal > 0 ? ((unfilteredTotal / foursquareTotal) * 100).toFixed(2) : "0.00"}%</span> of <span className="font-[family-name:var(--font-geist-mono)]">{foursquareTotal.toLocaleString()}</span> total check-ins synced.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasFilter && (
              <button
                onClick={clearFilter}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/70 transition-colors"
              >
                <LuX size={10} />clear
              </button>
            )}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={`gap-1.5 font-normal ${!hasFilter ? "text-muted-foreground" : ""}`}>
                  <LuCalendarRange size={13} />
                  {hasFilter
                    ? formatDateRange(dateRange?.from, dateRange?.to)
                    : "filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleRangeSelect}
                  initialFocus
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <Separator />

      {totalPages > 1 && <PaginationBar />}

      {/* sticky bulk action bar */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-background border shadow-lg text-sm transition-all duration-200 ${selected.size > 0 || bulkResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
          {bulkLoading && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Spinner />removing…</div>}
          {resyncLoading && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Spinner />resyncing…</div>}
          {showStop && (
            <button onClick={handleStop} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"><LuX size={10} />stop</button>
          )}
          {bulkResult && !bulkLoading && !resyncLoading && (
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${bulkResult.errors > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
              {bulkResult.errors > 0 ? "⚠️" : "✓"} <span className="font-[family-name:var(--font-geist-mono)]">{bulkResult.deleted}</span> removed{bulkResult.errors > 0 ? `, ${bulkResult.errors} errors` : ""}
            </span>
          )}
          {resyncResult && !resyncLoading && !bulkLoading && (
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${resyncResult.errors > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
              {resyncResult.errors > 0 ? "⚠️" : "✓"} <span className="font-[family-name:var(--font-geist-mono)]">{resyncResult.synced}</span> resynced{resyncResult.errors > 0 ? `, ${resyncResult.errors} errors` : ""}
            </span>
          )}
          {selected.size > 0 && !bulkLoading && !resyncLoading && (
            <>
              <span className="text-xs text-muted-foreground">
                <span className="font-[family-name:var(--font-geist-mono)] font-medium text-foreground">{selected.size}</span> selected
              </span>
              <span className="text-border">|</span>
              <button onClick={() => setSelected(new Set(checkins.map((c) => c.checkinId)))} className="text-xs text-muted-foreground hover:text-foreground transition-colors">all</button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">clear</button>
              <button onClick={handleResync} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground hover:bg-muted/70 transition-colors">
                <LuRefreshCw size={10} />resync <span className="font-[family-name:var(--font-geist-mono)]">{selected.size}</span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                    remove <span className="font-[family-name:var(--font-geist-mono)]">{selected.size}</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove check-ins?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div>
                        Permanently removes <strong>{selected.size} synced calendar event{selected.size !== 1 ? "s" : ""}</strong> and their records.<br /><br />
                        This action cannot be undone.
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulk} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

      {/* checkins list */}
      {checkins.length === 0 ? (
        <div className="flex justify-center">
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">
            {hasFilter ? (
              <>⚠️ No check-ins found for <span className="font-medium">{formatDateRange(dateRange?.from, dateRange?.to)}</span> —{" "}
                <button onClick={clearFilter} className="underline hover:opacity-70 transition-opacity">clear filter</button>
              </>
            ) : <>⚠️ No check-ins found — run a <a href={sitePath(`${prefix}/home#manual-sync`)} className="underline hover:opacity-70 transition-opacity">manual sync</a> or wait for a scheduled run.</>}
          </span>
        </div>
      ) : (
        <div className="-mt-4">

          <div className="relative">
            {grouped.map(([dayKey, dayCheckins], groupIndex) => {
              const dayIds = dayCheckins.map((c) => c.checkinId);
              const isLast = groupIndex === grouped.length - 1;
              return (
                <div key={dayKey} className={`relative ${groupIndex > 0 ? "mt-6" : ""}`}>
                  {/* connector line to next group — dot center (top-[11px]) to next dot center (-bottom-[35px]) */}
                  {!isLast && <div className="absolute left-[6px] top-[11px] -bottom-[35px] w-px bg-border/40" />}
                  {/* day header */}
                  <label className="group/day flex items-center gap-2.5 cursor-pointer select-none mb-1 py-1">
                    <div className="relative w-3.5 h-3.5 shrink-0 flex items-center justify-center z-10 bg-background">
                      <div className="absolute inset-0 flex items-center justify-center transition-opacity group-hover/day:opacity-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-foreground/25 ring-[3px] ring-background" />
                      </div>
                      <DayCheckbox ids={dayIds} selected={selected} onToggle={() => toggleDay(dayIds)} />
                    </div>
                    <span className="text-sm font-semibold text-foreground tracking-tight">{formatDayDisplay(dayKey)}</span>
                    <span className="text-muted-foreground/30 text-xs">·</span>
                    <span className="text-xs text-muted-foreground/40"><span className="font-[family-name:var(--font-geist-mono)]">{dayCheckins.length}</span> check-in{dayCheckins.length !== 1 ? "s" : ""}</span>
                  </label>

                  {/* checkin rows */}
                  <div className="pl-5">
                    {dayCheckins.map((c) => {
                      const isSelected = selected.has(c.checkinId);
                      return (
                        <div
                          key={c.checkinId}
                          className="group/row relative flex items-start gap-3 py-2"
                        >
                          {/* dot / checkbox */}
                          <div className="relative w-3.5 h-3.5 shrink-0 flex items-center justify-center z-10 mt-[3px] bg-background">
                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isSelected ? "opacity-0" : "group-hover/row:opacity-0"}`}>
                              <div className="w-1.5 h-1.5 rounded-full bg-border" />
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(c.checkinId)}
                              className={`absolute w-3.5 h-3.5 accent-foreground cursor-pointer transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* content */}
                          <div className={`flex-1 min-w-0 transition-opacity ${isSelected ? "opacity-40" : ""}`}>
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {(c.description || c.stickerImageUrl) ? (() => {
                                  const descLines = (c.description ?? "").split("\n\n").filter((p) => !!p);
                                  const foursquareUrl = descLines.find((p) => p.startsWith("https://foursquare.com/"));
                                  const otherLines = descLines.filter((p) => !p.startsWith("https://foursquare.com/"));
                                  return (
                                    <HoverCard openDelay={200} closeDelay={100}>
                                      <HoverCardTrigger asChild>
                                        <button onClick={(e) => e.stopPropagation()} className="text-sm font-medium truncate text-left hover:opacity-70 transition-opacity">
                                          {c.venueName ?? <span className="text-muted-foreground/50 italic font-normal">unknown venue</span>}
                                        </button>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="relative w-72 p-5 pb-12 space-y-2 bg-muted shadow-lg rounded-xl border-none" side="right" align="start" onClick={(e) => e.stopPropagation()}>
                                        {otherLines.length > 0 && (
                                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                                            {otherLines.map((p, i) => (
                                              <p key={i} className={p.startsWith("💰") ? "mt-3" : i > 0 ? "mt-1.5" : ""}>{p}</p>
                                            ))}
                                          </div>
                                        )}

                                        <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 bg-background/60 rounded-full px-2.5 py-1">
                                          {foursquareUrl && (
                                            <a href={foursquareUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground/40 hover:text-[#f94877] transition-colors" title="Foursquare">
                                              <FaFoursquare size={12} />
                                            </a>
                                          )}
                                          {foursquareUrl && c.calendarEventUrl && <span className="text-muted-foreground/30 text-xs">·</span>}
                                          {c.calendarEventUrl && (
                                            <a href={c.calendarEventUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Google Calendar">
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" className="shrink-0 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                              </svg>
                                            </a>
                                          )}
                                        </div>
                                        {c.stickerImageUrl && (
                                          <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: "#ffa500" }}>
                                            <img src={c.stickerImageUrl} alt="sticker" width={30} height={30} />
                                          </div>
                                        )}
                                      </HoverCardContent>
                                    </HoverCard>
                                  );
                                })() : (
                                  <span className="text-sm font-medium truncate">
                                    {c.venueName ?? <span className="text-muted-foreground/50 italic font-normal">unknown venue</span>}
                                  </span>
                                )}
                                {c.isMayor && <LuCrown size={11} className="shrink-0 text-amber-400" />}
                              </div>
                              <span className="text-xs text-muted-foreground/50 font-[family-name:var(--font-geist-mono)] shrink-0">
                                {formatTime(c.checkinTimestamp)}
                              </span>
                            </div>
                            {(c.venueCity || c.venueCategory) && (() => {
                              const Icon = getCategoryIcon(c.venueCategory);
                              return (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/50">
                                  <Icon size={10} className="shrink-0" />
                                  {[c.venueCategory, c.venueCity].filter(Boolean).join(" · ")}
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && <PaginationBar />}

    </div>
  );
}
