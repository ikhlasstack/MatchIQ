"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { GOAL_PROB_DATA } from "@/lib/mockData";

export default function GoalProbChart() {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
          Goal Probability
        </p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Threat Level Over Time</h3>
        <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.25rem" }}>
          xG-style probability per frame — peaks indicate high-danger moments
        </p>
      </div>

      {/* Insight pills */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ padding: "4px 12px", borderRadius: "6px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", fontSize: "0.78rem", color: "#60a5fa" }}>
          Team 0 peak: 0.73 @ frame 80
        </div>
        <div style={{ padding: "4px 12px", borderRadius: "6px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", fontSize: "0.78rem", color: "#fb7185" }}>
          Team 1 peak: 0.67 @ frame 120
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={GOAL_PROB_DATA} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
          <XAxis dataKey="frame" tick={{ fill: "#555", fontSize: 11 }}
            label={{ value: "Frame", position: "insideBottomRight", offset: -5, fill: "#555", fontSize: 11 }}
            axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} tick={{ fill: "#555", fontSize: 11 }}
            tickFormatter={v => `${Math.round(v * 100)}%`} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "0.5rem", fontSize: "0.8rem" }}
            formatter={(v: number, name: string) => [`${(v * 100).toFixed(0)}%`, name === "t0" ? "Team 0" : "Team 1"]}
            labelFormatter={l => `Frame ${l}`}
          />
          <Legend formatter={v => v === "t0" ? "Team 0" : "Team 1"}
            wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }} />
          <ReferenceLine y={0.5} stroke="#D4AF37" strokeDasharray="4 4" strokeOpacity={0.4}
            label={{ value: "High risk (50%)", fill: "#D4AF37", fontSize: 10, position: "right" }} />
          <Line dataKey="t0" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="t0"
            activeDot={{ r: 5, fill: "#3b82f6" }} />
          <Line dataKey="t1" stroke="#f43f5e" strokeWidth={2.5} dot={false} name="t1"
            activeDot={{ r: 5, fill: "#f43f5e" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
