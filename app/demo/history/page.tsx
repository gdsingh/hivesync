import { HistoryClient } from "@/components/history-client";

const DUMMY_LOGS = [
  { id: "log1",  type: "POLL"   as const, synced: 2,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-22T00:00:00Z") },
  { id: "log2",  type: "QUICK"  as const, synced: 8,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-21T14:32:00Z") },
  { id: "log3",  type: "POLL"   as const, synced: 1,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-21T00:00:00Z") },
  { id: "log4",  type: "RANGE"  as const, synced: 47,   skipped: 12, errors: 0, errorMessage: null, fromDate: "2026-01-01", toDate: "2026-03-15", createdAt: new Date("2026-03-20T09:15:00Z") },
  { id: "log5",  type: "POLL"   as const, synced: 3,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-20T00:00:00Z") },
  { id: "log6",  type: "DELETE" as const, synced: 23,   skipped: 0,  errors: 0, errorMessage: null, fromDate: "2026-02-01", toDate: "2026-02-28", createdAt: new Date("2026-03-19T11:00:00Z") },
  { id: "log7",  type: "POLL"   as const, synced: 0,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-19T00:00:00Z") },
  { id: "log8",  type: "QUICK"  as const, synced: 15,   skipped: 2,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-18T16:45:00Z") },
  { id: "log9",  type: "POLL"   as const, synced: 2,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-18T00:00:00Z") },
  { id: "log10", type: "FULL"   as const, synced: 2847, skipped: 0,  errors: 0, errorMessage: null, fromDate: "2014-01-01", toDate: "2026-03-17", createdAt: new Date("2026-03-17T20:30:00Z") },
  { id: "log11", type: "RESYNC" as const, synced: 3,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-15T10:00:00Z") },
  { id: "log12", type: "POLL"   as const, synced: 0,    skipped: 0,  errors: 0, errorMessage: null, fromDate: null,         toDate: null,         createdAt: new Date("2026-03-15T00:00:00Z") },
];

export default function PreviewHistory() {
  return (
    <HistoryClient
      logs={DUMMY_LOGS}
      lastSyncedAt={new Date("2026-03-22T14:32:00Z")}
    />
  );
}
