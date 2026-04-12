"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell,
} from "recharts";
import {
  TEAM_RADAR, TEAM_STATS_FULL, POSSESSION_TIMELINE,
  MOMENTUM_TIMELINE, MATCHES_LIST,
} from "@/lib/mockData";

/* ── palette ─────────────────────────────────────────────── */
const T0  = "#3b82f6";
const T1  = "#f43f5e";
const GOLD = "#D4AF37";

/* ── Stat row in the comparison table ─────────────────────── */
function StatRow({
  label, v0, v1, unit = "", higherBetter = true,
}: {
  label: string; v0: number; v1: number; unit?: string; higherBetter?: boolean;
}) {
  const t0Wins = higherBetter ? v0 > v1 : v0 < v1;
  const t1Wins = higherBetter ? v1 > v0 : v1 < v0;
  const pct0   = Math.round((v0 / (v0 + v1)) * 100);
  const pct1   = 100 - pct0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "center", padding: "0.9rem 0", borderBottom: "1px solid #1a1a1a" }}>
      {/* Team 0 value */}
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "1.25rem", fontWeight: 900, color: t0Wins ? T0 : "#fff" }}>
          {v0}{unit}
        </span>
        {t0Wins && <sup style={{ fontSize: "0.65rem", color: T0, marginLeft: 3 }}>▲</sup>}
      </div>

      {/* Label + bar */}
      <div style={{ textAlign: "center", minWidth: "120px" }}>
        <p style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>
          {label}
        </p>
        <div style={{ height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
          <div style={{ width: `${pct0}%`, background: T0, transition: "width 0.6s" }} />
          <div style={{ width: `${pct1}%`, background: T1, transition: "width 0.6s" }} />
        </div>
      </div>

      {/* Team 1 value */}
      <div style={{ textAlign: "left" }}>
        {t1Wins && <sup style={{ fontSize: "0.65rem", color: T1, marginRight: 3 }}>▲</sup>}
        <span style={{ fontSize: "1.25rem", fontWeight: 900, color: t1Wins ? T1 : "#fff" }}>
          {v1}{unit}
        </span>
      </div>
    </div>
  );
}

/* ── Team header card ─────────────────────────────────────── */
function TeamHeader({ team, stats }: { team: 0 | 1; stats: typeof TEAM_STATS_FULL.t0 }) {
  const color  = team === 0 ? T0 : T1;
  const label  = `Team ${team}`;
  const wins   = team === 0 ? stats.possession > 50 : stats.possession < 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: team * 0.15, duration: 0.5 }}
      style={{
        background: `${color}0d`,
        border: `1px solid ${color}33`,
        borderRadius: "1rem",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: `${color}22`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem", fontSize: "1rem", fontWeight: 900, color }}>
        T{team}
      </div>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>{label}</h2>
      {wins && (
        <span style={{ display: "inline-block", marginTop: "0.4rem", padding: "2px 10px", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, background: `${color}22`, border: `1px solid ${color}55`, color }}>
          DOMINANT
        </span>
      )}
      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "1rem" }}>
        {[
          ["Possession", `${stats.possession}%`],
          ["Shots",      stats.shots],
          ["Pass Acc.",  `${stats.passAcc}%`],
          ["Fatigue",    `${stats.avgFatigue}%`],
        ].map(([k, v]) => (
          <div key={String(k)} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "0.5rem", padding: "0.5rem" }}>
            <div style={{ fontSize: "1rem", fontWeight: 800, color }}>{v}</div>
            <div style={{ fontSize: "0.65rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── main ─────────────────────────────────────────────────── */
export default function AnalyticsClient() {
  const [matchIdx, setMatchIdx] = useState(0);
  const [timeline, setTimeline] = useState<"possession" | "momentum">("possession");

  const timelineData = timeline === "possession" ? POSSESSION_TIMELINE : MOMENTUM_TIMELINE;
  const timelineLabel = timeline === "possession" ? "Possession" : "Momentum";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* ── Page header ── */}
      <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.14em", color: GOLD, fontWeight: 600, marginBottom: "0.4rem" }}>
            Analytics
          </p>
          <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            Team <span style={{ color: GOLD }}>Analytics</span>
          </h1>
          <p style={{ color: "#888", fontSize: "0.9rem" }}>
            Side-by-side performance comparison — radar, possession swing, and full stats
          </p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", position: "sticky", top: "64px", zIndex: 40 }}>
        <div className="wrap" style={{ paddingTop: "0.875rem", paddingBottom: "0.875rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#888" }}>Match</label>
          <select
            value={matchIdx}
            onChange={e => setMatchIdx(Number(e.target.value))}
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {MATCHES_LIST.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "3rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

        {/* ── Team headers ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          <TeamHeader team={0} stats={TEAM_STATS_FULL.t0} />
          <TeamHeader team={1} stats={TEAM_STATS_FULL.t1} />
        </div>

        {/* ── Radar chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "2rem" }}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, fontWeight: 600, marginBottom: "0.25rem" }}>
              Performance Radar
            </p>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Multi-Metric Comparison</h3>
          </div>

          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={TEAM_RADAR} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#2a2a2a" gridType="polygon" />
              <PolarAngleAxis dataKey="metric"
                tick={{ fill: "#888", fontSize: 12, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]}
                tick={{ fill: "#444", fontSize: 10 }} axisLine={false} />
              <Radar name="Team 0" dataKey="t0" stroke={T0} fill={T0} fillOpacity={0.2} strokeWidth={2}
                dot={{ r: 4, fill: T0, strokeWidth: 0 }} />
              <Radar name="Team 1" dataKey="t1" stroke={T1} fill={T1} fillOpacity={0.15} strokeWidth={2}
                dot={{ r: 4, fill: T1, strokeWidth: 0 }} />
              <Legend wrapperStyle={{ fontSize: "0.85rem", paddingTop: "1rem" }} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.8rem" }}
                formatter={(v: number, name: string) => [`${v}`, name]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* ── Stats comparison table ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "2rem" }}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, fontWeight: 600, marginBottom: "0.25rem" }}>
              Head to Head
            </p>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Full Stats Breakdown</h3>
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem" }}>
              {[{ color: T0, label: "Team 0" }, { color: T1, label: "Team 1" }].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: "0.78rem", color: "#888" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <StatRow label="Possession"      v0={TEAM_STATS_FULL.t0.possession}     v1={TEAM_STATS_FULL.t1.possession}     unit="%" />
          <StatRow label="Shots"           v0={TEAM_STATS_FULL.t0.shots}          v1={TEAM_STATS_FULL.t1.shots} />
          <StatRow label="Shots on Target" v0={TEAM_STATS_FULL.t0.shotsOnTarget}  v1={TEAM_STATS_FULL.t1.shotsOnTarget} />
          <StatRow label="Territory"       v0={TEAM_STATS_FULL.t0.territory}      v1={TEAM_STATS_FULL.t1.territory}      unit="%" />
          <StatRow label="Momentum"        v0={TEAM_STATS_FULL.t0.momentum}       v1={TEAM_STATS_FULL.t1.momentum}       unit="%" />
          <StatRow label="Total Passes"    v0={TEAM_STATS_FULL.t0.passes}         v1={TEAM_STATS_FULL.t1.passes} />
          <StatRow label="Pass Accuracy"   v0={TEAM_STATS_FULL.t0.passAcc}        v1={TEAM_STATS_FULL.t1.passAcc}        unit="%" />
          <StatRow label="Avg Fatigue"     v0={TEAM_STATS_FULL.t0.avgFatigue}     v1={TEAM_STATS_FULL.t1.avgFatigue}     unit="%" higherBetter={false} />
          <StatRow label="Fouls"           v0={TEAM_STATS_FULL.t0.fouls}          v1={TEAM_STATS_FULL.t1.fouls}          higherBetter={false} />
          <StatRow label="Corners"         v0={TEAM_STATS_FULL.t0.corners}        v1={TEAM_STATS_FULL.t1.corners} />
        </motion.div>

        {/* ── Possession / Momentum timeline ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "2rem" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, fontWeight: 600, marginBottom: "0.25rem" }}>
                Dominance Timeline
              </p>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                {timelineLabel} Swing — Full Match
              </h3>
            </div>
            {/* Toggle */}
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {(["possession", "momentum"] as const).map(t => (
                <button key={t} onClick={() => setTimeline(t)}
                  style={{
                    padding: "0.35rem 0.9rem", borderRadius: "0.5rem", fontSize: "0.8rem",
                    fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                    border: timeline === t ? `1px solid ${GOLD}` : "1px solid #2a2a2a",
                    background: timeline === t ? "rgba(212,175,55,0.12)" : "transparent",
                    color: timeline === t ? GOLD : "#888",
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timelineData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gT0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T0} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={T0} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gT1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T1} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={T1} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="minute" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                label={{ value: "Minute", position: "insideBottomRight", offset: -5, fill: "#444", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.8rem" }}
                formatter={(v: number, name: string) => [`${v}%`, name === "t0" ? "Team 0" : "Team 1"]}
                labelFormatter={l => `Min ${l}`}
              />
              <Legend formatter={v => v === "t0" ? "Team 0" : "Team 1"}
                wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }} />
              <Area dataKey="t0" name="t0" stroke={T0} strokeWidth={2}
                fill="url(#gT0)" activeDot={{ r: 5 }} />
              <Area dataKey="t1" name="t1" stroke={T1} strokeWidth={2}
                fill="url(#gT1)" activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* ── Possession bar comparison ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "2rem" }}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, fontWeight: 600, marginBottom: "0.25rem" }}>
              Key Metrics
            </p>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Category Bar Comparison</h3>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={[
                { name: "Possession%", T0: TEAM_STATS_FULL.t0.possession,   T1: TEAM_STATS_FULL.t1.possession   },
                { name: "Territory%",  T0: TEAM_STATS_FULL.t0.territory,    T1: TEAM_STATS_FULL.t1.territory    },
                { name: "Pass Acc%",   T0: TEAM_STATS_FULL.t0.passAcc,      T1: TEAM_STATS_FULL.t1.passAcc      },
                { name: "Momentum%",   T0: TEAM_STATS_FULL.t0.momentum,     T1: TEAM_STATS_FULL.t1.momentum     },
              ]}
              margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.8rem" }}
                formatter={(v: number, name: string) => [`${v}%`, name]} />
              <Legend wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }} />
              <Bar dataKey="T0" name="Team 0" fill={T0} radius={[4, 4, 0, 0]} barSize={36} />
              <Bar dataKey="T1" name="Team 1" fill={T1} radius={[4, 4, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

      </div>
    </div>
  );
}
