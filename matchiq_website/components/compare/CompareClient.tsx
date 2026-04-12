"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { COMPARE_MATCHES } from "@/lib/mockData";

const GOLD = "#D4AF37";
const T0   = "#3b82f6";
const T1   = "#f43f5e";

type Match = typeof COMPARE_MATCHES[number];

function better(a: number, b: number, higherBetter = true) {
  return higherBetter ? a > b : a < b;
}

function CompareRow({ label, a, b, unit = "", higherBetter = true }: {
  label: string; a: number; b: number; unit?: string; higherBetter?: boolean;
}) {
  const aWins = better(a, b, higherBetter);
  const bWins = better(b, a, higherBetter);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "1rem", alignItems: "center", padding: "0.85rem 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "1.15rem", fontWeight: 900, color: aWins ? GOLD : "#fff" }}>
          {a}{unit}
        </span>
        {aWins && <span style={{ marginLeft: 4, fontSize: "0.65rem", color: GOLD }}>★</span>}
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>{label}</p>
        <div style={{ height: 5, borderRadius: 3, display: "flex", overflow: "hidden", background: "#1a1a1a" }}>
          <div style={{ flex: a, background: `${GOLD}88`, transition: "flex 0.6s" }} />
          <div style={{ flex: b, background: "#2a2a2a",   transition: "flex 0.6s" }} />
        </div>
      </div>
      <div>
        {bWins && <span style={{ marginRight: 4, fontSize: "0.65rem", color: GOLD }}>★</span>}
        <span style={{ fontSize: "1.15rem", fontWeight: 900, color: bWins ? GOLD : "#fff" }}>
          {b}{unit}
        </span>
      </div>
    </div>
  );
}

function MatchSelector({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#888", fontWeight: 600, marginBottom: "0.5rem" }}>{label}</label>
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: "0.75rem", padding: "0.65rem 1rem", fontSize: "0.9rem", cursor: "pointer", outline: "none" }}>
        {COMPARE_MATCHES.map((m, i) => <option key={i} value={i}>{m.name}</option>)}
      </select>
    </div>
  );
}

export default function CompareClient() {
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(1);
  const mA = COMPARE_MATCHES[idxA];
  const mB = COMPARE_MATCHES[idxB];

  /* Build possession bar data */
  const possessionData = [
    { label: "Possession", matchA_T0: mA.possession.t0, matchA_T1: mA.possession.t1, matchB_T0: mB.possession.t0, matchB_T1: mB.possession.t1 },
    { label: "Territory",  matchA_T0: mA.territory.t0,  matchA_T1: mA.territory.t1,  matchB_T0: mB.territory.t0,  matchB_T1: mB.territory.t1  },
    { label: "Momentum",   matchA_T0: mA.momentum.t0,   matchA_T1: mA.momentum.t1,   matchB_T0: mB.momentum.t0,   matchB_T1: mB.momentum.t1   },
  ];

  /* Merge fatigue series on minute key */
  const fatigueMerged = mA.fatigueSeries.map((pt, i) => ({
    minute:  pt.minute,
    A_T0:    pt.t0,
    A_T1:    pt.t1,
    B_T0:    mB.fatigueSeries[i]?.t0 ?? 0,
    B_T1:    mB.fatigueSeries[i]?.t1 ?? 0,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.14em", color: GOLD, fontWeight: 600, marginBottom: "0.4rem" }}>Comparison</p>
          <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            Match <span style={{ color: GOLD }}>Comparison</span>
          </h1>
          <p style={{ color: "#888", fontSize: "0.9rem" }}>Select two matches to compare performance side by side</p>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "3rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

        {/* Match selectors */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, fontWeight: 600, marginBottom: "1.25rem" }}>Select Matches</p>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <MatchSelector label="Match A" value={idxA} onChange={v => { if (v !== idxB) setIdxA(v); }} />
            <div style={{ padding: "0.65rem", color: "#555", fontWeight: 900, fontSize: "1.2rem", flexShrink: 0 }}>vs</div>
            <MatchSelector label="Match B" value={idxB} onChange={v => { if (v !== idxA) setIdxB(v); }} />
          </div>
        </motion.div>

        {/* Stats comparison table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "1rem", marginBottom: "0.5rem" }}>
            <div style={{ textAlign: "right", fontSize: "0.85rem", fontWeight: 700, color: T0 }}>{mA.name}</div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "0.7rem", color: GOLD, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
                Stats — ★ = Winner
              </p>
            </div>
            <div style={{ textAlign: "left", fontSize: "0.85rem", fontWeight: 700, color: T1 }}>{mB.name}</div>
          </div>
          <CompareRow label="Possession T0"  a={mA.possession.t0}  b={mB.possession.t0}  unit="%" />
          <CompareRow label="Shots T0"       a={mA.shots.t0}       b={mB.shots.t0} />
          <CompareRow label="Territory T0"   a={mA.territory.t0}   b={mB.territory.t0}   unit="%" />
          <CompareRow label="Momentum T0"    a={mA.momentum.t0}    b={mB.momentum.t0}    unit="%" />
          <CompareRow label="Avg Fatigue T0" a={mA.avgFatigue.t0}  b={mB.avgFatigue.t0}  unit="%" higherBetter={false} />
          <CompareRow label="Pass Acc T0"    a={mA.passAcc.t0}     b={mB.passAcc.t0}     unit="%" />
        </motion.div>

        {/* Fatigue overlay line chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, fontWeight: 600, marginBottom: "0.25rem" }}>Fatigue</p>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.25rem" }}>Cumulative Fatigue Comparison</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={fatigueMerged} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="minute" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                label={{ value: "Minute", position: "insideBottomRight", offset: -5, fill: "#444", fontSize: 11 }} />
              <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.78rem" }}
                formatter={(v, name) => [`${Number(v)}%`, String(name)]} />
              <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.5rem" }} />
              <Line dataKey="A_T0" name={`${mA.name} · T0`} stroke={T0}   strokeWidth={2} dot={false} strokeDasharray="0" />
              <Line dataKey="A_T1" name={`${mA.name} · T1`} stroke={T0}   strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              <Line dataKey="B_T0" name={`${mB.name} · T0`} stroke={T1}   strokeWidth={2} dot={false} />
              <Line dataKey="B_T1" name={`${mB.name} · T1`} stroke={T1}   strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Possession grouped bar */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, fontWeight: 600, marginBottom: "0.25rem" }}>Possession &amp; Control</p>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.25rem" }}>Match A vs Match B — Team 0 Side</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={possessionData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.78rem" }}
                formatter={(v, name) => [`${Number(v)}%`, String(name)]} />
              <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.5rem" }} />
              <Bar dataKey="matchA_T0" name={`${mA.name}`} fill={T0} radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="matchB_T0" name={`${mB.name}`} fill={T1} radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

      </div>
    </div>
  );
}
