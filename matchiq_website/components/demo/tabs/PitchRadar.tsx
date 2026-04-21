"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { PITCH_PLAYERS } from "@/lib/mockData";
import type { TrackingRow, AllTrackingData } from "../DemoClient";
import type { NamesMap } from "../PlayerNamingModal";

const TEAM_COLORS: Record<number, string> = { 0: "#3b82f6", 1: "#f43f5e" };
function playerColor(team: number) { return TEAM_COLORS[team] ?? "#facc15"; }

/* Pick the closest sampled frame from allData for a given frame number */
function resolveFrame(allData: AllTrackingData, frame: number): TrackingRow[] | null {
  const keys = Object.keys(allData.frames).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return null;
  let closest = keys[0];
  for (const k of keys) {
    if (Math.abs(k - frame) < Math.abs(closest - frame)) closest = k;
  }
  return allData.frames[String(closest)] ?? null;
}

/* Merge current frame rows with a sticky ball: if the current frame has no ball
   (airborne / not detected), inject the last known ball position instead. */
function withStickyBall(rows: TrackingRow[], lastBall: TrackingRow | null): TrackingRow[] {
  const hasBall = rows.some(r => r.role === "ball");
  if (hasBall || !lastBall) return rows;
  return [...rows, lastBall];
}

/* ── Shared pitch SVG renderer ─────────────────────────────────────────────── */
function PitchSVG({ players, names, W, H }: {
  players: TrackingRow[];
  names?: NamesMap;
  W: number;
  H: number;
}) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }} xmlns="http://www.w3.org/2000/svg">
      <rect width={W} height={H} fill="#052e16" rx="6" />
      <g stroke="#166534" strokeWidth="1.2" fill="none">
        <rect x="20" y="14" width={W - 40} height={H - 28} rx="2" />
        <line x1={W / 2} y1="14" x2={W / 2} y2={H - 14} />
        <circle cx={W / 2} cy={H / 2} r={H * 0.14} />
        <circle cx={W / 2} cy={H / 2} r="2" fill="#166534" />
        <rect x="20"       y={H / 2 - H * 0.19} width={W * 0.14} height={H * 0.38} />
        <rect x="20"       y={H / 2 - H * 0.08} width={W * 0.055} height={H * 0.16} />
        <rect x={W - 20 - W * 0.14} y={H / 2 - H * 0.19} width={W * 0.14} height={H * 0.38} />
        <rect x={W - 20 - W * 0.055} y={H / 2 - H * 0.08} width={W * 0.055} height={H * 0.16} />
      </g>
      {players.map((p, idx) => {
        const cx = 20 + ((W - 40) * p.x) / 100;
        const cy = 14 + ((H - 28) * p.y) / 100;
        const r  = W < 280 ? 4.5 : 6;

        if (p.role === "ball") return (
          <g key={`ball-${idx}`}>
            <polygon
              points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
              fill="white" filter="url(#bGlow)"
            />
          </g>
        );

        if (p.role === "referee") return (
          <g key={`ref-${idx}`}>
            <circle cx={cx} cy={cy} r={r} fill="#facc15" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
            <text x={cx} y={cy + r * 0.5} textAnchor="middle" fontSize={r * 1.1} fontWeight="900" fill="#000">R</text>
          </g>
        );

        const color    = playerColor(p.team);
        const assigned = names?.players?.[String(p.id)];
        const label    = assigned ? assigned.slice(0, 3) : (p.id > 0 ? String(p.id) : "?");

        return (
          <g key={`p-${p.id}-${idx}`}>
            <circle cx={cx} cy={cy} r={r * 1.5} fill={color} opacity={0.18} />
            <circle cx={cx} cy={cy} r={r} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
            {W >= 280 && (
              <text x={cx} y={cy + r * 0.5} textAnchor="middle" fontSize={r * 1.1} fontWeight="900" fill="white">
                {label}
              </text>
            )}
          </g>
        );
      })}
      <defs>
        <filter id="bGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/* ── Main component ────────────────────────────────────────────────────────── */
export default function PitchRadar({
  data,
  allData,
  currentFrame,
  names,
  floating = false,
}: {
  data: TrackingRow[] | null;
  allData?: AllTrackingData | null;
  currentFrame?: number;
  names?: NamesMap;
  floating?: boolean;
}) {
  const [minimized, setMinimized] = useState(false);
  const [pos,  setPos]  = useState({ x: 16, y: 16 });
  const [size, setSize] = useState({ w: 260, h: 160 });
  const dragRef   = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastBallRef = useRef<TrackingRow | null>(null);

  /* Resolve which players to show — recomputes whenever frame or data changes */
  const players: TrackingRow[] = useMemo(() => {
    let rows: TrackingRow[];
    if (allData && currentFrame !== undefined) {
      rows = resolveFrame(allData, currentFrame) ?? data ?? PITCH_PLAYERS;
    } else {
      rows = data ?? PITCH_PLAYERS;
    }
    // Update sticky ball ref whenever a ball row is present
    const ball = rows.find(r => r.role === "ball");
    if (ball) lastBallRef.current = ball;
    return withStickyBall(rows, lastBallRef.current);
  }, [allData, currentFrame, data]);

  const isLive = allData !== null && allData !== undefined ? true : data !== null;

  /* ── Drag logic ── */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const onMove = (mv: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX - (mv.clientX - dragRef.current.startX),
        y: dragRef.current.origY - (mv.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos]);

  /* ── Resize logic ── */
  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    const onMove = (mv: MouseEvent) => {
      if (!resizeRef.current) return;
      setSize({
        w: Math.max(180, resizeRef.current.origW + (mv.clientX - resizeRef.current.startX)),
        h: Math.max(110, resizeRef.current.origH + (mv.clientY - resizeRef.current.startY)),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size]);

  /* ── Floating minimap ── */
  if (floating) {
    const W = size.w, H = size.h;
    return (
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          bottom: pos.y,
          right: pos.x,
          zIndex: 50,
          userSelect: "none",
          filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.7))",
        }}
      >
        {/* Title bar — drag handle */}
        <div
          onMouseDown={onMouseDown}
          style={{
            background: "rgba(10,10,10,0.92)",
            border: "1px solid rgba(212,175,55,0.35)",
            borderBottom: minimized ? "1px solid rgba(212,175,55,0.35)" : "none",
            borderRadius: minimized ? "0.6rem" : "0.6rem 0.6rem 0 0",
            padding: "5px 10px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "grab",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.6rem", color: "#D4AF37", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ⚽ Minimap
            </span>
            {isLive && !minimized && (
              <span style={{ fontSize: "0.55rem", color: "#22c55e", fontWeight: 700 }}>● Live</span>
            )}
          </div>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setMinimized(m => !m)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#555", fontSize: "0.75rem", padding: "0 2px", lineHeight: 1,
            }}
          >
            {minimized ? "▲" : "▼"}
          </button>
        </div>

        {/* Pitch */}
        {!minimized && (
          <div style={{
            width: W, height: H,
            background: "rgba(10,10,10,0.88)",
            border: "1px solid rgba(212,175,55,0.35)",
            borderTop: "none",
            borderRadius: "0 0 0.6rem 0.6rem",
            overflow: "hidden",
            position: "relative",
          }}>
            <PitchSVG players={players} names={names} W={W} H={H} />
            {/* Resize grip */}
            <div
              onMouseDown={onResizeDown}
              style={{
                position: "absolute", bottom: 2, right: 2,
                width: 14, height: 14, cursor: "nwse-resize",
                display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <line x1="2" y1="9" x2="9" y2="2" stroke="rgba(212,175,55,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="5" y1="9" x2="9" y2="5" stroke="rgba(212,175,55,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="8" y1="9" x2="9" y2="8" stroke="rgba(212,175,55,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        )}

        {/* Legend strip */}
        {!minimized && (
          <div style={{
            display: "flex", gap: "8px", flexWrap: "wrap",
            background: "rgba(10,10,10,0.88)",
            borderRadius: "0 0 0.6rem 0.6rem",
            padding: "4px 8px",
            border: "1px solid rgba(212,175,55,0.2)",
            borderTop: "none",
          }}>
            {[
              { color: "#3b82f6", label: names?.teams?.["0"] || "T1" },
              { color: "#f43f5e", label: names?.teams?.["1"] || "T2" },
              { color: "#facc15", label: "Ref" },
              { color: "#fff",    label: "Ball" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: "0.6rem", color: "#666" }}>{label}</span>
              </div>
            ))}
            {currentFrame !== undefined && (
              <span style={{ fontSize: "0.55rem", color: "#444", marginLeft: "auto" }}>
                f{currentFrame}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── Standalone (old tab) mode ── */
  const W = 620, H = 380;
  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
          Pitch Radar
        </p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          Player Positions
          {isLive && <span style={{ fontSize: "0.75rem", color: "#22c55e", marginLeft: "0.5rem", fontWeight: 400 }}>● Live Data</span>}
        </h3>
      </div>
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { color: "#3b82f6", label: names?.teams?.["0"] || "Team 1" },
          { color: "#f43f5e", label: names?.teams?.["1"] || "Team 2" },
          { color: "#facc15", label: "Referee" },
          { color: "#ffffff", label: "Ball" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: "0.75rem", color: "#888" }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ width: "100%", overflowX: "auto", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ width: W, height: H }}>
          <PitchSVG players={players} names={names} W={W} H={H} />
        </div>
      </div>
      <p style={{ fontSize: "0.75rem", color: "#444", marginTop: "0.75rem", textAlign: "center" }}>
        {isLive
          ? `${players.filter(p => p.role === "player").length} players · ${players.filter(p => p.team === 0).length} Team 1 · ${players.filter(p => p.team === 1).length} Team 2`
          : "Positions captured at frame 80 — peak danger moment for Team 1"}
      </p>
    </div>
  );
}
