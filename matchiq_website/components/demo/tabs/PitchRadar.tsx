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

/*
 * Fixed viewBox: 1050 × 680 (105m × 68m scaled ×10).
 * All layout is in this coordinate space — W/H props are only used for
 * the outer container size, not for player coordinate mapping.
 * This guarantees the pitch always has the correct 105:68 aspect ratio
 * regardless of how the SVG is scaled by the browser.
 */
const VW = 1050;  // viewBox width  (represents 105 m)
const VH = 680;   // viewBox height (represents 68 m)
const PAD_X = 20; // pitch border padding in viewBox units
const PAD_Y = 14;

/*
 * Vertex positions from SoccerPitchConfiguration (normalized 0–1 over pitch length × width).
 * Indices are 1-based to match the config's edge list.
 */
const PITCH_VERTS: [number, number][] = [
  [0,      0     ], // 1
  [0,      0.2071], // 2
  [0,      0.3691], // 3
  [0,      0.6309], // 4
  [0,      0.7929], // 5
  [0,      1     ], // 6
  [0.0458, 0.3691], // 7
  [0.0458, 0.6309], // 8
  [0.0917, 0.5   ], // 9  (left penalty spot)
  [0.1679, 0.2071], // 10
  [0.1679, 0.3691], // 11
  [0.1679, 0.6309], // 12
  [0.1679, 0.7929], // 13
  [0.5,    0     ], // 14
  [0.5,    0.3693], // 15
  [0.5,    0.6307], // 16
  [0.5,    1     ], // 17
  [0.8321, 0.2071], // 18
  [0.8321, 0.3691], // 19
  [0.8321, 0.6309], // 20
  [0.8321, 0.7929], // 21
  [0.9083, 0.5   ], // 22  (right penalty spot)
  [0.9542, 0.3691], // 23
  [0.9542, 0.6309], // 24
  [1,      0     ], // 25
  [1,      0.2071], // 26
  [1,      0.3691], // 27
  [1,      0.6309], // 28
  [1,      0.7929], // 29
  [1,      1     ], // 30
];

// Edges from SoccerPitchConfiguration.edges (1-based)
const PITCH_EDGES: [number, number][] = [
  [1,2],[2,3],[3,4],[4,5],[5,6],
  [7,8],
  [10,11],[11,12],[12,13],
  [14,15],[15,16],[16,17],
  [18,19],[19,20],[20,21],
  [23,24],
  [25,26],[26,27],[27,28],[28,29],[29,30],
  [1,14],[2,10],[3,7],[4,8],[5,13],[6,17],
  [14,25],[18,26],[23,27],[24,28],[21,29],[17,30],
];

function PitchSVG({ players, names, W }: {
  players: TrackingRow[];
  names?: NamesMap;
  W: number;   // container pixel width — only used for dot sizing
}) {
  const fieldW = VW - PAD_X * 2;
  const fieldH = VH - PAD_Y * 2;
  const r = W < 280 ? 14 : 18;

  // Convert normalized pitch vertex to viewBox coords
  const vx = (nx: number) => PAD_X + nx * fieldW;
  const vy = (ny: number) => PAD_Y + ny * fieldH;

  // Centre circle radius: 9.15m / 105m * fieldW
  const ccR = (9.15 / 105) * fieldW;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={VW} height={VH} fill="#052e16" rx="6" />
      <g stroke="#166534" strokeWidth="3" fill="none">
        {/* Pitch lines from SoccerPitchConfiguration edges */}
        {PITCH_EDGES.map(([a, b], i) => (
          <line key={i}
            x1={vx(PITCH_VERTS[a-1][0])} y1={vy(PITCH_VERTS[a-1][1])}
            x2={vx(PITCH_VERTS[b-1][0])} y2={vy(PITCH_VERTS[b-1][1])}
          />
        ))}
        {/* Centre circle */}
        <circle cx={vx(0.5)} cy={vy(0.5)} r={ccR} />
        {/* Centre spot */}
        <circle cx={vx(0.5)} cy={vy(0.5)} r={5} fill="#166534" stroke="#166534" />
        {/* Penalty spots (vertices 9 and 22) */}
        <circle cx={vx(PITCH_VERTS[8][0])}  cy={vy(PITCH_VERTS[8][1])}  r={5} fill="#166534" stroke="none" />
        <circle cx={vx(PITCH_VERTS[21][0])} cy={vy(PITCH_VERTS[21][1])} r={5} fill="#166534" stroke="none" />
        {/* Goals (extending beyond the pitch boundary) */}
        <rect x={PAD_X - 18} y={vy(0.3691)} width={18} height={vy(0.6309) - vy(0.3691)} stroke="#166534" fill="rgba(255,255,255,0.05)" />
        <rect x={vx(1)}      y={vy(0.3691)} width={18} height={vy(0.6309) - vy(0.3691)} stroke="#166534" fill="rgba(255,255,255,0.05)" />
      </g>
      {players.map((p, idx) => {
        // p.x and p.y are 0–100 percentages of the actual pitch area
        const cx = PAD_X + (fieldW * p.x) / 100;
        const cy = PAD_Y + (fieldH * p.y) / 100;

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
            <circle cx={cx} cy={cy} r={r} fill="#facc15" stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
            <text x={cx} y={cy + r * 0.45} textAnchor="middle" fontSize={r * 1.1} fontWeight="900" fill="#000">R</text>
          </g>
        );

        const color    = playerColor(p.team);
        const assigned = names?.players?.[String(p.id)];
        const label    = assigned ? assigned.slice(0, 3) : (p.id > 0 ? String(p.id) : "?");

        return (
          <g key={`p-${p.id}-${idx}`}>
            <circle cx={cx} cy={cy} r={r * 1.5} fill={color} opacity={0.18} />
            <circle cx={cx} cy={cy} r={r} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
            {W >= 280 && (
              <text x={cx} y={cy + r * 0.45} textAnchor="middle" fontSize={r * 1.1} fontWeight="900" fill="white">
                {label}
              </text>
            )}
          </g>
        );
      })}
      <defs>
        <filter id="bGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
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
            <PitchSVG players={players} names={names} W={W} />
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
  const W = 620;
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
        <div style={{ width: W, aspectRatio: "105 / 68" }}>
          <PitchSVG players={players} names={names} W={W} />
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
