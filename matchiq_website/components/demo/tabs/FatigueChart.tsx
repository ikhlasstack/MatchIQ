"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList,
} from "recharts";
import { useState } from "react";
import { FATIGUE_DATA } from "@/lib/mockData";
import type { FatigueRow } from "../DemoClient";
import type { NamesMap } from "../PlayerNamingModal";

/* Handles both real pipeline labels (LOW/MEDIUM/HIGH)
   and mock labels (LOW/MODERATE/HIGH/CRITICAL) */
function fatigueColor(level: string): string {
  switch (level.toUpperCase()) {
    case "LOW":      return "#22c55e";
    case "MEDIUM":
    case "MODERATE": return "#eab308";
    case "HIGH":     return "#f97316";
    case "CRITICAL": return "#ef4444";
    default:         return "#888888";
  }
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "1rem" }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 56, height: 12, borderRadius: 4, background: "#1a1a1a" }} />
          <div style={{ flex: 1, height: 12, borderRadius: 4, background: "#1a1a1a", opacity: 0.6 - i * 0.05 }} />
        </div>
      ))}
    </div>
  );
}

export default function FatigueChart({ data, names }: { data: FatigueRow[] | null; names?: NamesMap }) {
  const [teamFilter, setTeamFilter] = useState<"all" | 0 | 1>("all");

  /* Use real API data when available, fall back to mock */
  const source: FatigueRow[] = data ?? FATIGUE_DATA;

  /* Apply player name overrides */
  const resolvedSource = source.map(row => {
    const rawId = row.label.replace(/\D/g, "");
    const name  = names?.players?.[rawId];
    const tName = names?.teams?.[String(row.team)];
    return {
      ...row,
      label: name ? name : row.label,
      _teamLabel: tName,
    };
  });

  const chartData = (
    teamFilter === "all" ? resolvedSource : resolvedSource.filter(d => d.team === teamFilter)
  ).slice().reverse();

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
            Player Fatigue
          </p>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
            Fatigue Score by Player
            {data && <span style={{ fontSize: "0.75rem", color: "#22c55e", marginLeft: "0.5rem", fontWeight: 400 }}>● Live Data</span>}
          </h3>
        </div>
        {/* Team filter */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["all", 0, 1] as const).map(t => (
            <button key={String(t)} onClick={() => setTeamFilter(t)}
              style={{
                padding: "4px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                border:     teamFilter === t ? "1px solid #D4AF37" : "1px solid #2a2a2a",
                background: teamFilter === t ? "rgba(212,175,55,0.12)" : "transparent",
                color:      teamFilter === t ? "#D4AF37" : "#888",
              }}>
              {t === "all" ? "All" : (names?.teams?.[String(t)] || `Team ${(t as number) + 1}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[["LOW", "#22c55e"], ["MEDIUM", "#eab308"], ["HIGH", "#f97316"], ["CRITICAL", "#ef4444"]].map(([l, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: "0.75rem", color: "#888" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Chart or skeleton */}
      {data === null ? (
        <Skeleton />
      ) : chartData.length === 0 ? (
        <p style={{ color: "#555", fontSize: "0.85rem", textAlign: "center", paddingTop: "3rem" }}>
          No fatigue data available
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 36 + 20)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }}
              tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: "#aaa", fontSize: 12 }} width={50}
              axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "0.5rem", fontSize: "0.8rem" }}
              formatter={(v) => [`${Number(v)}%`, "Fatigue"]}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={fatigueColor(entry.level)} />
              ))}
              <LabelList dataKey="score" position="right" formatter={(v) => `${Number(v)}%`}
                style={{ fill: "#888", fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
