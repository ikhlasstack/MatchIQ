"use client";

import { PITCH_PLAYERS } from "@/lib/mockData";

const TEAM_COLORS: Record<number, string> = { 0: "#3b82f6", 1: "#f43f5e" };

function playerColor(team: number) {
  return TEAM_COLORS[team] ?? "#facc15";
}

export default function PitchRadar() {
  const W = 620, H = 380;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
          Pitch Radar
        </p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Live Player Positions</h3>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { color: "#3b82f6", label: "Team 0" },
          { color: "#f43f5e", label: "Team 1" },
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
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ maxWidth: "100%", display: "block", borderRadius: "0.75rem" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pitch background */}
          <rect width={W} height={H} fill="#052e16" rx="8" />

          {/* Pitch markings */}
          <g stroke="#166534" strokeWidth="1.5" fill="none">
            {/* Outer boundary */}
            <rect x="30" y="20" width={W-60} height={H-40} rx="3" />
            {/* Centre line */}
            <line x1={W/2} y1="20" x2={W/2} y2={H-20} />
            {/* Centre circle */}
            <circle cx={W/2} cy={H/2} r="52" />
            <circle cx={W/2} cy={H/2} r="3" fill="#166534" />
            {/* Left penalty box */}
            <rect x="30" y={H/2 - 70} width="100" height="140" />
            {/* Left goal box */}
            <rect x="30" y={H/2 - 30} width="40" height="60" />
            {/* Left penalty spot */}
            <circle cx="100" cy={H/2} r="3" fill="#166534" />
            {/* Right penalty box */}
            <rect x={W-130} y={H/2 - 70} width="100" height="140" />
            {/* Right goal box */}
            <rect x={W-70} y={H/2 - 30} width="40" height="60" />
            {/* Right penalty spot */}
            <circle cx={W-100} cy={H/2} r="3" fill="#166534" />
          </g>

          {/* Players */}
          {PITCH_PLAYERS.map(p => {
            const cx = 30 + ((W - 60) * p.x) / 100;
            const cy = 20 + ((H - 40) * p.y) / 100;

            if (p.role === "ball") {
              /* Ball — white diamond */
              return (
                <g key={p.id}>
                  <polygon
                    points={`${cx},${cy-8} ${cx+8},${cy} ${cx},${cy+8} ${cx-8},${cy}`}
                    fill="white"
                    filter="url(#ballGlow)"
                  />
                </g>
              );
            }

            const color = playerColor(p.team);
            return (
              <g key={p.id}>
                {/* Glow ring */}
                <circle cx={cx} cy={cy} r="10"
                  fill={color} opacity={0.2} />
                {/* Dot */}
                <circle cx={cx} cy={cy} r="6.5"
                  fill={color}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth="1.5" />
                {/* Player number */}
                <text x={cx} y={cy + 4}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="900"
                  fill="white">
                  {p.id <= 11 ? p.id : p.id - 11}
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
        Positions captured at frame 80 — peak danger moment for Team 0
      </p>
    </div>
  );
}
