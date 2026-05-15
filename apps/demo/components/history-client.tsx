"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Separator } from "@/components/ui/separator";
import { sitePath } from "@/lib/site-path";
import { LuRefreshCw, LuClock, LuZap, LuCalendarRange, LuHistory, LuTrash2, LuTriangleAlert, LuEraser } from "react-icons/lu";
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

interface SyncLog {
  id: string;
  type: "QUICK" | "POLL" | "FULL" | "RANGE" | "DELETE" | "RESYNC" | "CLEAR";
  synced: number;
  skipped: number;
  errors: number;
  errorMessage: string | null;
  fromDate: string | null;
  toDate: string | null;
  createdAt: Date;
}

interface Props {
  logs: SyncLog[];
  lastSyncedAt: Date | null;
}

function typeLabel(type: SyncLog["type"]) {
  if (type === "QUICK")  return { label: "quick",  icon: LuZap };
  if (type === "POLL")   return { label: "auto",   icon: LuClock };
  if (type === "RANGE")  return { label: "range",  icon: LuCalendarRange };
  if (type === "DELETE") return { label: "delete", icon: LuTrash2 };
  if (type === "RESYNC") return { label: "resync", icon: LuRefreshCw };
  if (type === "CLEAR")  return { label: "clear",  icon: LuEraser };
  return { label: "full", icon: LuRefreshCw };
}

function formatShortDate(iso: string) {
  const [year, month, day] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function HistoryClient({ logs: initialLogs, lastSyncedAt }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; errors: number } | null>(null);

  async function handleClear() {
    const res = await fetch("/api/history/clear", { method: "POST" });
    const { tombstone } = await res.json();
    setLogs([tombstone]);
  }

  function clearResultSoon() {
    setTimeout(() => setDeleteResult(null), 3000);
  }

  function toggleSelect(id: string) {
    setDeleteResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    setDeleting(true);
    setDeleteResult(null);
    const deletedIds = new Set(ids);
    setLogs((prev) => prev.filter((log) => !deletedIds.has(log.id)));
    setSelected(new Set());
    setDeleteResult({ deleted: deletedIds.size, errors: 0 });
    clearResultSoon();
    setDeleting(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8 sm:px-4">
      <AppHeader lastSyncedAt={lastSyncedAt} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <LuHistory size={16} className="text-muted-foreground" />
            Sync History
          </h1>
          {logs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Last updated on {formatDate(logs[0].createdAt)}</p>
          )}
        </div>
        {logs.length > 0 && (
          <div className="text-right flex flex-col gap-1">
            <p className="text-sm font-medium font-[family-name:var(--font-geist-mono)]">{logs.filter(l => l.type !== "CLEAR").length}</p>
            <p className="text-xs text-muted-foreground">syncs</p>
          </div>
        )}
        {/* clear history button — temporarily hidden, backend at /api/history/clear still works
        {logs.length > 0 && logs.some(l => l.type !== "CLEAR") && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors">
                <LuTrash2 size={10} />clear
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear sync history?</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently removes all {logs.length} sync log entries. This does not affect your synced check-ins.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )} */}
      </div>

      <Separator />

      <div className={`fixed inset-x-4 bottom-4 z-50 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm shadow-lg transition-all duration-200 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:flex-nowrap sm:justify-start sm:gap-3 sm:rounded-full sm:px-4 ${selected.size > 0 || deleteResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        {deleting && <div className="flex items-center gap-1.5 text-xs text-muted-foreground">removing…</div>}
        {deleteResult && !deleting && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${deleteResult.errors > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {deleteResult.errors > 0 ? "warning" : "done"} <span className="font-[family-name:var(--font-geist-mono)]">{deleteResult.deleted}</span> deleted{deleteResult.errors > 0 ? `, ${deleteResult.errors} errors` : ""}
          </span>
        )}
        {selected.size > 0 && !deleting && (
          <>
            <span className="text-xs text-muted-foreground">
              <span className="font-[family-name:var(--font-geist-mono)] font-medium text-foreground">{selected.size}</span> selected
            </span>
            <span className="text-border">|</span>
            <button onClick={() => setSelected(new Set(logs.map((log) => log.id)))} className="text-xs text-muted-foreground transition-colors hover:text-foreground">all</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground transition-colors hover:text-foreground">clear</button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 transition-colors hover:bg-red-200">
                  remove <span className="font-[family-name:var(--font-geist-mono)]">{selected.size}</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete selected history entries?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes {selected.size} sync log entr{selected.size === 1 ? "y" : "ies"} only. Your synced check-ins and calendar events are unchanged.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="flex justify-center">
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">No syncs recorded yet — run a <a href={sitePath("/home#manual-sync")} className="underline hover:opacity-70 transition-opacity">manual sync</a> or wait for a scheduled run.</span>
        </div>
      ) : (
        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-[15px] top-4 bottom-[40px] w-px bg-border" />

          {logs.map((log) => {
            const fromYear = log.fromDate ? log.fromDate.slice(0, 4) : null;
            const { icon: Icon } = typeLabel(log.type);
            const hasError = log.errors > 0;
            const isSelected = selected.has(log.id);

            const isYearlyRange = log.type === "RANGE" &&
              log.fromDate?.endsWith("-01-01") &&
              log.toDate?.endsWith("-01-01") &&
              log.fromDate != null && log.toDate != null &&
              parseInt(log.toDate.slice(0, 4)) === parseInt(log.fromDate.slice(0, 4)) + 1;

            const isDeleteYearly = log.type === "DELETE" &&
              log.fromDate?.endsWith("-01-01") && log.toDate?.endsWith("-01-01") &&
              log.fromDate != null && log.toDate != null &&
              parseInt(log.toDate.slice(0, 4)) === parseInt(log.fromDate.slice(0, 4)) + 1;
            const isDeleteRange = log.type === "DELETE" && log.fromDate && log.toDate && !isDeleteYearly;
            const isDeleteQuick = log.type === "DELETE" && log.errorMessage?.startsWith("last ");
            const isDeleteManual = log.type === "DELETE" && log.errorMessage === "manual selection";

            let title: React.ReactNode;
            let subtitle: React.ReactNode = null;
            let actionTag: React.ReactNode = null;

            if (log.type === "CLEAR") {
              title = "History Cleared";
              actionTag = null;
            } else if (log.type === "FULL") {
              title = fromYear ? "Yearly" : "Full";
              if (fromYear) subtitle = fromYear;
              actionTag = "sync";
            } else if (isYearlyRange) {
              title = "Yearly";
              subtitle = log.fromDate!.slice(0, 4);
              actionTag = "sync";
            } else if (log.type === "RANGE") {
              title = "Date Range";
              if (log.fromDate && log.toDate) subtitle = <>{formatShortDate(log.fromDate)} – {formatShortDate(log.toDate)}</>;
              actionTag = "sync";
            } else if (log.type === "QUICK") {
              const attempted = log.synced + log.skipped;
              title = `Last ${attempted} check-ins`;
              actionTag = "sync";
            } else if (isDeleteYearly) {
              title = "Yearly";
              subtitle = log.fromDate!.slice(0, 4);
              actionTag = "delete";
            } else if (isDeleteRange) {
              title = "Date Range";
              subtitle = <>{formatShortDate(log.fromDate!)} – {formatShortDate(log.toDate!)}</>;
              actionTag = "delete";
            } else if (isDeleteQuick) {
              title = `Last ${log.errorMessage!.replace("last ", "")} check-ins`;
              actionTag = "delete";
            } else if (isDeleteManual) {
              title = "Manual";
              actionTag = "delete";
            } else if (log.type === "DELETE") {
              title = "Full";
              actionTag = "delete";
            } else if (log.type === "RESYNC") {
              title = "Manual";
              actionTag = "resync";
            } else if (log.type === "POLL") {
              title = "Daily auto-sync";
              subtitle = "last 24 hours";
              actionTag = "sync";
            } else {
              title = "Scheduled";
              actionTag = "sync";
            }

            return (
              <div key={log.id} className="group/row relative flex gap-4 pb-6 last:pb-0">
                {/* timeline dot */}
                <button
                  type="button"
                  onClick={() => toggleSelect(log.id)}
                  aria-pressed={isSelected}
                  aria-label="select history entry"
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background transition-colors ${isSelected ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:border-foreground/40"}`}
                >
                  <Icon size={12} className={`absolute transition-opacity ${isSelected ? "opacity-0" : "opacity-100 group-hover/row:opacity-0"}`} />
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-opacity ${isSelected ? "border-foreground bg-foreground opacity-100" : "border-muted-foreground/50 opacity-0 group-hover/row:opacity-100"}`}
                    aria-hidden="true"
                  />
                </button>

                {/* content */}
                <div className={`flex flex-1 items-start justify-between gap-4 pt-1 transition-opacity ${isSelected ? "opacity-40" : ""}`}>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{title}</span>
                      {subtitle && (
                        <span className="text-xs text-muted-foreground">{subtitle}</span>
                      )}
                      {actionTag && (
                        <span className="text-[10px] text-muted-foreground/50 font-[family-name:var(--font-geist-mono)]">
                          · {actionTag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {log.errorMessage && log.errorMessage !== "stopped by user" && log.type !== "DELETE" && log.type !== "RESYNC" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[11px] font-[family-name:var(--font-geist-mono)]">
                          <LuTriangleAlert size={10} />{log.errorMessage}
                        </span>
                      ) : (
                        <>
                          {log.type === "DELETE" ? (
                            log.synced > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[11px] font-[family-name:var(--font-geist-mono)]">
                              -{log.synced} removed
                            </span>
                          ) : log.type === "RESYNC" ? (
                            log.synced > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-[family-name:var(--font-geist-mono)]">
                              {log.synced} resynced
                            </span>
                          ) : (
                            log.synced > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-[11px] font-[family-name:var(--font-geist-mono)]">
                              +{log.synced} new
                            </span>
                          )}
                          {log.type !== "DELETE" && log.skipped > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-[family-name:var(--font-geist-mono)]">
                              {log.skipped} skipped
                            </span>
                          )}
                          {log.type === "POLL" && log.synced === 0 && log.skipped === 0 && log.errors === 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-[family-name:var(--font-geist-mono)]">
                              no new check-ins
                            </span>
                          )}
                          {hasError && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[11px] font-[family-name:var(--font-geist-mono)]">
                              <LuTriangleAlert size={10} />{log.errors} errors
                            </span>
                          )}
                          {log.errorMessage === "stopped by user" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[11px] font-[family-name:var(--font-geist-mono)]">
                              stopped by user
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                    <p className="text-xs text-muted-foreground/50 font-[family-name:var(--font-geist-mono)]">{formatTime(log.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
