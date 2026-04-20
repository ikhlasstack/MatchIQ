"use client";

import { PITCH_PLAYERS } from "@/lib/mockData";
import type { TrackingRow } from "../DemoClient";
import type { NamesMap } from "../PlayerNamingModal";

const TEAM_COLORS: Record<number, string> = { 0: "#3b82f6", 1: "#f43f5e" };
function playerColor(team: number) { return TEAM_COLORS[team] ?? "#facc15"; }

export default function PitchRadar({ data, names }: { data: TrackingRow[] | null; names?: NamesMap }) {
  /* Use real tracking data if available, else mock */
  const players = data ?? PITCH_PLAYERS;
  const isLive  = data !== null;

  const W = 620, H = 380;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
          Pitch Radar
        </p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          {isLive ? "Last Tracked Frame — Player Positions" : "Live Player Positions"}
          {isLive && <span style={{ fontSize: "0.75rem", color: "#22c55e", marginLeft: "0.5rem", fontWeight: 400 }}>● Live Data</span>}
        </h3>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { color: "#3b82f6", label: names?.teams?.["0"] || "Team 1"  },
          { color: "#f43f5e", label: names?.teams?.["1"] || "Team 2"  },
          { color: "#facc15", label: "Referee" },
          { color: "#ffffff", label: "Ball"    },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: "0.75rem", color: "#888" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Pitch SVG */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%", display: "block", borderRadius: "0.75rem" }} xmlns="http://www.w3.org/2000/svg">
          {/* Background */}
          <rect width={W} height={H} fill="#052e16" rx="8" />

          {/* Pitch markings */}
          <g stroke="#166534" strokeWidth="1.5" fill="none">
            <rect x="30" y="20" width={W - 60} height={H - 40} rx="3" />
            <line x1={W / 2} y1="20" x2={W / 2} y2={H - 20} />
            <circle cx={W / 2} cy={H / 2} r="52" />
            <circle cx={W / 2} cy={H / 2} r="3" fill="#166534" />
            <rect x="30"       y={H / 2 - 70} width="100" height="140" />
            <rect x="30"       y={H / 2 - 30} width="40"  height="60"  />
            <circle cx="100" cy={H / 2} r="3" fill="#166534" />
            <rect x={W - 130}  y={H / 2 - 70} width="100" height="140" />
            <rect x={W - 70}   y={H / 2 - 30} width="40"  height="60"  />
            <circle cx={W - 100} cy={H / 2} r="3" fill="#166534" />
          </g>

          {/* Players */}
          {players.map((p, idx) => {
            /* x, y are 0-100 percentages */
            const cx = 30 + ((W - 60) * p.x) / 100;
            const cy = 20 + ((H - 40) * p.y) / 100;

            if (p.role === "ball") {
              return (
                <g key={`ball-${idx}`}>
                  <polygon
                    points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
                    fill="white"
                    filter="url(#ballGlow)"
                  />
                </g>
              );
            }

            if (p.role === "referee") {
              return (
                <g key={`ref-${idx}`}>
                  <circle cx={cx} cy={cy} r="6" fill="#facc15" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7" fontWeight="900" fill="#000">R</text>
                </g>
              );
            }

            const color    = playerColor(p.team);
            const assigned = names?.players?.[String(p.id)];
            /* Show first 3 chars of assigned name, else numeric ID */
            const label    = assigned ? assigned.slice(0, 3) : (p.id > 0 ? String(p.id <= 11 ? p.id : p.id - 11) : "?");

            return (
              <g key={`p-${p.id}-${idx}`}>
                <circle cx={cx} cy={cy} r="10" fill={color} opacity={0.2} />
                <circle cx={cx} cy={cy} r="6.5" fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7" fontWeight="900" fill="white">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Filters */}
          <defs>
            <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
        </svg>
      </div>

      <p style={{ fontSize: "0.75rem", color: "#444", marginTop: "0.75rem", textAlign: "center" }}>
        {isLive
          ? `${players.filter(p => p.role === "player").length} players tracked · ${players.filter(p => p.team === 0).length} Team 1 · ${players.filter(p => p.team === 1).length} Team 2`
          : "Positions captured at frame 80 — peak danger moment for Team 1"}
      </p>
    </div>
  );
}
