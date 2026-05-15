"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LuMapPin } from "react-icons/lu";

interface Props {
  lastSyncedAt?: Date | string | null;
  rightExtra?: React.ReactNode;
}

const NAV = [
  { href: "/home",     label: "home" },
  { href: "/checkins", label: "check-ins" },
  { href: "/stats",    label: "stats" },
];

function getRelative(lastSyncedAt: Date | string): string {
  const diff = Date.now() - new Date(lastSyncedAt).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (isNaN(diff)) return "";
  return mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : hours < 24 ? `${hours}h ago` : days === 1 ? "yesterday" : days < 7 ? `${days}d ago` : new Date(lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AppHeader({ lastSyncedAt, rightExtra }: Props) {
  const pathname = usePathname();
  const [relative, setRelative] = useState<string | null>(null);
  const isPreview = pathname.startsWith("/preview");
  const prefix = isPreview ? "/preview" : "";

  useEffect(() => {
    if (!lastSyncedAt) return;
    setRelative(getRelative(lastSyncedAt));
  }, [lastSyncedAt]);

  const onHistory = pathname === `${prefix}/history`;
  const badge = relative ? (
    <a href={`${prefix}/history`} className="group relative inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold tracking-tight hover:bg-muted/70 transition-colors">
      <span className={onHistory ? "" : "group-hover:invisible"}>updated {relative}</span>
      {!onHistory && (
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">sync history</span>
      )}
    </a>
  ) : null;

  return (
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <a href={`${prefix}/home`} className="inline-flex items-center gap-2 hover:opacity-70 transition-opacity">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#ffa500]">
          <LuMapPin size={16} color="white" />
        </span>
        <span className="text-2xl font-semibold tracking-tight leading-none">Hive<span className="font-[family-name:var(--font-geist-mono)]">sync</span></span>
      </a>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav className="flex flex-wrap items-center gap-2 text-xs">
          {NAV.map((item, i) => (
            <span key={item.href} className="flex items-center gap-2">
              {i > 0 && <span className="text-border">·</span>}
              <a
                href={`${prefix}${item.href}`}
                className={`transition-colors ${pathname === `${prefix}${item.href}` ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {item.label}
              </a>
            </span>
          ))}
        </nav>
        {badge}
        {rightExtra}
      </div>
    </div>
  );
}
