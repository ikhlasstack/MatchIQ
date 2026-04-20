"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { MATCH_OUTCOME } from "@/lib/mockData";
import type { OutcomeData } from "../DemoClient";

function DonutGauge({ value, color, label }: { value: number; color: string; label: string }) {
  const data = [{ value }, { value: Math.max(0, 100 - value) }];
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 140, height: 140, margin: "0 auto", position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={46} outerRadius={60}
              startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
              <Cell fill={color} />
              <Cell fill="#1a1a1a" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Centered value inside the ring */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 900, color }}>{value}%</span>
        </div>
      </div>
      <p style={{ fontSize: "0.82rem", color: "#888", marginTop: "0.6rem" }}>{label}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center", paddingTop: "2rem" }}>
      <div style={{ display: "flex", gap: "2rem" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 120, height: 120, borderRadius: "50%", background: "#1a1a1a" }} />
        ))}
      </div>
      <div style={{ width: "100%", height: 10, borderRadius: 5, background: "#1a1a1a" }} />
      <div style={{ width: "100%", height: 120, borderRadius: 8, background: "#1a1a1a" }} />
    </div>
  );
}

export default function MatchOutcomeChart({ data }: { data: OutcomeData | null }) {
  /* Use real data if available, else fall back to mock */
  const d: OutcomeData = data ?? {
    winA:       MATCH_OUTCOME.winA,
    draw:       MATCH_OUTCOME.draw,
    winB:       MATCH_OUTCOME.winB,
    possession: MATCH_OUTCOME.possession,
    shots:      MATCH_OUTCOME.shots,
    territory:  MATCH_OUTCOME.territory,
    momentum:   MATCH_OUTCOME.momentum,
  };

  const statRows = [
    { label: "Possession",     t0: `${d.possession.t0}%`, t1: `${d.possession.t1}%`, t0v: d.possession.t0, t1v: d.possession.t1 },
    { label: "Shots on Target",t0: String(d.shots.t0),    t1: String(d.shots.t1),    t0v: d.shots.t0,      t1v: d.shots.t1 },
    { label: "Territory",      t0: `${d.territory.t0}%`,  t1: `${d.territory.t1}%`,  t0v: d.territory.t0,  t1v: d.territory.t1 },
    { label: "Momentum",       t0: `${d.momentum.t0}%`,   t1: `${d.momentum.t1}%`,   t0v: d.momentum.t0,   t1v: d.momentum.t1 },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.25rem" }}>
          Match Outcome
        </p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          Win Probability Distribution
          {data && <span style={{ fontSize: "0.75rem", color: "#22c55e", marginLeft: "0.5rem", fontWeight: 400 }}>● Live Data</span>}
        </h3>
      </div>

      {data === null ? (
        <Skeleton />
      ) : (
        <>
          {/* Three gauges */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
            <DonutGauge value={d.winA} color="#3b82f6" label="Team 1 Win" />
            <DonutGauge value={d.draw} color="#6b7280" label="Draw"       />
            <DonutGauge value={d.winB} color="#f43f5e" label="Team 2 Win" />
          </div>

          {/* Win probability bar */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", height: "10px", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{ width: `${d.winA}%`, background: "linear-gradient(90deg,#1d4ed8,#3b82f6)", transition: "width 0.6s" }} />
              <div style={{ width: `${d.draw}%`, background: "#374151",                                 transition: "width 0.6s" }} />
              <div style={{ width: `${d.winB}%`, background: "linear-gradient(90deg,#be123c,#f43f5e)", transition: "width 0.6s" }} />
            </div>
          </div>

          {/* Stats table */}
          <div style={{ borderRadius: "0.75rem", overflow: "hidden", border: "1px solid #2a2a2a" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "#1a1a1a" }}>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#555", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Metric</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#3b82f6", fontWeight: 700, fontSize: "0.75rem" }}>Team 1</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#f43f5e", fontWeight: 700, fontSize: "0.75rem" }}>Team 2</th>
                </tr>
              </thead>
              <tbody>
                {statRows.map(({ label, t0, t1, t0v, t1v }, i) => (
                  <tr key={label} style={{ borderTop: "1px solid #1a1a1a", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "0.75rem 1rem", color: "#aaa" }}>{label}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: t0v > t1v ? "#3b82f6" : "#666", fontWeight: t0v > t1v ? 700 : 400 }}>{t0}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: t1v > t0v ? "#f43f5e" : "#666", fontWeight: t1v > t0v ? 700 : 400 }}>{t1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
