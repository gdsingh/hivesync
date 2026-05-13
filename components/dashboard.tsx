"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SiSwarm, SiGithub, SiGooglemaps } from "react-icons/si";
import { FaFoursquare } from "react-icons/fa";
import { LuCrown, LuChevronDown, LuX, LuCalendarDays, LuRefreshCw, LuTrash2, LuCalendarRange, LuCalendar, LuCalendarPlus, LuGithub, LuPlug, LuList, LuMapPin, LuInfo } from "react-icons/lu";
import { AppHeader } from "@/components/app-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";


interface Props {
  foursquareConnected: boolean;
  foursquareDisplayName: string | null;
  foursquarePhotoUrl: string | null;
  googleConnected: boolean;
  googleEmail: string | null;
  googlePhotoUrl: string | null;
  totalSynced: number;
  ogMode: boolean;
  lastSyncedAt: Date | null;
  isPreview?: boolean;
  previewFoursquareTotal?: number;
}

type SyncState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "running"; jobId: string; synced: number; skipped: number; total: number; errors: number }
  | { type: "done"; synced: number; skipped: number; errors: number }
  | { type: "error"; message: string };

type GooglePlacesStatus = {
  hasKey: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  backfillRunLimit: number;
  warningThreshold: number;
  todayCalls: number;
  monthCalls: number;
  totalCalls: number;
  todayCacheHits: number;
  monthCacheHits: number;
  totalCacheHits: number;
  cacheCount: number;
  mappedVenueCount: number;
  lookupStatusCounts: Record<string, number>;
  limitsOverridden: boolean;
  status: "no_key" | "enabled" | "near_limit" | "capped" | "error";
};

type GooglePlacesPreflight = {
  estimatedGoogleCalls: number;
  uniqueUncachedVenues: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  backfillRemaining: number;
  fallbackCount: number;
  confirmationRequired: boolean;
};

type PendingGooglePlacesSync =
  | { type: "year"; year: string }
  | { type: "range"; from: Date; to?: Date };

type SyncCountAudit = {
  firstYear: number;
  lastYear: number;
  checkedYears: Record<string, { foursquare: number; synced: number }>;
  totalCheckins: number | null;
  totalSynced: number;
  foundInCheckedYears: number;
  unaccountedCheckins: number | null;
  completed: boolean;
  checkedAt: string | Date;
};

const currentYear = new Date().getFullYear();
const FIRST_FOURSQUARE_YEAR = 2009;
const years = Array.from({ length: currentYear - FIRST_FOURSQUARE_YEAR + 1 }, (_, i) => FIRST_FOURSQUARE_YEAR + i);

function getRangeTimestamps(fromDate: Date, toDate?: Date) {
  const effectiveTo = toDate ?? fromDate;
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const end = new Date(effectiveTo.getFullYear(), effectiveTo.getMonth(), effectiveTo.getDate() + 1);

  return {
    afterTimestamp: Math.floor(start.getTime() / 1000),
    beforeTimestamp: Math.floor(end.getTime() / 1000),
  };
}


export function Dashboard({
  foursquareConnected,
  foursquareDisplayName,
  foursquarePhotoUrl,
  googleConnected,
  googleEmail,
  googlePhotoUrl,
  totalSynced,
  ogMode: initialOgMode,
  lastSyncedAt,
  isPreview = false,
  previewFoursquareTotal,
}: Props) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<{ synced: number; skipped: number } | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickCount, setQuickCount] = useState<number | "">("");
  const [quickDeleteCount, setQuickDeleteCount] = useState<number | "">("");
  const [quickDeleteLoading, setQuickDeleteLoading] = useState(false);
  const [quickDeleteResult, setQuickDeleteResult] = useState<{ deleted: number; errors: number } | null>(null);
  const [deleteYearValue, setDeleteYearValue] = useState(String(currentYear));
  const [deleteYearLoading, setDeleteYearLoading] = useState(false);
  const [deleteYearResult, setDeleteYearResult] = useState<{ deleted: number; errors: number } | null>(null);
  const [fromYear, setFromYear] = useState("");
  const [syncState, setSyncState] = useState<SyncState>({ type: "idle" });
  const [calendarStatus, setCalendarStatus] = useState<"checking" | "ready" | "needs_rename" | "missing" | "error" | null>(
    isPreview ? "ready" : googleConnected ? "checking" : null
  );

  const [calendarSetupLoading, setCalendarSetupLoading] = useState(false);
  const [foursquareStats, setFoursquareStats] = useState<{ totalCheckins: number | null } | null>(
    isPreview ? { totalCheckins: previewFoursquareTotal ?? 3241 } : null
  );
  const [ogMode, setOgMode] = useState(initialOgMode);
  const [syncOpen, setSyncOpen] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState(false);
  const [foursquareDisconnected, setFoursquareDisconnected] = useState(false);
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);
  const [rangeDeleteLoading, setRangeDeleteLoading] = useState(false);
  const [rangeDeleteResult, setRangeDeleteResult] = useState<{ deleted: number; errors: number } | null>(null);
  const [rangeSyncState, setRangeSyncState] = useState<SyncState>({ type: "idle" });
  const [yearCounts, setYearCounts] = useState<Record<string, { foursquare?: number; synced?: number }>>({});
  const [yearCountLoading, setYearCountLoading] = useState(false);
  const [rangeCount, setRangeCount] = useState<{ foursquare?: number; synced?: number } | null>(null);
  const [rangeCountLoading, setRangeCountLoading] = useState(false);
  const [syncCountAudit, setSyncCountAudit] = useState<SyncCountAudit | null>(null);
  const [googlePlacesStatus, setGooglePlacesStatus] = useState<GooglePlacesStatus | null>(null);
  const [googlePlacesPreflight, setGooglePlacesPreflight] = useState<GooglePlacesPreflight | null>(null);
  const [googlePlacesPreflightLoading, setGooglePlacesPreflightLoading] = useState(false);
  const [pendingGooglePlacesSync, setPendingGooglePlacesSync] = useState<PendingGooglePlacesSync | null>(null);
  const [manualGooglePlacesLimit, setManualGooglePlacesLimit] = useState<number | "">("");
  const [manualGooglePlacesAllowFallback, setManualGooglePlacesAllowFallback] = useState(false);
  const [googlePlacesLimitDraft, setGooglePlacesLimitDraft] = useState({
    dailyLimit: "",
    monthlyLimit: "",
    backfillRunLimit: "",
  });
  const [googlePlacesLimitSaving, setGooglePlacesLimitSaving] = useState(false);
  const [googlePlacesLimitError, setGooglePlacesLimitError] = useState<string | null>(null);
  const stopYearSyncRef = useRef(false);
  const stopRangeSyncRef = useRef(false);
  const quickSyncAbortRef = useRef<AbortController | null>(null);
  const allTimeMissing =
    foursquareStats?.totalCheckins != null
      ? Math.max(0, foursquareStats.totalCheckins - totalSynced)
      : null;
  const loadedYearGap = Object.values(yearCounts).reduce((sum, counts) => {
    if (counts.foursquare == null || counts.synced == null) return sum;
    return sum + Math.max(0, counts.foursquare - counts.synced);
  }, 0);
  const loadedYearCount = Object.keys(yearCounts).length;
  const unscannedGap =
    allTimeMissing == null
      ? null
      : Math.max(0, allTimeMissing - loadedYearGap);
  const hasCheckedYearGap = loadedYearCount > 0 && allTimeMissing != null;
  const currentAuditMatches =
    syncCountAudit?.totalSynced === totalSynced &&
    (foursquareStats?.totalCheckins == null || syncCountAudit.totalCheckins === foursquareStats.totalCheckins);
  const persistedUnaccounted =
    syncCountAudit?.completed && currentAuditMatches && syncCountAudit.unaccountedCheckins != null
      ? syncCountAudit.unaccountedCheckins
      : null;
  const sessionUnaccounted =
    loadedYearCount >= years.length &&
    unscannedGap != null &&
    unscannedGap > 0
      ? unscannedGap
      : null;
  const visibleUnaccounted = sessionUnaccounted ?? (persistedUnaccounted != null && persistedUnaccounted > 0 ? persistedUnaccounted : null);

  useEffect(() => {
    if (isPreview || !foursquareConnected) return;
    fetch("/api/foursquare/stats")
      .then((r) => r.json())
      .then((d) => setFoursquareStats(d))
      .catch(() => {});
  }, [isPreview, foursquareConnected]);

  useEffect(() => {
    if (isPreview) return;
    fetch("/api/sync-count-audit")
      .then((r) => r.json())
      .then((d) => {
        if (!d.audit) return;
        setSyncCountAudit(d.audit);
        setYearCounts(d.audit.checkedYears ?? {});
      })
      .catch(() => {});
  }, [isPreview]);

  useEffect(() => {
    if (window.location.hash === "#manual-sync") setSyncOpen(true);
  }, []);

  async function saveSyncCountAudit(year: string, foursquare?: number, synced?: number) {
    if (isPreview || foursquare == null || synced == null) return;
    const res = await fetch("/api/sync-count-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: parseInt(year),
        foursquare,
        synced,
        totalCheckins: foursquareStats?.totalCheckins,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.audit) setSyncCountAudit(data.audit);
  }

  async function refreshGooglePlacesStatus() {
    if (isPreview) return;
    fetch("/api/google-places/status")
      .then((r) => r.json())
      .then((d) => setGooglePlacesStatus(d))
      .catch(() => setGooglePlacesStatus({ status: "error" } as GooglePlacesStatus));
  }

  useEffect(() => {
    refreshGooglePlacesStatus();
  }, [isPreview]);

  useEffect(() => {
    if (!googlePlacesStatus || googlePlacesStatus.status === "error") return;
    setGooglePlacesLimitDraft({
      dailyLimit: String(googlePlacesStatus.dailyLimit),
      monthlyLimit: String(googlePlacesStatus.monthlyLimit),
      backfillRunLimit: String(googlePlacesStatus.backfillRunLimit),
    });
  }, [
    googlePlacesStatus?.dailyLimit,
    googlePlacesStatus?.monthlyLimit,
    googlePlacesStatus?.backfillRunLimit,
    googlePlacesStatus?.status,
  ]);

  useEffect(() => {
    if (isPreview || !googleConnected) return;
    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((d) => {
        // auto-enable OG mode if a "Foursquare" calendar is found while OG mode is off
        if (d.status === "needs_rename" && d.calendarName === "Swarm" && !ogMode) {
          setOgMode(true);
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ogMode: true }),
          });
          setCalendarStatus("ready");
        } else if (d.status === "missing" && ogMode) {
          // reset OG mode if calendar is missing — it will be recreated as Swarm
          setOgMode(false);
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ogMode: false }),
          });
          setCalendarStatus("missing");
        } else {
          setCalendarStatus(d.status);
        }
      })
      .catch(() => setCalendarStatus("error"));
  }, [isPreview, googleConnected]);

  useEffect(() => {
    if (!foursquareConnected || !fromYear || yearCounts[fromYear] != null) return;
    setYearCountLoading(true);
    const yr = parseInt(fromYear);
    const after = Math.floor(Date.UTC(yr, 0, 1) / 1000);
    const before = Math.floor(Date.UTC(yr + 1, 0, 1) / 1000);
    Promise.all([
      fetch(`/api/foursquare/count?after=${after}&before=${before}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/checkins/count?after=${after}&before=${before}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([fsq, db]) => {
      setYearCounts((prev) => ({ ...prev, [fromYear]: { foursquare: fsq.count, synced: db.count } }));
      saveSyncCountAudit(fromYear, fsq.count, db.count);
    }).finally(() => setYearCountLoading(false));
  }, [fromYear, foursquareConnected]);

  useEffect(() => {
    if (!foursquareConnected || !rangeFrom) { setRangeCount(null); return; }
    setRangeCount(null);
    setRangeCountLoading(true);
    const { afterTimestamp: after, beforeTimestamp: before } = getRangeTimestamps(rangeFrom, rangeTo);
    Promise.all([
      fetch(`/api/foursquare/count?after=${after}&before=${before}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/checkins/count?after=${after}&before=${before}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([fsq, db]) => {
      setRangeCount({ foursquare: fsq.count, synced: db.count });
    }).finally(() => setRangeCountLoading(false));
  }, [rangeFrom, rangeTo, foursquareConnected]);


  async function handleCalendarSetup() {
    setCalendarSetupLoading(true);
    const res = await fetch("/api/calendar/setup", { method: "POST" });
    if (res.ok) setCalendarStatus("ready");
    else setCalendarStatus("error");
    setCalendarSetupLoading(false);
  }

  async function handleOgModeToggle() {
    const next = !ogMode;
    setOgMode(next);
    if (isPreview) return;
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ogMode: next }),
    });
    if (calendarStatus !== "missing") {
      setCalendarStatus("checking");
      await fetch("/api/calendar/setup", { method: "POST" });
      fetch("/api/calendar/status")
        .then((r) => r.json())
        .then((d) => setCalendarStatus(d.status))
        .catch(() => setCalendarStatus("error"));
    }
  }

  async function handleDisconnect(service: "foursquare" | "google") {
    if (service === "foursquare") setFoursquareDisconnected(true);
    await fetch(`/api/auth/${service}/disconnect`, { method: "POST" });
    router.refresh();
  }

  async function handleQuickSync() {
    const controller = new AbortController();
    quickSyncAbortRef.current = controller;
    setQuickLoading(true);
    setQuickResult(null);
    setQuickDeleteResult(null);
    setQuickError(null);
    try {
      const res = await fetch("/api/sync/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: quickCount }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setQuickError(data.error ?? "sync failed");
      } else {
        setQuickResult({ synced: data.synced, skipped: data.skipped });
        refreshGooglePlacesStatus();
        router.refresh();
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setQuickError("could not reach the server");
      }
    } finally {
      quickSyncAbortRef.current = null;
      setQuickLoading(false);
    }
  }

  function handleStopQuickSync() {
    quickSyncAbortRef.current?.abort();
    setQuickLoading(false);
  }

  async function handleQuickDelete() {
    setQuickDeleteLoading(true);
    setQuickDeleteResult(null);
    setQuickResult(null);
    const res = await fetch("/api/checkins/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: quickDeleteCount, mode: "delete" }),
    });
    const data = await res.json();
    setQuickDeleteResult({ deleted: data.deleted, errors: data.errors ?? 0 });
    setQuickDeleteLoading(false);
    router.refresh();
  }

  async function handleDeleteYear() {
    setDeleteYearLoading(true);
    setDeleteYearResult(null);
    setSyncState({ type: "idle" });
    const res = await fetch("/api/checkins/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: parseInt(deleteYearValue), mode: "delete" }),
    });
    const data = await res.json();
    setDeleteYearResult({ deleted: data.deleted, errors: data.errors ?? 0 });
    setDeleteYearLoading(false);
    router.refresh();
  }

  function getManualGooglePlacesLimit(): number {
    return manualGooglePlacesLimit === ""
      ? (googlePlacesStatus?.backfillRunLimit ?? 250)
      : manualGooglePlacesLimit;
  }

  async function saveGooglePlacesLimits() {
    setGooglePlacesLimitSaving(true);
    setGooglePlacesLimitError(null);
    try {
      const dailyLimit = parseInt(googlePlacesLimitDraft.dailyLimit, 10);
      const monthlyLimit = parseInt(googlePlacesLimitDraft.monthlyLimit, 10);
      const backfillRunLimit = parseInt(googlePlacesLimitDraft.backfillRunLimit, 10);

      const res = await fetch("/api/google-places/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit, monthlyLimit, backfillRunLimit }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGooglePlacesLimitError(data.error ?? "could not update limits");
        return;
      }
      setGooglePlacesStatus(data);
      setGooglePlacesPreflight(null);
    } catch {
      setGooglePlacesLimitError("could not reach the server");
    } finally {
      setGooglePlacesLimitSaving(false);
    }
  }

  async function runGooglePlacesPreflight(afterTimestamp: number, beforeTimestamp: number): Promise<GooglePlacesPreflight | null> {
    setGooglePlacesPreflightLoading(true);
    setGooglePlacesPreflight(null);
    try {
      const res = await fetch("/api/google-places/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          afterTimestamp,
          beforeTimestamp,
          googlePlacesRunLimit: getManualGooglePlacesLimit(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return null;
      setGooglePlacesPreflight(data);
      setGooglePlacesStatus(data.usage ?? null);
      return data;
    } catch {
      return null;
    } finally {
      setGooglePlacesPreflightLoading(false);
    }
  }

  async function startRangeSync(googlePlacesApproved: boolean, fromDate: Date, toDate?: Date) {
    const effectiveTo = toDate ?? fromDate;
    const { afterTimestamp, beforeTimestamp } = getRangeTimestamps(fromDate, toDate);
    stopYearSyncRef.current = true;
    setRangeSyncState({ type: "loading" });
    setSyncState({ type: "idle" });
    setRangeDeleteResult(null);
    const startRes = await fetch("/api/sync/range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: format(fromDate, "yyyy-MM-dd"),
        to: format(effectiveTo, "yyyy-MM-dd"),
        afterTimestamp,
        beforeTimestamp,
        expectedCheckins: rangeCount?.foursquare,
        googlePlacesApproved,
        googlePlacesRunLimit: getManualGooglePlacesLimit(),
        googlePlacesAllowFallback: manualGooglePlacesAllowFallback,
      }),
    });
    const startData = await startRes.json();
    if (!startData.jobId) {
      setRangeSyncState({ type: "error", message: startData.error ?? "failed to start sync" });
      return;
    }
    if (
      rangeCount?.foursquare != null &&
      typeof startData.total === "number" &&
      startData.total > rangeCount.foursquare + 5
    ) {
      await fetch("/api/sync/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: startData.jobId }),
      });
      setRangeSyncState({
        type: "error",
        message: `range mismatch: expected about ${rangeCount.foursquare} check-ins, found ${startData.total}; stopped before continuing`,
      });
      refreshGooglePlacesStatus();
      return;
    }
    setRangeSyncState({ type: "running", jobId: startData.jobId, synced: startData.totalSynced, skipped: startData.totalSkipped, total: startData.total ?? 0, errors: startData.totalErrors ?? 0 });
    if (startData.status === "completed") {
      setRangeSyncState({ type: "done", synced: startData.totalSynced, skipped: startData.totalSkipped, errors: startData.totalErrors });
      refreshGooglePlacesStatus();
      router.refresh();
      return;
    }
    // poll until done
    stopRangeSyncRef.current = false;
    const jobId = startData.jobId;
    while (true) {
      await new Promise((r) => setTimeout(r, 1200));
      if (stopRangeSyncRef.current) return;
      const statusRes = await fetch(`/api/sync/status/${jobId}`);
      const job = await statusRes.json();
      if (job.status === "completed" || job.status === "failed") {
        setRangeSyncState(job.status === "completed"
          ? { type: "done", synced: job.totalSynced, skipped: job.totalSkipped, errors: job.totalErrors }
          : { type: "error", message: job.errorMessage ?? "sync failed" });
        refreshGooglePlacesStatus();
        router.refresh();
        return;
      }
      setRangeSyncState((prev) => prev.type === "running" ? { ...prev, synced: job.totalSynced, skipped: job.totalSkipped, errors: job.totalErrors ?? 0 } : prev);
      const contRes = await fetch("/api/sync/full/continue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) });
      const cont = await contRes.json();
      if (cont.status === "completed" || cont.status === "failed") {
        setRangeSyncState(cont.status === "completed"
          ? { type: "done", synced: cont.totalSynced, skipped: cont.totalSkipped, errors: cont.totalErrors }
          : { type: "error", message: "sync failed" });
        refreshGooglePlacesStatus();
        router.refresh();
        return;
      }
    }
  }

  async function handleRangeSync() {
    if (!rangeFrom) return;
    const { afterTimestamp, beforeTimestamp } = getRangeTimestamps(rangeFrom, rangeTo);
    const preflight = await runGooglePlacesPreflight(afterTimestamp, beforeTimestamp);
    if (preflight?.confirmationRequired) {
      setPendingGooglePlacesSync({ type: "range", from: rangeFrom, to: rangeTo });
      return;
    }
    await startRangeSync(false, rangeFrom, rangeTo);
  }

  async function handleRangeDelete() {
    if (!rangeFrom) return;
    const effectiveTo = rangeTo ?? rangeFrom;
    setRangeDeleteLoading(true);
    setRangeDeleteResult(null);
    setRangeSyncState({ type: "idle" });
    const res = await fetch("/api/checkins/delete-range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: format(rangeFrom, "yyyy-MM-dd"), to: format(effectiveTo, "yyyy-MM-dd"), mode: "full" }),
    });
    const data = await res.json();
    setRangeDeleteResult({ deleted: data.deleted, errors: data.errors ?? 0 });
    setRangeDeleteLoading(false);
    router.refresh();
  }

  async function handleStopSync() {
    stopYearSyncRef.current = true;
    if (syncState.type === "running") {
      await fetch("/api/sync/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: syncState.jobId }) });
    }
    setSyncState({ type: "idle" });
  }

  async function handleStopRangeSync() {
    stopRangeSyncRef.current = true;
    if (rangeSyncState.type === "running") {
      await fetch("/api/sync/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: rangeSyncState.jobId }) });
    }
    setRangeSyncState({ type: "idle" });
  }

  async function startFullSync(googlePlacesApproved: boolean, yearValue: string) {
    stopRangeSyncRef.current = true;
    setSyncState({ type: "loading" });
    setRangeSyncState({ type: "idle" });
    setDeleteYearResult(null);
    const startRes = await fetch("/api/sync/full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromYear: parseInt(yearValue),
        googlePlacesApproved,
        googlePlacesRunLimit: getManualGooglePlacesLimit(),
        googlePlacesAllowFallback: manualGooglePlacesAllowFallback,
      }),
    });
    const startData = await startRes.json();
    if (!startData.jobId) {
      setSyncState({ type: "error", message: startData.error ?? "failed to start sync" });
      return;
    }

    setSyncState({
      type: "running",
      jobId: startData.jobId,
      synced: startData.totalSynced,
      skipped: startData.totalSkipped,
      total: startData.total ?? 0,
      errors: startData.totalErrors ?? 0,
    });

    if (startData.status === "completed") {
      setSyncState({
        type: "done",
        synced: startData.totalSynced,
        skipped: startData.totalSkipped,
        errors: startData.totalErrors,
      });
      refreshGooglePlacesStatus();
      router.refresh();
      return;
    }

    // poll until done
    await pollSync(startData.jobId);
  }

  async function handleFullSync() {
    const yr = parseInt(fromYear);
    const afterTimestamp = Math.floor(Date.UTC(yr, 0, 1) / 1000);
    const beforeTimestamp = Math.floor(Date.UTC(yr + 1, 0, 1) / 1000);
    const preflight = await runGooglePlacesPreflight(afterTimestamp, beforeTimestamp);
    if (preflight?.confirmationRequired) {
      setPendingGooglePlacesSync({ type: "year", year: fromYear });
      return;
    }
    await startFullSync(false, fromYear);
  }

  async function confirmGooglePlacesSync() {
    const pending = pendingGooglePlacesSync;
    setPendingGooglePlacesSync(null);
    if (!pending) return;
    if (pending.type === "year") {
      await startFullSync(true, pending.year);
    } else {
      await startRangeSync(true, pending.from, pending.to);
    }
  }

  async function pollSync(jobId: string) {
    stopYearSyncRef.current = false;
    while (true) {
      await new Promise((r) => setTimeout(r, 1200));
      if (stopYearSyncRef.current) return;

      const res = await fetch(`/api/sync/status/${jobId}`);
      const job = await res.json();

      if (job.status === "completed" || job.status === "failed") {
        setSyncState(
          job.status === "completed"
            ? { type: "done", synced: job.totalSynced, skipped: job.totalSkipped, errors: job.totalErrors }
            : { type: "error", message: job.errorMessage ?? "sync failed" }
        );
        refreshGooglePlacesStatus();
        router.refresh();
        return;
      }

      setSyncState((prev) =>
        prev.type === "running"
          ? { ...prev, synced: job.totalSynced, skipped: job.totalSkipped, errors: job.totalErrors ?? 0 }
          : prev
      );

      const contRes = await fetch("/api/sync/full/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const cont = await contRes.json();
      if (cont.status === "completed" || cont.status === "failed") {
        setSyncState(cont.status === "completed"
          ? { type: "done", synced: cont.totalSynced, skipped: cont.totalSkipped, errors: cont.totalErrors }
          : { type: "error", message: "sync failed" });
        refreshGooglePlacesStatus();
        router.refresh();
        return;
      }
    }
  }

  const calendarReady = calendarStatus === "ready";
  const canSync = foursquareConnected && googleConnected && calendarReady;
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">

      <AppHeader lastSyncedAt={lastSyncedAt} />

      {/* header */}
      <div className="flex items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0 w-14 h-14">
            {foursquarePhotoUrl ? (
              <img src={foursquarePhotoUrl} alt={foursquareDisplayName ?? "profile"} className="w-14 h-14 rounded-full object-cover" />
            ) : googlePhotoUrl ? (
              <img src={googlePhotoUrl} alt={googleEmail ?? "profile"} className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg">
                {(foursquareDisplayName ?? googleEmail ?? "?")[0].toUpperCase()}
              </div>
            )}
            {foursquarePhotoUrl && googlePhotoUrl && (
              <img src={googlePhotoUrl} alt={googleEmail ?? "google"} className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full object-cover outline outline-2 outline-background" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xl font-bold leading-none">
                {foursquareDisplayName ?? googleEmail ?? "hivesync"}
              </p>
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><LuPlug size={15} className="text-muted-foreground" />Connections</DialogTitle>
                  </DialogHeader>
                  <div className="mt-2">
                    <div className="space-y-2">
                      {/* foursquare */}
	                      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FaFoursquare size={15} className="text-[#f94877] shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium leading-none">foursquare</p>
                              <span className={`w-1.5 h-1.5 rounded-full inline-block ${foursquareConnected ? "bg-green-500" : "bg-amber-500"}`} />
                            </div>
                            {foursquareConnected && foursquareDisplayName && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{foursquareDisplayName}</p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {foursquareConnected && !foursquareDisconnected ? (
                            pendingDisconnect ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                disconnect?{" "}
                                <button onClick={() => { handleDisconnect("foursquare"); setPendingDisconnect(false); }} className="text-destructive hover:text-destructive/80 transition-colors underline">yes</button>
                                {" · "}
                                <button onClick={() => setPendingDisconnect(false)} className="hover:text-foreground transition-colors underline">cancel</button>
                              </span>
                            ) : (
                              <button onClick={() => setPendingDisconnect(true)} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors">disconnect</button>
                            )
                          ) : (
                            <Button size="sm" asChild><a href="/api/auth/foursquare/connect">connect</a></Button>
                          )}
                        </div>
                      </div>

                      {/* google */}
	                      <div className="rounded-lg border px-3 py-2.5 space-y-3">
	                        <div className="flex items-center justify-between gap-3">
	                          <div className="flex items-center gap-2.5 min-w-0">
	                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" className="shrink-0">
	                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
	                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
	                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
	                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
	                            </svg>
	                            <div className="min-w-0">
	                              <div className="flex items-center gap-1.5">
	                                <p className="text-xs font-medium leading-none">google</p>
	                                {googleConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
	                              </div>
	                              {googleEmail && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{googleEmail}</p>}
	                            </div>
	                          </div>
	                          <HoverCard openDelay={200}>
	                            <HoverCardTrigger asChild>
	                              <button disabled className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground opacity-50 cursor-default shrink-0">disconnect</button>
	                            </HoverCardTrigger>
	                            <HoverCardContent align="end" className="w-56 text-xs text-muted-foreground">
	                              To revoke access, remove this app from your Google account under Security → Third-party apps.
	                            </HoverCardContent>
	                          </HoverCard>
	                        </div>
	                        <div className="border-t pt-2 space-y-2">
	                          <div className="flex items-center justify-between gap-2">
	                            <div className="flex items-center gap-2 min-w-0">
	                              <LuMapPin size={14} className="text-muted-foreground shrink-0" />
	                              <div>
	                                <p className="text-xs font-medium leading-none">maps enrichment</p>
	                                <p className="text-[11px] text-muted-foreground mt-0.5">
	                                  {googlePlacesStatus?.status === "no_key" ? "no api key configured" : googlePlacesStatus?.status === "capped" ? "capped for now" : googlePlacesStatus?.status === "near_limit" ? "near limit" : googlePlacesStatus?.status === "error" ? "could not load usage" : "enabled"}
	                                </p>
	                              </div>
	                            </div>
	                            {googlePlacesStatus && googlePlacesStatus.status !== "error" && (
	                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${googlePlacesStatus.status === "capped" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : googlePlacesStatus.status === "near_limit" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
	                                {googlePlacesStatus.status === "no_key" ? "off" : googlePlacesStatus.status === "capped" ? "capped" : googlePlacesStatus.status === "near_limit" ? "watch" : "on"}
	                              </span>
	                            )}
	                          </div>
	                          {googlePlacesStatus?.status === "error" ? (
	                            <p className="text-[11px] text-muted-foreground">usage unavailable</p>
	                          ) : googlePlacesStatus ? (
	                            <>
	                            <div className="space-y-2">
	                              <div className="rounded bg-muted/40 px-2.5 py-2">
	                                <div className="flex items-center justify-between gap-2">
	                                  <p className="text-[11px] font-medium text-foreground">usage</p>
	                                  <span className="text-[10px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">{googlePlacesStatus.totalCalls} lifetime</span>
	                                </div>
	                                <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
	                                  <div>
	                                    <span className="block font-[family-name:var(--font-geist-mono)] text-foreground">{googlePlacesStatus.todayCalls}/{googlePlacesStatus.dailyLimit}</span>
	                                    today
	                                  </div>
	                                  <div>
	                                    <span className="block font-[family-name:var(--font-geist-mono)] text-foreground">{googlePlacesStatus.monthCalls}/{googlePlacesStatus.monthlyLimit}</span>
	                                    this month
	                                  </div>
	                                </div>
	                              </div>
	                              <div className="grid grid-cols-2 gap-2">
	                                <div className="rounded bg-muted/40 px-2.5 py-2">
	                                  <p className="text-[11px] font-medium text-foreground">cache</p>
	                                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
	                                    <div>
	                                      <span className="block font-[family-name:var(--font-geist-mono)] text-foreground">{googlePlacesStatus.mappedVenueCount}/{googlePlacesStatus.cacheCount}</span>
	                                      mapped venues
	                                    </div>
	                                    <div>
	                                      <span className="block font-[family-name:var(--font-geist-mono)] text-foreground">{googlePlacesStatus.todayCacheHits}</span>
	                                      reused today
	                                    </div>
	                                  </div>
	                                </div>
	                                <div className="rounded bg-muted/40 px-2.5 py-2">
	                                  <p className="text-[11px] font-medium text-foreground">lookup results</p>
	                                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
	                                    <div>
	                                      <span className="block font-[family-name:var(--font-geist-mono)] text-foreground">{googlePlacesStatus.lookupStatusCounts?.found ?? 0}</span>
	                                      found
	                                    </div>
	                                    <div>
	                                      <span className="block font-[family-name:var(--font-geist-mono)] text-foreground">{googlePlacesStatus.lookupStatusCounts?.failed ?? 0}</span>
	                                      failed
	                                    </div>
	                                    <div>
	                                      <span className="block font-[family-name:var(--font-geist-mono)] text-foreground">{googlePlacesStatus.lookupStatusCounts?.not_found ?? 0}</span>
	                                      no match
	                                    </div>
	                                  </div>
	                                </div>
	                              </div>
	                            </div>
	                            <div className="rounded border border-amber-500/30 bg-amber-50/60 px-2 py-2 space-y-2 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
	                              <div className="flex items-center justify-between gap-2">
	                                <p className="text-[11px] font-medium">safety limits</p>
	                                {googlePlacesStatus.limitsOverridden && <span className="text-[10px] text-amber-700 dark:text-amber-300">custom</span>}
	                              </div>
	                              <p className="text-[10px] leading-snug text-amber-700 dark:text-amber-300">
	                                These app limits stop Hivesync before it makes more Google Maps calls. Keep Google Cloud quota and budgets enabled too.
	                              </p>
	                              <div className="grid grid-cols-3 gap-2">
	                                {[
	                                  ["dailyLimit", "daily"],
	                                  ["monthlyLimit", "monthly"],
	                                  ["backfillRunLimit", "backfill"],
	                                ].map(([key, label]) => (
	                                  <label key={key} className="text-[10px] text-amber-700 dark:text-amber-300">
	                                    {label}
	                                    <input
	                                      type="number"
	                                      min={0}
	                                      value={googlePlacesLimitDraft[key as keyof typeof googlePlacesLimitDraft]}
	                                      onChange={(e) => {
	                                        setGooglePlacesLimitDraft((prev) => ({ ...prev, [key]: e.target.value }));
	                                        setGooglePlacesLimitError(null);
	                                      }}
	                                      className="mt-1 h-7 w-full rounded border border-amber-500/30 bg-background px-2 font-[family-name:var(--font-geist-mono)] text-xs text-foreground"
	                                    />
	                                  </label>
	                                ))}
	                              </div>
	                              <div className="flex items-center justify-between gap-2">
	                                <p className="text-[10px] text-amber-700 dark:text-amber-300">
	                                  {googlePlacesLimitError ?? "changes apply immediately"}
	                                </p>
	                                <Button
	                                  size="sm"
	                                  variant="outline"
	                                  className="h-7 px-2 text-xs"
	                                  onClick={saveGooglePlacesLimits}
	                                  disabled={googlePlacesLimitSaving}
	                                >
	                                  {googlePlacesLimitSaving ? <Spinner /> : "save"}
	                                </Button>
	                              </div>
	                            </div>
	                            </>
	                          ) : (
	                            <Skeleton className="h-10 w-full" />
	                          )}
	                        </div>
	                      </div>
	                    </div>

                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-0.5">
              <a
                href="/checkins"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <span><span className="font-[family-name:var(--font-geist-mono)] font-semibold">{totalSynced.toLocaleString()}</span> check-in{totalSynced !== 1 ? "s" : ""} synced</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </a>
              {visibleUnaccounted != null && (
                <HoverCard openDelay={200}>
                  <HoverCardTrigger asChild>
                    <button type="button" className="block cursor-help text-left text-[11px] text-red-600 decoration-dotted underline-offset-2 hover:underline dark:text-red-400">
                      <span className="font-[family-name:var(--font-geist-mono)] font-semibold">{visibleUnaccounted.toLocaleString()}</span>&nbsp;unaccounted check-in{visibleUnaccounted !== 1 ? "s" : ""} ☹︎
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-64 text-xs text-muted-foreground">
                    Swarm says these check-ins exist, but Hivesync has not found matching saved calendar events after checking every available year.
                  </HoverCardContent>
                </HoverCard>
              )}
            </div>
          </div>
        </div>
        {foursquareConnected && (
          <div className="text-right">
            {foursquareStats?.totalCheckins != null ? (
              <>
                <p className="text-sm font-medium font-[family-name:var(--font-geist-mono)]">{foursquareStats.totalCheckins.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">total check-ins</p>
              </>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* foursquare connect gate */}
      {!foursquareConnected && !isPreview && (
        <Alert className="flex items-center justify-between gap-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3 min-w-0">
            <AlertDescription className="flex items-center gap-1.5">Connect your <span className="inline-flex items-center gap-1"><FaFoursquare size={12} color="#f94877" />Foursquare</span> account to set up syncing.</AlertDescription>
          </div>
          <Button size="sm" asChild className="shrink-0 bg-[#1C2729] hover:bg-[#1C2729]/90 text-white border-0"><a href="/api/auth/foursquare/connect">Get Started</a></Button>
        </Alert>
      )}

      {(foursquareConnected || isPreview) && <>

      {/* calendar */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <span className={`${calendarStatus === "ready" ? "group" : ""} relative w-[13px] h-[13px] flex items-center justify-center`}>
            <LuCalendarDays size={13} className="absolute transition-opacity duration-150 group-hover:opacity-0" />
            {calendarStatus === "ready" && (ogMode
              ? <FaFoursquare size={13} color="#f94877" className="absolute transition-opacity duration-150 opacity-0 group-hover:opacity-100" />
              : <SiSwarm size={13} color="#ffa500" className="absolute transition-opacity duration-150 opacity-0 group-hover:opacity-100" />
            )}
          </span>
          calendar
        </p>

        {calendarStatus === "missing" && (
          <Alert className="flex items-center justify-between gap-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-3 min-w-0">
              <AlertDescription>You&apos;ll need a calendar to start syncing your check-ins.</AlertDescription>
            </div>
            <Button size="sm" onClick={handleCalendarSetup} disabled={calendarSetupLoading} className="shrink-0 bg-[#1C2729] hover:bg-[#1C2729]/90 text-white border-0">{calendarSetupLoading ? <Spinner /> : <><LuCalendarPlus size={15} />Create</>}</Button>
          </Alert>
        )}
        {calendarStatus !== "missing" && <div className="flex items-center">
          <div>
            {calendarStatus !== "checking" && <p className="text-sm font-medium">
              {ogMode ? "Foursquare" : "Swarm"}
            </p>}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {calendarStatus === "checking" && <span className="flex items-center gap-1.5 text-muted-foreground/40">checking… <Spinner /></span>}
              {calendarStatus === "ready" && <>connected and ready <span>✓</span></>}
              {calendarStatus === "needs_rename" && <><span className="text-amber-600 dark:text-amber-500">⚠️ calendar named {ogMode ? "Swarm" : "Foursquare"} found</span> —{" "}<button onClick={handleCalendarSetup} disabled={calendarSetupLoading} className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-50">{calendarSetupLoading ? "renaming…" : `rename to ${ogMode ? "Foursquare" : "Swarm"}`}</button></>}
              {calendarStatus === "error" && <span className="text-amber-600 dark:text-amber-500">⚠️ couldn&apos;t check status</span>}
              {calendarStatus === null && "—"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {calendarStatus === "checking" ? (
              <Skeleton className="h-4 w-24 rounded-full" />
            ) : calendarStatus === "ready" || calendarStatus === "needs_rename" ? (
            <HoverCard openDelay={200}>
              <HoverCardTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <LuCrown size={11} style={{ color: ogMode ? "#f59e0b" : undefined }} />
                  <span className="text-xs font-semibold text-muted-foreground" style={{ color: ogMode ? "#F94877" : undefined }}>OG mode</span>
                  <button
                    onClick={handleOgModeToggle}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${
                      ogMode ? "bg-foreground" : "bg-input"
                    }`}
                    role="switch"
                    aria-checked={ogMode}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${ogMode ? "translate-x-3.5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </HoverCardTrigger>
              <HoverCardContent align="end" className="w-64 text-xs text-muted-foreground">
                renames your calendar from{" "}
                <span className="inline-flex items-center gap-1 font-medium text-foreground"><SiSwarm size={11} color="#ffa500" /><em>Swarm</em></span>
                {" "}to{" "}
                <span className="inline-flex items-center gap-1 font-medium text-foreground"><FaFoursquare size={11} color="#f94877" /><em>Foursquare</em></span>
                {" "}when enabled
              </HoverCardContent>
            </HoverCard>
            ) : null}
          </div>
        </div>}

	      </div>

	      <AlertDialog open={!!pendingGooglePlacesSync} onOpenChange={(open) => { if (!open) setPendingGooglePlacesSync(null); }}>
	        <AlertDialogContent>
	          <AlertDialogHeader>
	            <AlertDialogTitle>Use Google Maps enrichment for this backfill?</AlertDialogTitle>
	            <AlertDialogDescription>
	              This sync may make{" "}
	              <strong>
	                <span className="font-[family-name:var(--font-geist-mono)]">{googlePlacesPreflight?.estimatedGoogleCalls ?? 0}</span>{" "}
	                Google Places lookup{googlePlacesPreflight?.estimatedGoogleCalls === 1 ? "" : "s"}
	              </strong>{" "}
	              for uncached venues. This run is limited to{" "}
	              <span className="font-[family-name:var(--font-geist-mono)]">{getManualGooglePlacesLimit()}</span>{" "}
	              lookup{getManualGooglePlacesLimit() === 1 ? "" : "s"}.{" "}
	              {manualGooglePlacesAllowFallback ? (
	                <>
	                  <span className="font-[family-name:var(--font-geist-mono)]">{googlePlacesPreflight?.fallbackCount ?? 0}</span>{" "}
	                  venue{googlePlacesPreflight?.fallbackCount === 1 ? "" : "s"} may fall back to Foursquare locations if caps are reached.
	                </>
	              ) : (
	                <>Syncing will stop if the Google Maps API limit is reached.</>
	              )}
	            </AlertDialogDescription>
	          </AlertDialogHeader>
	          <AlertDialogFooter>
	            <AlertDialogCancel>Cancel</AlertDialogCancel>
	            <AlertDialogAction onClick={confirmGooglePlacesSync} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Continue</AlertDialogAction>
	          </AlertDialogFooter>
	        </AlertDialogContent>
	      </AlertDialog>

	      <Separator />

      {/* sync */}
      <div id="manual-sync" className="space-y-6">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setSyncOpen((o) => !o)}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><LuRefreshCw size={13} />manual sync options</p>
          <LuChevronDown
            size={14}
            className={`text-muted-foreground transition-transform duration-200 ${syncOpen ? "rotate-180" : ""}`}
          />
        </button>

        {syncOpen && <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
          The app auto-syncs daily via cron — new check-ins are picked up automatically. Use the options below to sync on demand, backfill history, or remove events by count, year, or date range.
        </div>}

        {syncOpen && googlePlacesStatus?.status === "capped" && (
          <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
            Google Maps enrichment is capped for now. Syncs will continue with Foursquare locations.
          </p>
        )}

        {syncOpen && !canSync && (
          <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
            {!foursquareConnected
              ? <>⚠️ connect foursquare to enable sync.</>
              : calendarStatus === "checking"
              ? <span className="flex items-center gap-1.5 text-muted-foreground/40">checking calendar status… <Spinner /></span>
              : !calendarReady
              ? <>⚠️ set up the calendar above to enable sync.</>
              : <>⚠️ connect both accounts to enable sync.</>}
          </p>
        )}

	        {syncOpen && canSync && (
	          <Tabs defaultValue="count">
	            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
	              <HoverCard openDelay={200}>
	                <HoverCardTrigger asChild>
	                  <span className="inline-flex items-center gap-1.5 cursor-default">
	                    <SiGooglemaps size={12} className="text-[#4285F4]" />
	                    <span className="font-semibold text-[#4285F4]">Google Maps API limit</span>
	                    <LuInfo size={11} className="text-[#4285F4]/80" />
	                  </span>
	                </HoverCardTrigger>
	                <HoverCardContent align="start" className="w-64 text-xs text-muted-foreground">
	                  Sets the maximum number of Google Maps place lookups this manual sync can make. Cached venues do not count against this number.
	                </HoverCardContent>
	              </HoverCard>
	              <input
	                type="number"
	                min={0}
	                max={googlePlacesStatus?.monthlyLimit ?? 500}
	                value={manualGooglePlacesLimit}
	                onChange={(e) => {
	                  const raw = e.target.value;
	                  if (raw === "") {
	                    setManualGooglePlacesLimit("");
	                    setGooglePlacesPreflight(null);
	                    return;
	                  }
	                  const max = googlePlacesStatus?.monthlyLimit ?? 500;
	                  setManualGooglePlacesLimit(Math.min(max, Math.max(0, parseInt(raw) || 0)));
	                  setGooglePlacesPreflight(null);
	                }}
	                placeholder={String(googlePlacesStatus?.backfillRunLimit ?? 250)}
	                className="h-6 w-16 rounded border border-input bg-background px-2 text-center font-[family-name:var(--font-geist-mono)] text-xs text-foreground"
	              />
	              <span>lookups/run</span>
	              <div className="ml-auto flex items-center gap-1.5">
	                <HoverCard openDelay={200}>
	                  <HoverCardTrigger asChild>
	                    <span
	                      className={`inline-flex cursor-default items-center gap-1 text-xs text-muted-foreground transition-[font-weight] ${
	                        manualGooglePlacesAllowFallback ? "font-semibold" : "font-medium"
	                      }`}
	                    >
	                      Use Foursquare Data
	                      <LuInfo size={11} className="text-muted-foreground/70" />
	                    </span>
	                  </HoverCardTrigger>
	                  <HoverCardContent align="end" className="w-64 text-xs text-muted-foreground">
	                    When the Google Maps API limit is reached, continue creating events with the Foursquare location instead of stopping the sync.
	                  </HoverCardContent>
	                </HoverCard>
	                <button
	                  type="button"
	                  role="switch"
	                  aria-checked={manualGooglePlacesAllowFallback}
	                  aria-label="use Foursquare after limit is reached"
	                  onClick={() => {
	                    setManualGooglePlacesAllowFallback((value) => !value);
	                    setGooglePlacesPreflight(null);
	                  }}
	                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${
	                    manualGooglePlacesAllowFallback ? "bg-foreground" : "bg-input"
	                  }`}
	                >
	                  <span className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${manualGooglePlacesAllowFallback ? "translate-x-3.5" : "translate-x-0.5"}`} />
	                </button>
	              </div>
	            </div>
	            <TabsList className="h-7">
              <TabsTrigger value="count" className="text-xs h-5 px-3 gap-1.5"><LuList size={11} />last (x) check-ins</TabsTrigger>
              <TabsTrigger value="range" className="text-xs h-5 px-3 gap-1.5"><LuCalendarRange size={11} />date / range</TabsTrigger>
              <TabsTrigger value="year" className="text-xs h-5 px-3 gap-1.5"><LuCalendarDays size={11} />year</TabsTrigger>
            </TabsList>

            {/* last N tab */}
            <TabsContent value="count" className="mt-5 space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    id="action-count"
                    name="action-count"
                    min={1}
                    max={250}
                    value={quickCount}
                    onChange={(e) => { const raw = e.target.value; if (raw === "") { setQuickCount(""); setQuickDeleteCount(""); return; } const v = Math.min(250, Math.max(1, parseInt(raw) || 1)); setQuickCount(v); setQuickDeleteCount(v); }}
                    placeholder="5"
                    className={`w-14 h-7 text-xs text-center rounded border bg-background px-2 font-[family-name:var(--font-geist-mono)] ${quickCount === 250 ? "border-amber-400 text-amber-600" : "border-input"}`}
                  />
                  <span className="text-xs text-muted-foreground">check-ins</span>
                  {quickCount === 250 && <span className="text-xs text-amber-500">max</span>}
                  {(quickCount !== "" || quickResult || quickDeleteResult || quickError) && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <button onClick={() => { setQuickCount(""); setQuickDeleteCount(""); setQuickResult(null); setQuickDeleteResult(null); setQuickError(null); }} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">clear</button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1.5 hover:bg-foreground hover:text-background hover:border-foreground transition-colors" onClick={handleQuickSync} disabled={quickLoading || quickCount === ""}>
                    <LuRefreshCw size={11} />sync
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1.5 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors" disabled={quickDeleteLoading || quickDeleteCount === ""}>
                        <LuTrash2 size={11} />remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove last <span className="font-[family-name:var(--font-geist-mono)]">{quickDeleteCount}</span> check-in{quickDeleteCount !== 1 ? "s" : ""}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently removes <strong><span className="font-[family-name:var(--font-geist-mono)]">{quickDeleteCount}</span> synced calendar event{quickDeleteCount !== 1 ? "s" : ""}</strong> and records. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleQuickDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="space-y-1.5 min-h-[1rem]">
                {Number(quickCount) > 15 && <p className="text-xs text-amber-500">over 15 check-ins may timeout</p>}
                {(quickLoading || quickResult) && !quickError && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${quickLoading ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                      {quickLoading ? <><Spinner className="size-3" />syncing{" "}<span className="font-[family-name:var(--font-geist-mono)]">{quickCount}</span>{" "}check-ins…</> : <>✓ <span className="font-[family-name:var(--font-geist-mono)]">{quickResult!.synced}</span> new, <span className="font-[family-name:var(--font-geist-mono)]">{quickResult!.skipped}</span> skipped</>}
                    </span>
                    {quickLoading && (
                      <button onClick={handleStopQuickSync} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"><LuX size={10} />stop</button>
                    )}
                  </div>
                )}
                {quickError && !quickLoading && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">⚠ {quickError}</span>}
                {(quickDeleteLoading || quickDeleteResult) && (
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${quickDeleteLoading ? "bg-muted text-muted-foreground" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                    {quickDeleteLoading ? <><Spinner className="size-3" />removing{" "}<span className="font-[family-name:var(--font-geist-mono)]">{quickDeleteCount}</span>{" "}check-ins…</> : <>✓ <span className="font-[family-name:var(--font-geist-mono)]">{quickDeleteResult!.deleted}</span> removed{quickDeleteResult!.errors > 0 ? <>, <span className="font-[family-name:var(--font-geist-mono)]">{quickDeleteResult!.errors}</span> errors</> : ""}</>}
                  </span>
                )}
              </div>
            </TabsContent>

            {/* year tab */}
            <TabsContent value="year" className="mt-5 space-y-3">
              <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2">
                <p className="text-[11px] leading-4 text-muted-foreground">
                  {hasCheckedYearGap && unscannedGap != null
                    ? `${unscannedGap.toLocaleString()} check-in${unscannedGap !== 1 ? "s are" : " is"} still unaccounted for outside the ${loadedYearCount} year${loadedYearCount !== 1 ? "s" : ""} checked so far.`
                    : "The all-time gap compares Swarm total check-ins against saved calendar events; pick years below to see where the gap lives."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-foreground">
                      {FIRST_FOURSQUARE_YEAR}-{currentYear}
                    </span>{" "}
                    years available
                  </span>
                  <span>
                    <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-foreground">
                      {allTimeMissing == null ? "..." : allTimeMissing.toLocaleString()}
                    </span>{" "}
                    missing all-time
                  </span>
                  {hasCheckedYearGap && (
                    <span>
                      <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-foreground">
                        {loadedYearGap.toLocaleString()}
                      </span>{" "}
                      found in checked years
                    </span>
                  )}
                  {hasCheckedYearGap && (
                    <span>
                      <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-foreground">
                        {unscannedGap!.toLocaleString()}
                      </span>{" "}
                      still unaccounted for
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
	                <Select value={fromYear} onValueChange={(v) => { setFromYear(v); setDeleteYearValue(v); setDeleteYearResult(null); setGooglePlacesPreflight(null); setSyncState({ type: "idle" }); }}>
                  <SelectTrigger className="h-7 text-xs w-24 font-[family-name:var(--font-geist-mono)]"><SelectValue placeholder="year" /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)} className="font-[family-name:var(--font-geist-mono)]">{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fromYear && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
	                    <button onClick={() => { setFromYear(""); setDeleteYearValue(String(currentYear)); setDeleteYearResult(null); setGooglePlacesPreflight(null); setSyncState({ type: "idle" }); }} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">clear</button>
                  </>
                )}
                <div className="flex items-center gap-2 ml-auto">
	                  <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1.5 hover:bg-foreground hover:text-background hover:border-foreground transition-colors" onClick={handleFullSync} disabled={syncState.type === "loading" || syncState.type === "running" || googlePlacesPreflightLoading || !fromYear}>
                    <LuRefreshCw size={11} />sync
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1.5 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors" disabled={deleteYearLoading || !fromYear}>
                        <LuTrash2 size={11} />remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove <span className="font-[family-name:var(--font-geist-mono)]">{deleteYearValue}</span> check-ins?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently removes <strong>{yearCounts[fromYear]?.synced != null ? <><span className="font-[family-name:var(--font-geist-mono)]">{yearCounts[fromYear].synced}</span> synced</> : "all synced"} calendar events</strong> and records from <span className="font-[family-name:var(--font-geist-mono)]">{deleteYearValue}</span>. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteYear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {/* status slot: count → spinner → pill */}
              <div className="min-h-[1rem]">
              {fromYear && (() => {
                const isActive = syncState.type !== "idle" || deleteYearLoading || !!deleteYearResult;
                return (
                  <>
                    {!isActive && (
                      <div className="space-y-1.5">
                        <div className="text-xs text-muted-foreground">
                          {yearCountLoading ? <span className="flex items-center gap-1.5"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></span> : yearCounts[fromYear] != null ? (() => {
                            const { foursquare, synced } = yearCounts[fromYear];
                            return <span className="flex items-center gap-1.5">
                              {foursquare != null && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground"><SiSwarm size={10} color="#ffa500" /><span className="font-[family-name:var(--font-geist-mono)] font-medium text-foreground">{foursquare.toLocaleString()}</span> on swarm</span>}
                              {synced != null && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground"><span className="font-[family-name:var(--font-geist-mono)] font-medium text-foreground">{synced.toLocaleString()}</span> synced</span>}
                              <span className="text-[10px] text-muted-foreground/40" title="Swarm displays check-ins in local time — counts may differ by 1 at year boundaries.">±1 at boundaries</span>
                            </span>;
                          })() : null}
                        </div>
                        {yearCounts[fromYear]?.foursquare != null && yearCounts[fromYear]?.synced != null && (() => {
                          const pct = Math.min(100, Math.round((yearCounts[fromYear].synced! / yearCounts[fromYear].foursquare!) * 100));
                          const color = pct >= 100 ? "hsl(142, 71%, 45%)" : pct >= 75 ? "hsl(142, 60%, 55%)" : pct >= 50 ? "hsl(25, 95%, 53%)" : pct >= 25 ? "hsl(38, 92%, 50%)" : "hsl(0, 0%, 53%)";
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <span className="text-xs text-muted-foreground/50 font-[family-name:var(--font-geist-mono)] shrink-0">{pct}%</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
	                    {googlePlacesPreflightLoading && <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"><Spinner />checking maps usage…</span>}
	                    {googlePlacesPreflight && !googlePlacesPreflightLoading && syncState.type === "idle" && (
	                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
	                        <LuMapPin size={10} /><span className="font-[family-name:var(--font-geist-mono)]">{googlePlacesPreflight.estimatedGoogleCalls}</span> maps lookups, <span className="font-[family-name:var(--font-geist-mono)]">{googlePlacesPreflight.fallbackCount}</span> fallback
	                      </span>
	                    )}
	                    {syncState.type === "loading" && <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium font-[family-name:var(--font-geist-mono)]"><Spinner />syncing…</span>}
                    {syncState.type === "running" && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium font-[family-name:var(--font-geist-mono)]"><Spinner />{syncState.synced} new, {syncState.skipped} skipped</span>
                        <button onClick={handleStopSync} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"><LuX size={10} />stop</button>
                      </div>
                    )}
                    {syncState.type === "done" && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ <span className="font-[family-name:var(--font-geist-mono)]">{syncState.synced}</span> new, <span className="font-[family-name:var(--font-geist-mono)]">{syncState.skipped}</span> skipped</span>}
                    {syncState.type === "error" && <p className="text-xs text-destructive">{syncState.message}</p>}
                    {deleteYearLoading && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Spinner />removing <span className="font-[family-name:var(--font-geist-mono)]">{deleteYearValue}</span> check-ins…</div>}
                    {deleteYearResult && !deleteYearLoading && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">✓ <span className="font-[family-name:var(--font-geist-mono)]">{deleteYearResult.deleted}</span> removed{deleteYearResult.errors > 0 ? <>, <span className="font-[family-name:var(--font-geist-mono)]">{deleteYearResult.errors}</span> errors</> : ""}</span>}
                  </>
                );
              })()}
              </div>
            </TabsContent>

            {/* range tab */}
            <TabsContent value="range" className="mt-5 space-y-3">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-7 text-xs justify-start font-normal gap-1.5 ${!rangeFrom && !rangeTo && "text-muted-foreground"}`}>
                      <LuCalendar size={11} />
                      {rangeFrom || rangeTo ? (
                        !rangeTo ? (
                          <>{format(rangeFrom!, "MMM")} <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom!, "d")}</span>, <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom!, "yyyy")}</span></>
                        ) : (
                          <>
                            {rangeFrom ? <>{format(rangeFrom, "MMM")} <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom, "d")}</span>, <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeFrom, "yyyy")}</span></> : "start"}
                            <span className="mx-1 opacity-40">→</span>
                            <>{format(rangeTo, "MMM")} <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeTo, "d")}</span>, <span className="font-[family-name:var(--font-geist-mono)]">{format(rangeTo, "yyyy")}</span></>
                          </>
                        )
                      ) : "select range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
	                    <Calendar
	                      mode="range"
	                      selected={{ from: rangeFrom, to: rangeTo }}
	                      onSelect={(r: DateRange | undefined) => { setRangeFrom(r?.from); setRangeTo(r?.to); setGooglePlacesPreflight(null); }}
                      initialFocus
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                {(rangeFrom || rangeTo) && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
	                    <button onClick={() => { setRangeFrom(undefined); setRangeTo(undefined); setRangeDeleteResult(null); setGooglePlacesPreflight(null); setRangeSyncState({ type: "idle" }); }} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">clear</button>
                  </>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
	                    className="h-7 text-xs px-3 gap-1.5 hover:bg-foreground hover:text-background hover:border-foreground transition-colors"
	                    onClick={handleRangeSync}
	                    disabled={!rangeFrom || rangeCountLoading || rangeSyncState.type === "loading" || rangeSyncState.type === "running" || googlePlacesPreflightLoading}
                  >
                    <LuRefreshCw size={11} />sync
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1.5 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors" disabled={!rangeFrom || rangeDeleteLoading}>
                        <LuTrash2 size={11} />remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove check-ins in range?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently removes <strong>{rangeCount?.synced != null ? `${rangeCount.synced} synced` : "all synced"} calendar events</strong> and records {rangeFrom && rangeTo && rangeTo.getTime() !== rangeFrom.getTime() ? <>from {format(rangeFrom, "MMM d, yyyy")} to {format(rangeTo, "MMM d, yyyy")}</> : rangeFrom ? <>on {format(rangeFrom, "MMM d, yyyy")}</> : ""}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRangeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="min-h-[1rem]">
              {rangeFrom && (() => {
                const isActive = rangeSyncState.type !== "idle" || rangeDeleteLoading || !!rangeDeleteResult;
                return (
                  <>
                    {!isActive && (
                      <div className="text-xs text-muted-foreground">
                        {rangeCountLoading ? <span className="flex items-center gap-1.5"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></span> : rangeCount != null ? (() => {
                          const { foursquare, synced } = rangeCount;
                          return <span className="flex items-center gap-1.5">
                            {foursquare != null && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground"><SiSwarm size={10} color="#ffa500" /><span className="font-[family-name:var(--font-geist-mono)] font-medium text-foreground">{foursquare.toLocaleString()}</span> on swarm</span>}
                            {synced != null && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground"><span className="font-[family-name:var(--font-geist-mono)] font-medium text-foreground">{synced.toLocaleString()}</span> synced</span>}
                          </span>;
                        })() : null}
                      </div>
                    )}
	                    {googlePlacesPreflightLoading && <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"><Spinner />checking maps usage…</span>}
	                    {googlePlacesPreflight && !googlePlacesPreflightLoading && rangeSyncState.type === "idle" && (
	                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
	                        <LuMapPin size={10} /><span className="font-[family-name:var(--font-geist-mono)]">{googlePlacesPreflight.estimatedGoogleCalls}</span> maps lookups, <span className="font-[family-name:var(--font-geist-mono)]">{googlePlacesPreflight.fallbackCount}</span> fallback
	                      </span>
	                    )}
	                    {rangeSyncState.type === "loading" && <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium font-[family-name:var(--font-geist-mono)]"><Spinner />syncing…</span>}
                    {rangeSyncState.type === "running" && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium font-[family-name:var(--font-geist-mono)]"><Spinner />{rangeSyncState.synced} new, {rangeSyncState.skipped} skipped{rangeSyncState.total ? ` of ${rangeSyncState.total}` : ""}</span>
                        <button onClick={handleStopRangeSync} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"><LuX size={10} />stop</button>
                      </div>
                    )}
                    {rangeSyncState.type === "done" && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ <span className="font-[family-name:var(--font-geist-mono)]">{rangeSyncState.synced}</span> new, <span className="font-[family-name:var(--font-geist-mono)]">{rangeSyncState.skipped}</span> skipped</span>}
                    {rangeSyncState.type === "error" && <p className="text-xs text-destructive">{rangeSyncState.message}</p>}
                    {rangeDeleteLoading && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Spinner />removing{rangeCount?.synced != null ? <> <span className="font-[family-name:var(--font-geist-mono)]">{rangeCount.synced}</span></> : ""} check-ins…</div>}
                    {rangeDeleteResult && !rangeDeleteLoading && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">✓ <span className="font-[family-name:var(--font-geist-mono)]">{rangeDeleteResult.deleted}</span> removed{rangeDeleteResult.errors > 0 ? <>, <span className="font-[family-name:var(--font-geist-mono)]">{rangeDeleteResult.errors}</span> errors</> : ""}</span>}
                  </>
                );
              })()}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      </> }

      <Separator />

      <div className="flex items-center justify-between">
        <a
          href="https://github.com/gdsingh/hivesync"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <SiGithub size={13} />
          github
        </a>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${foursquareConnected && googleConnected ? "bg-green-500" : "bg-amber-500"}`} />
            connections
          </button>
          <span className="text-muted-foreground/30">·</span>
          <form action="/api/auth/logout" method="POST" className="flex">
            <Button type="submit" variant="outline" size="sm" className="h-7 text-xs px-3">sign out</Button>
          </form>
        </div>
      </div>

    </div>
  );
}
