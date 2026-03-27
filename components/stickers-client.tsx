"use client";

import { useEffect, useRef, useState } from "react";
import { BiSticker } from "react-icons/bi";
import type { FoursquareSticker } from "@/lib/sync";

const SIZE = 72;
const BADGE_R = 96;

interface Props {
  stickers: FoursquareSticker[];
  lastSyncedAt: Date | null;
}

export function StickersClient({ stickers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stateRef = useRef<{ x: number; y: number; vx: number; vy: number; hovered: boolean }[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || stickers.length === 0) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const avoidR = BADGE_R + SIZE / 2 + 12;

    stateRef.current = stickers.map(() => {
      let x = 0, y = 0;
      for (let attempts = 0; attempts < 100; attempts++) {
        x = Math.random() * (w - SIZE);
        y = Math.random() * (h - SIZE);
        if (Math.hypot(x + SIZE / 2 - w / 2, y + SIZE / 2 - h / 2) >= avoidR) break;
      }
      const speed = 0.25 + Math.random() * 0.35;
      const angle = Math.random() * Math.PI * 2;
      return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, hovered: false };
    });

    stateRef.current.forEach((s, i) => {
      const el = stickerRefs.current[i];
      if (el) el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    });

    let rafId: number;

    function animate() {
      const cw = container!.clientWidth;
      const ch = container!.clientHeight;
      const badgeCx = cw / 2;
      const badgeCy = ch / 2;
      const avoidR = BADGE_R + SIZE / 2 + 12;

      stateRef.current.forEach((s, i) => {
        if (s.hovered) return;

        s.x += s.vx;
        s.y += s.vy;

        if (s.x <= 0 || s.x >= cw - SIZE) {
          s.vx = -s.vx;
          s.x = Math.max(0, Math.min(cw - SIZE, s.x));
        }
        if (s.y <= 0 || s.y >= ch - SIZE) {
          s.vy = -s.vy;
          s.y = Math.max(0, Math.min(ch - SIZE, s.y));
        }

        const sx = s.x + SIZE / 2;
        const sy = s.y + SIZE / 2;
        const dx = sx - badgeCx;
        const dy = sy - badgeCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < avoidR && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dot = s.vx * nx + s.vy * ny;
          if (dot < 0) {
            s.vx -= 2 * dot * nx;
            s.vy -= 2 * dot * ny;
          }
          s.x = badgeCx + nx * avoidR - SIZE / 2;
          s.y = badgeCy + ny * avoidR - SIZE / 2;
        }

        const el = stickerRefs.current[i];
        if (el) el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      });

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [stickers.length]);

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden">
      {/* center badge */}
      <div className="absolute inset-0 flex items-center justify-center select-none z-20 pointer-events-none">
        <a
          href="/stats"
          className="group w-48 h-48 rounded-full flex flex-col items-center justify-center bg-foreground text-background hover:opacity-80 transition-opacity pointer-events-auto"
        >
          <BiSticker size={28} className="opacity-60 group-hover:hidden -mt-4" />
          <div className="group-hover:hidden h-2" />
          <span className="text-xs font-medium opacity-60 group-hover:hidden">You've earned</span>
          <span className="text-5xl font-bold font-[family-name:var(--font-geist-mono)] leading-none group-hover:hidden">{stickers.length}</span>
          <span className="text-xs font-medium opacity-60 group-hover:hidden">stickers!</span>
          <div className="hidden group-hover:flex flex-col items-center gap-0.5">
            <span className="text-xl">←</span>
            <span className="text-xs font-medium">back to stats page</span>
          </div>
        </a>
      </div>

      {stickers.map((s, i) => (
        <div
          key={s.id}
          ref={(el) => { stickerRefs.current[i] = el; }}
          className="absolute cursor-pointer"
          style={{ width: SIZE, height: SIZE, willChange: "transform", zIndex: hoveredIndex === i ? 40 : 10 }}
          onMouseEnter={() => { stateRef.current[i].hovered = true; setHoveredIndex(i); }}
          onMouseLeave={() => { stateRef.current[i].hovered = false; setHoveredIndex(null); }}
        >
          <img
            src={`${s.image.prefix}300${s.image.name}`}
            alt={s.name}
            width={SIZE}
            height={SIZE}
            className="w-full h-full object-contain"
            draggable={false}
          />
          {hoveredIndex === i && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-44 pointer-events-none">
              <div className="bg-popover text-popover-foreground text-[11px] rounded-md px-2.5 py-1.5 shadow-md border leading-relaxed text-center">
                {s.group?.name && <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">{s.group.name}</p>}
                <p className="font-medium text-xs mb-0.5">{s.name}</p>
                {s.unlockText && <p className="text-muted-foreground">{s.unlockText.trim()}</p>}
                {s.teaseText && <p className="text-muted-foreground/70 italic mt-1">{s.teaseText.trim()}</p>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
