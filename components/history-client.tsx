"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Separator } from "@/components/ui/separator";
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

  async function handleClear() {
    const res = await fetch("/api/history/clear", { method: "POST" });
    const { tombstone } = await res.json();
    setLogs([tombstone]);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
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

      {logs.length === 0 ? (
        <div className="flex justify-center">
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">No syncs recorded yet — run a <a href="/home#manual-sync" className="underline hover:opacity-70 transition-opacity">manual sync</a> or wait for a scheduled run.</span>
        </div>
      ) : (
        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-[15px] top-4 bottom-[40px] w-px bg-border" />

          {logs.map((log) => {
            const fromYear = log.fromDate ? log.fromDate.slice(0, 4) : null;
            const { icon: Icon } = typeLabel(log.type);
            const hasError = log.errors > 0;

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
            } else {
              title = "Scheduled";
              actionTag = "sync";
            }

            return (
              <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* timeline dot */}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border border-border">
                  <Icon size={12} className="text-muted-foreground" />
                </div>

                {/* content */}
                <div className="flex flex-1 items-start justify-between gap-4 pt-1">
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
