"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList,
} from "recharts";
import { useState } from "react";
import { FATIGUE_DATA, fatigueColor } from "@/lib/mockData";

export default function FatigueChart() {
  const [teamFilter, setTeamFilter] = useState<"all" | 0 | 1>("all");

  const data = (teamFilter === "all"
    ? FATIGUE_DATA
    : FATIGUE_DATA.filter(d => d.team === teamFilter)
  ).slice().reverse();

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
            Player Fatigue
          </p>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Fatigue Score by Player</h3>
        </div>
        {/* Team filter */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["all", 0, 1] as const).map(t => (
            <button key={String(t)}
              onClick={() => setTeamFilter(t)}
              style={{
                padding: "4px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                border: teamFilter === t ? "1px solid #D4AF37" : "1px solid #2a2a2a",
                background: teamFilter === t ? "rgba(212,175,55,0.12)" : "transparent",
                color: teamFilter === t ? "#D4AF37" : "#888",
              }}>
              {t === "all" ? "All" : `Team ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[["LOW","#22c55e"],["MODERATE","#eab308"],["HIGH","#f97316"],["CRITICAL","#ef4444"]].map(([l,c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: "0.75rem", color: "#888" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }}
            tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fill: "#aaa", fontSize: 12 }} width={80}
            axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "0.5rem", fontSize: "0.8rem" }}
            formatter={(v: number) => [`${v}%`, "Fatigue"]}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((entry, i) => (
              <Cell key={i} fill={fatigueColor(entry.level)} />
            ))}
            <LabelList dataKey="score" position="right" formatter={(v: number) => `${v}%`}
              style={{ fill: "#888", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
