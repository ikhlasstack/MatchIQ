"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { GOAL_PROB_DATA } from "@/lib/mockData";
import type { GoalProbRow } from "../DemoClient";
import type { NamesMap } from "../PlayerNamingModal";

function Skeleton() {
  return (
    <div style={{ width: "100%", height: 300, background: "#111", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#333", fontSize: "0.85rem" }}>Awaiting pipeline results…</p>
    </div>
  );
}

export default function GoalProbChart({ data, names }: { data: GoalProbRow[] | null; names?: NamesMap }) {
  const source = data ?? GOAL_PROB_DATA;
  const t1Name = names?.teams?.["0"] || "Team 1";
  const t2Name = names?.teams?.["1"] || "Team 2";

  /* Compute peaks from whichever data source we're using */
  const t0Peak = source.reduce((a, b) => b.t0 > a.t0 ? b : a, source[0] ?? { t0: 0, t1: 0, frame: 0 });
  const t1Peak = source.reduce((a, b) => b.t1 > a.t1 ? b : a, source[0] ?? { t0: 0, t1: 0, frame: 0 });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
          Goal Probability
        </p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          Threat Level Over Time
          {data && <span style={{ fontSize: "0.75rem", color: "#22c55e", marginLeft: "0.5rem", fontWeight: 400 }}>● Live Data</span>}
        </h3>
        <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.25rem" }}>
          xG-style probability per frame — peaks indicate high-danger moments
        </p>
      </div>

      {/* Insight pills — computed dynamically */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ padding: "4px 12px", borderRadius: "6px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", fontSize: "0.78rem", color: "#60a5fa" }}>
          {t1Name} peak: {t0Peak.t0.toFixed(2)} @ frame {t0Peak.frame}
        </div>
        <div style={{ padding: "4px 12px", borderRadius: "6px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", fontSize: "0.78rem", color: "#fb7185" }}>
          {t2Name} peak: {t1Peak.t1.toFixed(2)} @ frame {t1Peak.frame}
        </div>
      </div>

      {data === null ? (
        <Skeleton />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={source} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis dataKey="frame" tick={{ fill: "#555", fontSize: 11 }}
              label={{ value: "Frame", position: "insideBottomRight", offset: -5, fill: "#555", fontSize: 11 }}
              axisLine={false} tickLine={false} />
            <YAxis domain={[0, 1]} tick={{ fill: "#555", fontSize: 11 }}
              tickFormatter={v => `${Math.round(Number(v) * 100)}%`} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "0.5rem", fontSize: "0.8rem" }}
              formatter={(v, name) => [`${(Number(v) * 100).toFixed(0)}%`, String(name) === "t0" ? t1Name : t2Name]}
              labelFormatter={l => `Frame ${l}`}
            />
            <Legend formatter={v => v === "t0" ? t1Name : t2Name}
              wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }} />
            <ReferenceLine y={0.5} stroke="#D4AF37" strokeDasharray="4 4" strokeOpacity={0.4}
              label={{ value: "High risk (50%)", fill: "#D4AF37", fontSize: 10, position: "right" }} />
            <Line dataKey="t0" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="t0"
              activeDot={{ r: 5, fill: "#3b82f6" }} />
            <Line dataKey="t1" stroke="#f43f5e" strokeWidth={2.5} dot={false} name="t1"
              activeDot={{ r: 5, fill: "#f43f5e" }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
