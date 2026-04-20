"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";

const API  = "http://localhost:8000";
const GOLD = "#D4AF37";
const BLUE = "#3b82f6";
const PINK = "#f43f5e";
const BLUE_DIM = "rgba(59,130,246,0.35)";
const PINK_DIM = "rgba(244,63,94,0.35)";
const SUCCESS = "#22c55e";
const DANGER  = "#ef4444";

/* ─── API types ─────────────────────────────────────────────────────────── */
interface MatchMeta {
  id: string; name: string; date: string;
  duration: string; frames: number; players: number;
}
interface FatigueRow { label: string; score: number; level: string; team: number; }
interface GoalProbRow { frame: number; t0: number; t1: number; }
interface OutcomeData {
  possession: { t0: number; t1: number };
  shots:      { t0: number; t1: number };
  territory:  { t0: number; t1: number };
  momentum:   { t0: number; t1: number };
}

/* ─── Derived team stats ──────────────────────────────────────────────────── */
interface TeamSnapshot {
  possession: number; shots: number; territory: number; momentum: number;
  avg_goal_prob: number;
  fatigue: FatigueRow[];           // filtered to this team
  goal_prob_timeline: number[];    // avg goal prob bucketed to 10 windows
  speed_proxy: number[];           // avg goal-prob as speed proxy (no speed endpoint)
}

function teamKey(t: number): "t0" | "t1" { return t === 0 ? "t0" : "t1"; }

function buildSnapshot(
  team: number,
  outcome: OutcomeData,
  fatigue: FatigueRow[],
  goalProb: GoalProbRow[],
): TeamSnapshot {
  const tk = teamKey(team);
  const myFatigue = fatigue.filter(r => r.team === team);

  /* bucket goal-prob into 10 equal windows */
  const buckets = Array.from({ length: 10 }, () => [] as number[]);
  goalProb.forEach(r => {
    const idx = Math.min(9, Math.floor((r.frame / (goalProb[goalProb.length - 1]?.frame || 1)) * 10));
    buckets[idx].push(r[tk]);
  });
  const goal_prob_timeline = buckets.map(b =>
    b.length ? parseFloat((b.reduce((s, v) => s + v, 0) / b.length).toFixed(3)) : 0
  );

  const avg_goal_prob = parseFloat(
    (goalProb.reduce((s, r) => s + r[tk], 0) / (goalProb.length || 1)).toFixed(3)
  );

  return {
    possession: outcome.possession[tk],
    shots:      outcome.shots[tk],
    territory:  outcome.territory[tk],
    momentum:   outcome.momentum[tk],
    avg_goal_prob,
    fatigue: myFatigue,
    goal_prob_timeline,
    speed_proxy: goal_prob_timeline,
  };
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function pctDiff(a: number, b: number) {
  return b === 0 ? 0 : Math.round(Math.abs(((a - b) / b) * 100));
}

function teamColor(teamId: number) { return teamId === 0 ? BLUE : PINK; }
function teamDim(teamId: number)   { return teamId === 0 ? BLUE_DIM : PINK_DIM; }
function teamLabel(teamId: number) { return teamId === 0 ? "Team 1 (Blue)" : "Team 2 (Pink)"; }

/* ─── Stat row ─────────────────────────────────────────────────────────────── */
function StatRow({
  label, a, b, unit = "", higherBetter = true, show, colorA, colorB,
}: {
  label: string; a: number; b: number; unit?: string;
  higherBetter?: boolean; show: boolean; colorA: string; colorB: string;
}) {
  const diff = Math.abs(a - b);
  const isEqual = unit === "%" ? diff <= 2 : diff === 0;
  const aWins = !isEqual && (higherBetter ? a > b : a < b);
  const bWins = !isEqual && (higherBetter ? b > a : b < a);
  const total  = (a + b) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.4 }}
      style={{
        display: "grid", gridTemplateColumns: "1fr 2fr 1fr",
        gap: "1rem", alignItems: "center",
        padding: "0.85rem 0", borderBottom: "1px solid #1a1a1a",
      }}
    >
      {/* Left value */}
      <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
        <span style={{ fontSize: "1.1rem", fontWeight: 900, color: aWins ? colorA : "#fff" }}>
          {a}{unit}
        </span>
        {aWins && <span style={{ fontSize: "0.65rem", color: colorA }}>★</span>}
      </div>

      {/* Centre */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>
          {label}
        </p>
        {isEqual ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: GOLD, background: "rgba(212,175,55,0.1)", border: `1px solid rgba(212,175,55,0.4)`, borderRadius: "4px", padding: "2px 8px", letterSpacing: "0.08em" }}>
              EQUAL
            </span>
          </div>
        ) : (
          <div style={{ height: 5, borderRadius: 3, display: "flex", overflow: "hidden", background: "#1a1a1a" }}>
            <motion.div
              initial={{ flex: 0 }} animate={show ? { flex: a / total } : { flex: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{ background: aWins ? colorA : "rgba(255,255,255,0.12)" }}
            />
            <motion.div
              initial={{ flex: 0 }} animate={show ? { flex: b / total } : { flex: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{ background: bWins ? colorB : "rgba(255,255,255,0.08)" }}
            />
          </div>
        )}
      </div>

      {/* Right value */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {bWins && <span style={{ fontSize: "0.65rem", color: colorB }}>★</span>}
        <span style={{ fontSize: "1.1rem", fontWeight: 900, color: bWins ? colorB : "#fff" }}>
          {b}{unit}
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Card wrapper ──────────────────────────────────────────────────────────── */
function Card({ children, delay = 0, show }: { children: React.ReactNode; delay?: number; show: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay }}
      style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem" }}
    >
      {children}
    </motion.div>
  );
}

function CardLabel({ top, title }: { top: string; title: string }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.14em", color: GOLD, fontWeight: 600, marginBottom: "0.3rem" }}>{top}</p>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>{title}</h3>
    </div>
  );
}

/* ─── Dropdown ──────────────────────────────────────────────────────────────── */
function Dropdown<T extends string | number>({
  label, value, options, onChange, disabled,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#888", fontWeight: 600, marginBottom: "0.4rem" }}>
        {label}
      </label>
      <select
        value={String(value)} disabled={disabled}
        onChange={e => {
          const raw = e.target.value;
          onChange((typeof value === "number" ? Number(raw) : raw) as T);
        }}
        style={{
          width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
          color: disabled ? "#444" : "#fff", borderRadius: "0.75rem",
          padding: "0.65rem 1rem", fontSize: "0.9rem",
          cursor: disabled ? "not-allowed" : "pointer", outline: "none",
        }}
      >
        {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ─── Team preview chip ─────────────────────────────────────────────────────── */
function TeamChip({ matchId, teamId, meta }: { matchId: string; teamId: number; meta: MatchMeta | undefined }) {
  if (!meta) return null;
  const color = teamColor(teamId);
  return (
    <div style={{ marginTop: "0.75rem", background: "#1a1a1a", borderRadius: "0.75rem", padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", border: "1px solid #2a2a2a" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <p style={{ fontSize: "0.78rem", color: "#888", margin: 0 }}>
        <span style={{ color: "#fff", fontWeight: 600 }}>{teamLabel(teamId)}</span>
        {"  ·  "}
        {meta.players} players · {meta.frames.toLocaleString()} frames
      </p>
    </div>
  );
}

/* ─── Verdict ────────────────────────────────────────────────────────────────── */
function computeVerdict(a: TeamSnapshot, b: TeamSnapshot): "A" | "B" | "EQUAL" {
  let aScore = 0, bScore = 0;
  const hb = (av: number, bv: number) => { if (av > bv + 1) aScore++; else if (bv > av + 1) bScore++; };
  hb(a.possession, b.possession);
  hb(a.shots, b.shots);
  hb(a.territory, b.territory);
  hb(a.momentum, b.momentum);
  hb(a.avg_goal_prob * 100, b.avg_goal_prob * 100);
  const aFat = a.fatigue.reduce((s, r) => s + r.score, 0) / (a.fatigue.length || 1);
  const bFat = b.fatigue.reduce((s, r) => s + r.score, 0) / (b.fatigue.length || 1);
  if (aFat < bFat - 3) aScore++; else if (bFat < aFat - 3) bScore++;
  if (aScore > bScore + 1) return "A";
  if (bScore > aScore + 1) return "B";
  return "EQUAL";
}

/* ─── Main component ─────────────────────────────────────────────────────────── */
export default function CompareClient() {
  const [matches, setMatches]   = useState<MatchMeta[]>([]);
  const [loading, setLoading]   = useState(true);

  /* Selection state */
  const [matchAId, setMatchAId] = useState("");
  const [matchBId, setMatchBId] = useState("");
  const [teamA,    setTeamA]    = useState<0 | 1>(0);
  const [teamB,    setTeamB]    = useState<0 | 1>(0);

  /* Results state */
  const [compared,   setCompared]   = useState(false);
  const [fetching,   setFetching]   = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [snapA,      setSnapA]      = useState<TeamSnapshot | null>(null);
  const [snapB,      setSnapB]      = useState<TeamSnapshot | null>(null);

  /* Load match list from API */
  useEffect(() => {
    fetch(`${API}/matches`)
      .then(r => r.json())
      .then((data: MatchMeta[]) => {
        setMatches(data);
        if (data.length >= 1) setMatchAId(data[0].id);
        if (data.length >= 2) setMatchBId(data[1].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const matchOptions = matches.map(m => ({ value: m.id, label: m.name }));
  const teamOptions: { value: 0 | 1; label: string }[] = [
    { value: 0, label: "Team 1 (Blue)" },
    { value: 1, label: "Team 2 (Pink)" },
  ];

  const metaA = matches.find(m => m.id === matchAId);
  const metaB = matches.find(m => m.id === matchBId);

  async function handleCompare() {
    if (!matchAId || !matchBId) return;
    setFetching(true); setFetchError(null); setCompared(false);
    try {
      const [fatA, goalA, outA, fatB, goalB, outB] = await Promise.all([
        fetch(`${API}/matches/${matchAId}/results/fatigue`).then(r => r.json()) as Promise<FatigueRow[]>,
        fetch(`${API}/matches/${matchAId}/results/goal-prob`).then(r => r.json()) as Promise<GoalProbRow[]>,
        fetch(`${API}/matches/${matchAId}/results/outcome`).then(r => r.json()) as Promise<OutcomeData>,
        fetch(`${API}/matches/${matchBId}/results/fatigue`).then(r => r.json()) as Promise<FatigueRow[]>,
        fetch(`${API}/matches/${matchBId}/results/goal-prob`).then(r => r.json()) as Promise<GoalProbRow[]>,
        fetch(`${API}/matches/${matchBId}/results/outcome`).then(r => r.json()) as Promise<OutcomeData>,
      ]);
      setSnapA(buildSnapshot(teamA, outA, fatA, goalA));
      setSnapB(buildSnapshot(teamB, outB, fatB, goalB));
      setCompared(true);
    } catch {
      setFetchError("Could not fetch match data. Is the backend running?");
    } finally {
      setFetching(false);
    }
  }

  const colorA = teamColor(teamA);
  const colorB = teamColor(teamB);
  const dimA   = teamDim(teamA);
  const dimB   = teamDim(teamB);

  /* Fatigue merged — common player labels */
  const fatigueData = snapA && snapB
    ? (() => {
        const mapB = Object.fromEntries(snapB.fatigue.map(r => [r.label, r.score]));
        return snapA.fatigue
          .filter(r => r.label in mapB)
          .map(r => ({ player: r.label, matchA: r.score, matchB: mapB[r.label] }));
      })()
    : [];

  const goalData = snapA && snapB
    ? snapA.goal_prob_timeline.map((v, i) => ({
        pct: `${i * 10}%`,
        matchA: v,
        matchB: snapB.goal_prob_timeline[i] ?? 0,
      }))
    : [];

  const verdict = snapA && snapB ? computeVerdict(snapA, snapB) : null;

  const ttStyle = {
    contentStyle: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "0.5rem", fontSize: "0.78rem" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: 64 }}>

      {/* Page header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.14em", color: GOLD, fontWeight: 600, marginBottom: "0.4rem" }}>
            COMPARISON
          </p>
          <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            Team Performance <span style={{ color: GOLD }}>Comparison</span>
          </h1>
          <p style={{ color: "#888", fontSize: "0.9rem", margin: 0 }}>
            Track how a team performs across different matches
          </p>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "4rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

        {/* Selection panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem" }}
        >
          <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.14em", color: GOLD, fontWeight: 600, marginBottom: "1.25rem" }}>
            Select Matches &amp; Teams
          </p>

          {loading ? (
            <p style={{ color: "#555", fontSize: "0.85rem" }}>Loading saved matches…</p>
          ) : matches.length === 0 ? (
            <p style={{ color: "#555", fontSize: "0.85rem" }}>
              No saved matches found. Process a match from the Demo page first.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1.5rem", alignItems: "start" }}>
              {/* Match A */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <Dropdown label="Select Match A" value={matchAId} options={matchOptions}
                  onChange={v => { setMatchAId(v); setCompared(false); }} />
                <Dropdown label="Select Team" value={teamA} options={teamOptions}
                  onChange={v => { setTeamA(v); setCompared(false); }} />
                <TeamChip matchId={matchAId} teamId={teamA} meta={metaA} />
              </div>

              {/* VS + button */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "1.5rem", gap: "1rem" }}>
                <span style={{ fontSize: "2rem", fontWeight: 900, color: GOLD, letterSpacing: "-0.02em" }}>VS</span>
                <button
                  onClick={handleCompare}
                  disabled={fetching || !matchAId || !matchBId}
                  style={{
                    background: GOLD, color: "#000", border: "none", borderRadius: "0.75rem",
                    padding: "0.65rem 1.5rem", fontWeight: 700, fontSize: "0.85rem",
                    cursor: fetching ? "wait" : "pointer", letterSpacing: "0.04em",
                    whiteSpace: "nowrap", opacity: fetching ? 0.6 : 1,
                  }}
                >
                  {fetching ? "Loading…" : "Compare"}
                </button>
              </div>

              {/* Match B */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <Dropdown label="Select Match B" value={matchBId} options={matchOptions}
                  onChange={v => { setMatchBId(v); setCompared(false); }} />
                <Dropdown label="Select Team" value={teamB} options={teamOptions}
                  onChange={v => { setTeamB(v); setCompared(false); }} />
                <TeamChip matchId={matchBId} teamId={teamB} meta={metaB} />
              </div>
            </div>
          )}
        </motion.div>

        {/* Error */}
        {fetchError && (
          <p style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center" }}>{fetchError}</p>
        )}

        {/* Results */}
        <AnimatePresence>
          {compared && snapA && snapB && (
            <>
              {/* HEAD TO HEAD STATS */}
              <Card show={compared} delay={0}>
                <CardLabel top="Head to Head" title="HEAD TO HEAD STATS" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "1rem", marginBottom: "0.25rem" }}>
                  <div style={{ textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: colorA }}>
                    {metaA?.name ?? matchAId} · {teamLabel(teamA)}
                  </div>
                  <div style={{ textAlign: "center", fontSize: "0.68rem", color: GOLD, fontWeight: 600, letterSpacing: "0.08em" }}>★ = WINNER</div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: colorB }}>
                    {metaB?.name ?? matchBId} · {teamLabel(teamB)}
                  </div>
                </div>
                <StatRow show={compared} label="Possession %"        a={snapA.possession}  b={snapB.possession}  unit="%" colorA={colorA} colorB={colorB} />
                <StatRow show={compared} label="Shots on Goal"       a={snapA.shots}        b={snapB.shots}                colorA={colorA} colorB={colorB} />
                <StatRow show={compared} label="Territory Control %"  a={snapA.territory}    b={snapB.territory}   unit="%" colorA={colorA} colorB={colorB} />
                <StatRow show={compared} label="Momentum %"           a={snapA.momentum}     b={snapB.momentum}    unit="%" colorA={colorA} colorB={colorB} />
                <StatRow show={compared} label="Avg Goal Probability" a={Math.round(snapA.avg_goal_prob * 100)} b={Math.round(snapB.avg_goal_prob * 100)} unit="%" colorA={colorA} colorB={colorB} />
                <StatRow show={compared} label="Avg Team Fatigue"     a={Math.round(snapA.fatigue.reduce((s, r) => s + r.score, 0) / (snapA.fatigue.length || 1))} b={Math.round(snapB.fatigue.reduce((s, r) => s + r.score, 0) / (snapB.fatigue.length || 1))} unit="%" higherBetter={false} colorA={colorA} colorB={colorB} />
              </Card>

              {/* FATIGUE COMPARISON CHART */}
              <Card show={compared} delay={0.1}>
                <CardLabel top="Fatigue Analysis" title="TEAM FATIGUE COMPARISON" />
                {fatigueData.length === 0 ? (
                  <p style={{ color: "#555", fontSize: "0.85rem", textAlign: "center", padding: "2rem 0" }}>
                    No common players found between the two matches.
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={fatigueData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                        <XAxis dataKey="player" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                        <Tooltip {...ttStyle} formatter={(v, name) => [`${Number(v).toFixed(1)}%`, String(name)]} />
                        <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.5rem" }} />
                        <Bar dataKey="matchA" name={`Match A · ${teamLabel(teamA)}`} fill={colorA} radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="matchB" name={`Match B · ${teamLabel(teamB)}`} fill={colorB} radius={[4, 4, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                    <p style={{ fontSize: "0.72rem", color: "#555", marginTop: "0.75rem", textAlign: "center" }}>
                      Players only shown if tracked in both matches
                    </p>
                  </>
                )}
              </Card>

              {/* GOAL PROBABILITY TIMELINE */}
              <Card show={compared} delay={0.2}>
                <CardLabel top="Attacking Threat" title="ATTACKING THREAT OVER TIME" />
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={goalData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="pct" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                      label={{ value: "Match Progress", position: "insideBottomRight", offset: -5, fill: "#444", fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
                    <Tooltip {...ttStyle} formatter={(v, name) => [Number(v).toFixed(3), String(name)]} />
                    <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.5rem" }} />
                    <Line dataKey="matchA" name={`Match A · ${teamLabel(teamA)}`} stroke={colorA} strokeWidth={2} dot={false} type="monotone" />
                    <Line dataKey="matchB" name={`Match B · ${teamLabel(teamB)}`} stroke={colorB} strokeWidth={2} dot={false} type="monotone" strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* VERDICT */}
              <VerdictCard
                verdict={verdict!}
                snapA={snapA} snapB={snapB}
                matchALabel={metaA?.name ?? matchAId}
                matchBLabel={metaB?.name ?? matchBId}
                teamALabel={teamLabel(teamA)}
                teamBLabel={teamLabel(teamB)}
                colorA={colorA} colorB={colorB}
                show={compared}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Verdict card ──────────────────────────────────────────────────────────── */
function VerdictCard({
  verdict, snapA, snapB,
  matchALabel, matchBLabel, teamALabel, teamBLabel,
  colorA, colorB, show,
}: {
  verdict: "A" | "B" | "EQUAL";
  snapA: TeamSnapshot; snapB: TeamSnapshot;
  matchALabel: string; matchBLabel: string;
  teamALabel: string; teamBLabel: string;
  colorA: string; colorB: string; show: boolean;
}) {
  const possDiff  = pctDiff(snapA.possession, snapB.possession);
  const fatA = snapA.fatigue.reduce((s, r) => s + r.score, 0) / (snapA.fatigue.length || 1);
  const fatB = snapB.fatigue.reduce((s, r) => s + r.score, 0) / (snapB.fatigue.length || 1);
  const fatDiff   = pctDiff(fatA, fatB);
  const goalDiff  = pctDiff(snapA.avg_goal_prob, snapB.avg_goal_prob);

  const winnerMatch = verdict === "A" ? matchALabel : matchBLabel;
  const winnerTeam  = verdict === "A" ? teamALabel  : teamBLabel;
  const winnerColor = verdict === "A" ? colorA      : colorB;

  const bullets: { arrow: "up" | "down" | "eq"; text: string }[] = [
    snapA.possession > snapB.possession + 2
      ? { arrow: "up",   text: `${possDiff}% higher possession in Match A (${teamALabel})` }
      : snapB.possession > snapA.possession + 2
      ? { arrow: "down", text: `${possDiff}% lower possession in Match A (${teamALabel})` }
      : { arrow: "eq",   text: "Similar possession in both matches" },

    fatA < fatB - 3
      ? { arrow: "up",   text: `${fatDiff}% less fatigue in Match A (${teamALabel})` }
      : fatA > fatB + 3
      ? { arrow: "down", text: `${fatDiff}% more fatigue in Match A (${teamALabel})` }
      : { arrow: "eq",   text: "Similar fatigue levels in both matches" },

    Math.abs(snapA.avg_goal_prob - snapB.avg_goal_prob) < 0.02
      ? { arrow: "eq",   text: "Similar attacking threat in both matches" }
      : snapA.avg_goal_prob > snapB.avg_goal_prob
      ? { arrow: "up",   text: `${goalDiff}% stronger goal threat in Match A (${teamALabel})` }
      : { arrow: "down", text: `${goalDiff}% weaker goal threat in Match A (${teamALabel})` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.55, delay: 0.35 }}
      style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem" }}
    >
      <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.14em", color: GOLD, fontWeight: 600, marginBottom: "0.3rem" }}>Verdict</p>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.5rem" }}>VERDICT</h3>

      {verdict === "EQUAL" ? (
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>⚖️</div>
          <h4 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.4rem" }}>Consistent Performance Across Both Matches</h4>
          <p style={{ color: "#888", fontSize: "0.85rem" }}>No significant difference detected</p>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🏆</div>
          <h4 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.3rem" }}>
            <span style={{ color: winnerColor }}>{winnerTeam}</span> performed{" "}
            <span style={{ color: GOLD }}>BETTER</span> in {winnerMatch}
          </h4>
          <p style={{ color: "#888", fontSize: "0.85rem" }}>Based on possession, attacking threat and fatigue</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontWeight: 900, fontSize: "1rem", color: b.arrow === "up" ? SUCCESS : b.arrow === "down" ? DANGER : "#888" }}>
              {b.arrow === "up" ? "↑" : b.arrow === "down" ? "↓" : "→"}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#fff" }}>{b.text}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
