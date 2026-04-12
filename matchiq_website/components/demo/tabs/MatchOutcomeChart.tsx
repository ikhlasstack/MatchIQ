"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { MATCH_OUTCOME } from "@/lib/mockData";

const OUTCOME_DATA = [
  { name: "Team 0 Win", value: MATCH_OUTCOME.winA,  color: "#3b82f6" },
  { name: "Draw",       value: MATCH_OUTCOME.draw,  color: "#4b5563" },
  { name: "Team 1 Win", value: MATCH_OUTCOME.winB,  color: "#f43f5e" },
];

const STAT_ROWS = [
  { label: "Possession",  t0: `${MATCH_OUTCOME.possession.t0}%`, t1: `${MATCH_OUTCOME.possession.t1}%`, t0v: MATCH_OUTCOME.possession.t0, t1v: MATCH_OUTCOME.possession.t1 },
  { label: "Shots on Target", t0: String(MATCH_OUTCOME.shots.t0), t1: String(MATCH_OUTCOME.shots.t1), t0v: MATCH_OUTCOME.shots.t0, t1v: MATCH_OUTCOME.shots.t1 },
  { label: "Territory",   t0: `${MATCH_OUTCOME.territory.t0}%`,  t1: `${MATCH_OUTCOME.territory.t1}%`,  t0v: MATCH_OUTCOME.territory.t0,  t1v: MATCH_OUTCOME.territory.t1  },
  { label: "Momentum",    t0: `${MATCH_OUTCOME.momentum.t0}%`,   t1: `${MATCH_OUTCOME.momentum.t1}%`,   t0v: MATCH_OUTCOME.momentum.t0,   t1v: MATCH_OUTCOME.momentum.t1   },
];

function DonutGauge({ value, color, label }: { value: number; color: string; label: string }) {
  const data = [{ value }, { value: 100 - value }];
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 120, height: 120, margin: "0 auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={55}
              startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
              <Cell fill={color} />
              <Cell fill="#1a1a1a" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: "1.5rem", fontWeight: 900, color, marginTop: "-1.25rem" }}>{value}%</p>
      <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.25rem" }}>{label}</p>
    </div>
  );
}

export default function MatchOutcomeChart() {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
          Match Outcome
        </p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Win Probability Distribution</h3>
      </div>

      {/* Three gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2rem", marginBottom: "2.5rem" }}>
        <DonutGauge value={MATCH_OUTCOME.winA}  color="#3b82f6" label="Team 0 Win" />
        <DonutGauge value={MATCH_OUTCOME.draw}  color="#6b7280" label="Draw"       />
        <DonutGauge value={MATCH_OUTCOME.winB}  color="#f43f5e" label="Team 1 Win" />
      </div>

      {/* Win-bar */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", height: "10px", borderRadius: "5px", overflow: "hidden" }}>
          <div style={{ width: `${MATCH_OUTCOME.winA}%`, background: "linear-gradient(90deg, #1d4ed8, #3b82f6)" }} />
          <div style={{ width: `${MATCH_OUTCOME.draw}%`,  background: "#374151" }} />
          <div style={{ width: `${MATCH_OUTCOME.winB}%`, background: "linear-gradient(90deg, #be123c, #f43f5e)" }} />
        </div>
      </div>

      {/* Stats table */}
      <div style={{ borderRadius: "0.75rem", overflow: "hidden", border: "1px solid #2a2a2a" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "#1a1a1a" }}>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#555", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Metric</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#3b82f6", fontWeight: 700, fontSize: "0.75rem" }}>Team 0</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#f43f5e", fontWeight: 700, fontSize: "0.75rem" }}>Team 1</th>
            </tr>
          </thead>
          <tbody>
            {STAT_ROWS.map(({ label, t0, t1, t0v, t1v }, i) => (
              <tr key={label} style={{ borderTop: "1px solid #1a1a1a", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <td style={{ padding: "0.75rem 1rem", color: "#aaa" }}>{label}</td>
                <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: t0v > t1v ? "#3b82f6" : "#666", fontWeight: t0v > t1v ? 700 : 400 }}>{t0}</td>
                <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: t1v > t0v ? "#f43f5e" : "#666", fontWeight: t1v > t0v ? 700 : 400 }}>{t1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
