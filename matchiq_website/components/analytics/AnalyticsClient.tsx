"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar,
} from "recharts";

/* ── palette ─────────────────────────────────────────────── */
const API = "http://localhost:8000";
const T0 = "#3b82f6";
const T1 = "#f43f5e";
const GOLD = "#D4AF37";

/* ── API types ───────────────────────────────────────────── */
interface MatchMeta {
  id: string; name: string; date: string;
  duration: string; frames: number; players: number;
}
interface FatigueRow { label: string; score: number; level: string; team: number; }
interface GoalProbRow { frame: number; t0: number; t1: number; }
interface OutcomeData {
  winA: number; draw: number; winB: number;
  possession: { t0: number; t1: number };
  shots: { t0: number; t1: number };
  territory: { t0: number; t1: number };
  momentum: { t0: number; t1: number };
}

/* ── Derived analytics state ─────────────────────────────── */
interface AnalyticsState {
  outcome: OutcomeData;
  fatigue: FatigueRow[];
  goalProb: GoalProbRow[];
  radarData: { metric: string; t0: number; t1: number }[];
  barData: { name: string; T0: number; T1: number }[];
  possession: { minute: number; t0: number; t1: number }[];
  momentum: { minute: number; t0: number; t1: number }[];
  stats: {
    t0: { possession: number; shots: number; territory: number; momentum: number; avgFatigue: number };
    t1: { possession: number; shots: number; territory: number; momentum: number; avgFatigue: number };
  };
}

/* ── Build goal-prob possession timeline from raw frames ── */
function buildTimeline(
  goalProb: GoalProbRow[],
  outcome: OutcomeData,
  bins = 19,
): { minute: number; t0: number; t1: number }[] {
  if (!goalProb.length) return [];
  const maxFrame = goalProb[goalProb.length - 1].frame || 1;
  const buckets: { t0: number[]; t1: number[] }[] = Array.from(
    { length: bins }, () => ({ t0: [], t1: [] }),
  );
  for (const r of goalProb) {
    const idx = Math.min(bins - 1, Math.floor((r.frame / maxFrame) * bins));
    buckets[idx].t0.push(r.t0);
    buckets[idx].t1.push(r.t1);
  }
  return buckets.map((b, i) => {
    const avgT0 = b.t0.length ? b.t0.reduce((s, v) => s + v, 0) / b.t0.length : 0;
    const avgT1 = b.t1.length ? b.t1.reduce((s, v) => s + v, 0) / b.t1.length : 0;
    const sum = avgT0 + avgT1 || 1;
    return {
      minute: Math.round((i / (bins - 1)) * 90),
      t0: Math.round((avgT0 / sum) * 100),
      t1: Math.round((avgT1 / sum) * 100),
    };
  });
}

/* ── Derive momentum timeline similarly ──────────────────── */
function buildMomentumTimeline(
  goalProb: GoalProbRow[],
  outcome: OutcomeData,
  bins = 19,
): { minute: number; t0: number; t1: number }[] {
  /* Use a rolling window of goal prob spread scaled by outcome momentum */
  if (!goalProb.length) return [];
  const maxFrame = goalProb[goalProb.length - 1].frame || 1;
  const window = Math.max(1, Math.floor(goalProb.length / bins));
  return Array.from({ length: bins }, (_, i) => {
    const slice = goalProb.slice(i * window, (i + 1) * window);
    const avgT0 = slice.length ? slice.reduce((s, r) => s + r.t0, 0) / slice.length : 0;
    const avgT1 = slice.length ? slice.reduce((s, r) => s + r.t1, 0) / slice.length : 0;
    const sum = avgT0 + avgT1 || 1;
    return {
      minute: Math.round((i / (bins - 1)) * 90),
      t0: Math.round((avgT0 / sum) * 100),
      t1: Math.round((avgT1 / sum) * 100),
    };
  });
}

function buildAnalytics(
  outcome: OutcomeData,
  fatigue: FatigueRow[],
  goalProb: GoalProbRow[],
): AnalyticsState {
  const avgFatigue0 = fatigue.filter(r => r.team === 0);
  const avgFatigue1 = fatigue.filter(r => r.team === 1);
  const f0 = avgFatigue0.length
    ? Math.round(avgFatigue0.reduce((s, r) => s + r.score, 0) / avgFatigue0.length)
    : 0;
  const f1 = avgFatigue1.length
    ? Math.round(avgFatigue1.reduce((s, r) => s + r.score, 0) / avgFatigue1.length)
    : 0;

  const avgGP0 = goalProb.length
    ? goalProb.reduce((s, r) => s + r.t0, 0) / goalProb.length
    : 0;
  const avgGP1 = goalProb.length
    ? goalProb.reduce((s, r) => s + r.t1, 0) / goalProb.length
    : 0;
  const gpSum = avgGP0 + avgGP1 || 1;

  const radarData = [
    { metric: "Possession", t0: outcome.possession.t0, t1: outcome.possession.t1 },
    { metric: "Shots", t0: Math.min(100, outcome.shots.t0 * 8), t1: Math.min(100, outcome.shots.t1 * 8) },
    { metric: "Threat", t0: Math.round((avgGP0 / gpSum) * 100), t1: Math.round((avgGP1 / gpSum) * 100) },
    { metric: "Territory", t0: outcome.territory.t0, t1: outcome.territory.t1 },
    { metric: "Momentum", t0: outcome.momentum.t0, t1: outcome.momentum.t1 },
    { metric: "Fitness", t0: Math.max(0, 100 - f0), t1: Math.max(0, 100 - f1) },
  ];

  const barData = [
    { name: "Possession%", T0: outcome.possession.t0, T1: outcome.possession.t1 },
    { name: "Territory%", T0: outcome.territory.t0, T1: outcome.territory.t1 },
    { name: "Momentum%", T0: outcome.momentum.t0, T1: outcome.momentum.t1 },
    { name: "Fitness%", T0: Math.max(0, 100 - f0), T1: Math.max(0, 100 - f1) },
  ];

  return {
    outcome, fatigue, goalProb, radarData, barData,
    possession: buildTimeline(goalProb, outcome),
    momentum: buildMomentumTimeline(goalProb, outcome),
    stats: {
      t0: {
        possession: outcome.possession.t0,
        shots: outcome.shots.t0,
        territory: outcome.territory.t0,
        momentum: outcome.momentum.t0,
        avgFatigue: f0,
      },
      t1: {
        possession: outcome.possession.t1,
        shots: outcome.shots.t1,
        territory: outcome.territory.t1,
        momentum: outcome.momentum.t1,
        avgFatigue: f1,
      },
    },
  };
}

/* ── Stat row in the comparison table ─────────────────────── */
function StatRow({
  label, v0, v1, unit = "", higherBetter = true,
}: {
  label: string; v0: number; v1: number; unit?: string; higherBetter?: boolean;
}) {
  const t0Wins = higherBetter ? v0 > v1 : v0 < v1;
  const t1Wins = higherBetter ? v1 > v0 : v1 < v0;
  const pct0 = Math.round((v0 / ((v0 + v1) || 1)) * 100);
  const pct1 = 100 - pct0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "center", padding: "0.9rem 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "1.25rem", fontWeight: 900, color: t0Wins ? T0 : "#fff" }}>
          {v0}{unit}
        </span>
        {t0Wins && <sup style={{ fontSize: "0.65rem", color: T0, marginLeft: 3 }}>▲</sup>}
      </div>
      <div style={{ textAlign: "center", minWidth: "120px" }}>
        <p style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>
          {label}
        </p>
        <div style={{ height: 6, borderRadius: 3, display: "flex", overflow: "hidden" }}>
          <div style={{ width: `${pct0}%`, background: T0, transition: "width 0.6s" }} />
          <div style={{ width: `${pct1}%`, background: T1, transition: "width 0.6s" }} />
        </div>
      </div>
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
function TeamHeader({ team, name, stats }: {
  team: 0 | 1;
  name: string;
  stats: { possession: number; shots: number; avgFatigue: number };
}) {
  const color = team === 0 ? T0 : T1;
  const wins = team === 0 ? stats.possession > 50 : stats.possession < 50;

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
      <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: `${color}22`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem", fontSize: "0.75rem", fontWeight: 900, color }}>
        {name.slice(0, 3).toUpperCase()}
      </div>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>{name}</h2>
      {wins && (
        <span style={{ display: "inline-block", marginTop: "0.4rem", padding: "2px 10px", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, background: `${color}22`, border: `1px solid ${color}55`, color }}>
          DOMINANT
        </span>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "1rem" }}>
        {([
          ["Possession", `${stats.possession}%`],
          ["Shots", stats.shots],
          ["Avg Fatigue", `${stats.avgFatigue}%`],
        ] as [string, string | number][]).map(([k, v]) => (
          <div key={String(k)} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "0.5rem", padding: "0.5rem" }}>
            <div style={{ fontSize: "1rem", fontWeight: 800, color }}>{v}</div>
            <div style={{ fontSize: "0.65rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Loading / empty state ────────────────────────────────── */
function EmptyState({ loading, error }: { loading: boolean; error: string | null }) {
  return (
    <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#555" }}>
      {loading ? (
        <p style={{ fontSize: "0.9rem" }}>Loading match data…</p>
      ) : error ? (
        <p style={{ fontSize: "0.9rem", color: "#ef4444" }}>{error}</p>
      ) : (
        <p style={{ fontSize: "0.9rem" }}>
          No saved matches found. Process a match from the Demo page first.
        </p>
      )}
    </div>
  );
}

interface NamesMap { players: Record<string, string>; teams: Record<string, string>; }

/* ── main ─────────────────────────────────────────────────── */
export default function AnalyticsClient() {
  const [matches, setMatches] = useState<MatchMeta[]>([]);
  const [matchId, setMatchId] = useState<string>("");
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [names, setNames] = useState<NamesMap>({ players: {}, teams: {} });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<"possession" | "momentum">("possession");

  const t0Name = names.teams["0"] || "Team 1";
  const t1Name = names.teams["1"] || "Team 2";

  /* Load match list */
  useEffect(() => {
    fetch(`${API}/matches`)
      .then(r => r.json())
      .then((data: MatchMeta[]) => {
        setMatches(data);
        if (data.length > 0) setMatchId(data[0].id);
      })
      .catch(() => setError("Could not connect to the backend. Is it running?"))
      .finally(() => setLoading(false));
  }, []);

  /* Fetch match data + names whenever selection changes */
  useEffect(() => {
    if (!matchId) return;
    setFetching(true);
    setError(null);
    setAnalytics(null);
    setNames({ players: {}, teams: {} });

    Promise.all([
      fetch(`${API}/matches/${matchId}/results/outcome`).then(r => r.json()),
      fetch(`${API}/matches/${matchId}/results/fatigue`).then(r => r.json()),
      fetch(`${API}/matches/${matchId}/results/goal-prob`).then(r => r.json()),
      fetch(`${API}/matches/${matchId}/names`).then(r => r.ok ? r.json() : { players: {}, teams: {} }),
    ])
      .then(([outcome, fatigue, goalProb, savedNames]) => {
        if (!outcome || Object.keys(outcome).length === 0) {
          setError("Match outcome data unavailable for this match.");
          return;
        }
        setAnalytics(buildAnalytics(outcome as OutcomeData, fatigue as FatigueRow[], goalProb as GoalProbRow[]));
        setNames(savedNames as NamesMap);
      })
      .catch(() => setError("Failed to load match data. Check that the backend is running."))
      .finally(() => setFetching(false));
  }, [matchId]);

  const isLoading = loading || fetching;
  const timelineData = analytics
    ? (timeline === "possession" ? analytics.possession : analytics.momentum)
    : [];
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
            value={matchId}
            onChange={e => setMatchId(e.target.value)}
            disabled={loading || matches.length === 0}
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.85rem", cursor: "pointer" }}
          >
            {matches.length === 0
              ? <option>No matches available</option>
              : matches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
            }
          </select>
          {fetching && <span style={{ fontSize: "0.75rem", color: "#555" }}>Loading…</span>}
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "3rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

        {/* Empty / loading state */}
        {(isLoading || error || !analytics) && (
          <EmptyState loading={isLoading} error={error} />
        )}

        {analytics && (
          <>
            {/* ── Team headers ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
              <TeamHeader team={0} name={t0Name} stats={analytics.stats.t0} />
              <TeamHeader team={1} name={t1Name} stats={analytics.stats.t1} />
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
                <RadarChart data={analytics.radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="#2a2a2a" gridType="polygon" />
                  <PolarAngleAxis dataKey="metric"
                    tick={{ fill: "#888", fontSize: 12, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]}
                    tick={{ fill: "#444", fontSize: 10 }} axisLine={false} />
                  <Radar name={t0Name} dataKey="t0" stroke={T0} fill={T0} fillOpacity={0.2} strokeWidth={2}
                    dot={{ r: 4, fill: T0, strokeWidth: 0 }} />
                  <Radar name={t1Name} dataKey="t1" stroke={T1} fill={T1} fillOpacity={0.15} strokeWidth={2}
                    dot={{ r: 4, fill: T1, strokeWidth: 0 }} />
                  <Legend wrapperStyle={{ fontSize: "0.85rem", paddingTop: "1rem" }} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.8rem" }}
                    formatter={(v: number | any, name: string | any) => [`${v}`, name]}
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
                  {[{ color: T0, label: t0Name }, { color: T1, label: t1Name }].map(({ color, label }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: "0.78rem", color: "#888" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <StatRow label="Possession" v0={analytics.stats.t0.possession} v1={analytics.stats.t1.possession} unit="%" />
              <StatRow label="Shots" v0={analytics.stats.t0.shots} v1={analytics.stats.t1.shots} />
              <StatRow label="Territory" v0={analytics.stats.t0.territory} v1={analytics.stats.t1.territory} unit="%" />
              <StatRow label="Momentum" v0={analytics.stats.t0.momentum} v1={analytics.stats.t1.momentum} unit="%" />
              <StatRow label="Avg Fatigue" v0={analytics.stats.t0.avgFatigue} v1={analytics.stats.t1.avgFatigue} unit="%" higherBetter={false} />
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
                      <stop offset="5%" stopColor={T0} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={T0} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gT1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T1} stopOpacity={0.35} />
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
                    formatter={(v: number | any, name: string | any) => [`${v}%`, name === "t0" ? t0Name : t1Name]}
                    labelFormatter={l => `Min ${l}`}
                  />
                  <Legend formatter={v => v === "t0" ? t0Name : t1Name}
                    wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }} />
                  <Area dataKey="t0" name="t0" stroke={T0} strokeWidth={2}
                    fill="url(#gT0)" activeDot={{ r: 5 }} />
                  <Area dataKey="t1" name="t1" stroke={T1} strokeWidth={2}
                    fill="url(#gT1)" activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* ── Bar comparison ── */}
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
                  data={analytics.barData}
                  margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.8rem" }}
                    formatter={(v: number | any, name: string | any) => [`${v}%`, name === "t0" ? t0Name : t1Name]} />
                  <Legend wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }} />
                  <Bar dataKey="T0" name={t0Name} fill={T0} radius={[4, 4, 0, 0]} barSize={36} />
                  <Bar dataKey="T1" name={t1Name} fill={T1} radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}

      </div>
    </div>
  );
}
