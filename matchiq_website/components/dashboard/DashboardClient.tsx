"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ChevronDown, ChevronUp, Zap, Activity, Timer, TrendingUp } from "lucide-react";

/* ── constants ────────────────────────────────────────────── */
const API  = "http://localhost:8000";
const GOLD = "#D4AF37";

/* ── API types ────────────────────────────────────────────── */
interface MatchMeta {
  id: string; name: string; date: string;
  duration: string; frames: number; players: number;
}

interface SpeedPoint  { frame: number; speed: number; accel: number; }
interface SprintZone  { zone: string; sprints: number; }

interface MovementRow {
  player_id:     number;
  team_id:       number;
  avg_speed:     number;
  max_speed:     number;
  total_sprints: number;
  speed_series:  SpeedPoint[];
  sprint_zones:  SprintZone[];
}

interface FatigueRow {
  label: string;   // "P{id}"
  score: number;   // 0–100
  level: string;   // LOW / MEDIUM / HIGH
  team:  number;
}

/* ── merged player record ─────────────────────────────────── */
interface Player {
  id:           number;
  team:         number;
  avgSpeed:     number;
  maxSpeed:     number;
  sprints:      number;
  fatigue:      number;
  fatigueLevel: string;
  speedSeries:  SpeedPoint[];
  sprintZones:  SprintZone[];
}

/* ── helpers ──────────────────────────────────────────────── */
const teamColor = (team: number) => team === 0 ? "#3b82f6" : "#f43f5e";
const teamLabel = (team: number) => `Team ${team}`;

function fatigueColor(level: string) {
  if (level === "HIGH")   return "#ef4444";
  if (level === "MEDIUM") return "#f97316";
  if (level === "LOW")    return "#22c55e";
  return "#22c55e";
}

/* ── stat mini-card ───────────────────────────────────────── */
const STAT_CARD = ({
  icon: Icon, label, value, unit,
}: { icon: React.ElementType; label: string; value: string | number; unit: string }) => (
  <div style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
    <Icon size={16} style={{ color: GOLD, margin: "0 auto 0.4rem" }} />
    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#fff" }}>
      {value}<span style={{ fontSize: "0.75rem", color: "#888", marginLeft: 2 }}>{unit}</span>
    </div>
    <div style={{ fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
  </div>
);

/* ── expanded charts ──────────────────────────────────────── */
function PlayerCharts({ player }: { player: Player }) {
  const series     = player.speedSeries;
  const sprintZones = player.sprintZones;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      style={{ overflow: "hidden" }}
    >
      <div style={{ paddingTop: "1.5rem", borderTop: "1px solid #1a1a1a", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>

        {/* Speed over time */}
        <div>
          <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: GOLD, fontWeight: 600, marginBottom: "0.75rem" }}>
            Speed Over Time (px/s)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={series} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="frame" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false}
                label={{ value: "Frame", position: "insideBottomRight", offset: -5, fill: "#444", fontSize: 10 }} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.75rem" }}
                formatter={(v) => [`${Number(v).toFixed(2)} px/s`, "Speed"]}
              />
              <Line dataKey="speed" stroke={teamColor(player.team)} strokeWidth={2} dot={false}
                activeDot={{ r: 4, fill: teamColor(player.team) }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Acceleration chart */}
        <div>
          <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: GOLD, fontWeight: 600, marginBottom: "0.75rem" }}>
            Acceleration Profile (px/s²)
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={series} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="frame" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.75rem" }}
                formatter={(v) => [`${Number(v).toFixed(2)} px/s²`, "Accel"]}
              />
              <Line dataKey="accel" stroke={GOLD} strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: GOLD }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sprint zone heatmap */}
        {sprintZones.length > 0 && (
          <div>
            <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: GOLD, fontWeight: 600, marginBottom: "0.75rem" }}>
              Sprint Frequency by Frame Zone
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={sprintZones} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="zone" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.75rem" }}
                  formatter={(v) => [Number(v), "Sprints"]}
                />
                <Bar dataKey="sprints" radius={[4, 4, 0, 0]} barSize={28}>
                  {sprintZones.map((_, i) => (
                    <Cell key={i} fill={`rgba(212,175,55,${0.3 + i * 0.1})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── player card ──────────────────────────────────────────── */
function PlayerCard({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const fc = fatigueColor(player.fatigueLevel);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card-hover"
      style={{
        background: "#111",
        border: `1px solid ${open ? "rgba(212,175,55,0.4)" : "#2a2a2a"}`,
        borderRadius: "1rem",
        padding: "1.5rem",
        cursor: "pointer",
        transition: "border-color 0.3s",
      }}
      onClick={() => setOpen(o => !o)}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "2.75rem", height: "2.75rem", borderRadius: "50%", flexShrink: 0,
            background: `${teamColor(player.team)}22`, border: `2px solid ${teamColor(player.team)}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.85rem", fontWeight: 900, color: teamColor(player.team),
          }}>
            #{player.id}
          </div>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>Player #{player.id}</div>
            <div style={{ fontSize: "0.75rem", color: teamColor(player.team), fontWeight: 600 }}>
              {teamLabel(player.team)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            padding: "3px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700,
            background: `${fc}22`, border: `1px solid ${fc}66`, color: fc,
          }}>
            {player.fatigueLevel} · {player.fatigue}%
          </div>
          {open
            ? <ChevronUp size={16} style={{ color: "#555" }} />
            : <ChevronDown size={16} style={{ color: "#555" }} />
          }
        </div>
      </div>

      {/* Quick stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginTop: "1.25rem" }}>
        <STAT_CARD icon={Activity}   label="Avg Spd"  value={player.avgSpeed} unit=" px/s" />
        <STAT_CARD icon={TrendingUp} label="Max Spd"  value={player.maxSpeed} unit=" px/s" />
        <STAT_CARD icon={Zap}        label="Sprints"  value={player.sprints}  unit="" />
        <STAT_CARD icon={Timer}      label="Fatigue"  value={`${player.fatigue}%`} unit="" />
      </div>

      {/* Expanded charts */}
      <AnimatePresence>
        {open && <PlayerCharts player={player} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── merge API responses into Player[] ───────────────────── */
function mergePlayers(movement: MovementRow[], fatigue: FatigueRow[]): Player[] {
  const fatigueMap = new Map<number, FatigueRow>();
  for (const f of fatigue) {
    const id = parseInt(f.label.replace("P", ""), 10);
    if (!isNaN(id)) fatigueMap.set(id, f);
  }

  return movement.map(m => {
    const fat = fatigueMap.get(m.player_id);
    return {
      id:           m.player_id,
      team:         m.team_id,
      avgSpeed:     m.avg_speed,
      maxSpeed:     m.max_speed,
      sprints:      m.total_sprints,
      fatigue:      fat ? Math.round(fat.score) : 0,
      fatigueLevel: fat ? fat.level : "LOW",
      speedSeries:  m.speed_series,
      sprintZones:  m.sprint_zones,
    };
  });
}

/* ── main ─────────────────────────────────────────────────── */
export default function DashboardClient() {
  const [matches,    setMatches]    = useState<MatchMeta[]>([]);
  const [matchId,    setMatchId]    = useState<string>("");
  const [players,    setPlayers]    = useState<Player[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetching,   setFetching]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<"all" | 0 | 1>("all");
  const [sortBy,     setSortBy]     = useState<"fatigue" | "speed" | "sprints">("fatigue");

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

  /* Fetch player data whenever match changes */
  useEffect(() => {
    if (!matchId) return;
    setFetching(true);
    setError(null);
    setPlayers([]);

    Promise.all([
      fetch(`${API}/matches/${matchId}/results/movement`).then(r => r.json()),
      fetch(`${API}/matches/${matchId}/results/fatigue`).then(r => r.json()),
    ])
      .then(([movement, fatigue]) => {
        const merged = mergePlayers(movement as MovementRow[], fatigue as FatigueRow[]);
        setPlayers(merged);
        if (merged.length === 0) setError("No player data available for this match.");
      })
      .catch(() => setError("Failed to load player data. Check that the backend is running."))
      .finally(() => setFetching(false));
  }, [matchId]);

  const filtered = players
    .filter(p => teamFilter === "all" || p.team === teamFilter)
    .sort((a, b) =>
      sortBy === "fatigue" ? b.fatigue  - a.fatigue  :
      sortBy === "speed"   ? b.maxSpeed - a.maxSpeed  :
                             b.sprints  - a.sprints
    );

  const isLoading = loading || fetching;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* ── Page header ── */}
      <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.14em", color: GOLD, fontWeight: 600, marginBottom: "0.4rem" }}>
            Analytics
          </p>
          <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            Player Performance <span style={{ color: GOLD }}>Dashboard</span>
          </h1>
          <p style={{ color: "#888", fontSize: "0.9rem" }}>
            Expand any card to view speed, acceleration and sprint zone charts
          </p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", position: "sticky", top: "64px", zIndex: 40 }}>
        <div className="wrap" style={{ paddingTop: "0.875rem", paddingBottom: "0.875rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>

          {/* Match selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#888", whiteSpace: "nowrap" }}>Match</label>
            <select
              value={matchId}
              onChange={e => { setMatchId(e.target.value); setTeamFilter("all"); }}
              disabled={isLoading || matches.length === 0}
              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {matches.length === 0
                ? <option>No matches available</option>
                : matches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
              }
            </select>
          </div>

          {/* Team filter */}
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {(["all", 0, 1] as const).map(t => (
              <button key={String(t)} onClick={() => setTeamFilter(t)}
                style={{
                  padding: "0.35rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                  border: teamFilter === t ? `1px solid ${GOLD}` : "1px solid #2a2a2a",
                  background: teamFilter === t ? "rgba(212,175,55,0.12)" : "transparent",
                  color: teamFilter === t ? GOLD : "#888",
                }}>
                {t === "all" ? "All Teams" : `Team ${t}`}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
            <label style={{ fontSize: "0.75rem", color: "#888" }}>Sort by</label>
            {(["fatigue", "speed", "sprints"] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                style={{
                  padding: "0.35rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                  border: sortBy === s ? `1px solid ${GOLD}` : "1px solid #2a2a2a",
                  background: sortBy === s ? "rgba(212,175,55,0.12)" : "transparent",
                  color: sortBy === s ? GOLD : "#888", textTransform: "capitalize",
                }}>
                {s}
              </button>
            ))}
          </div>

          {fetching && <span style={{ fontSize: "0.75rem", color: "#555" }}>Loading…</span>}
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: "1.5rem" }}>

        {/* ── Summary bar ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Players",       value: filtered.length,  unit: "",     color: GOLD      },
            { label: "Avg Fatigue",   value: `${Math.round(filtered.reduce((s,p)=>s+p.fatigue,0)/Math.max(1,filtered.length))}%`, unit: "", color: "#f97316" },
            { label: "Total Sprints", value: filtered.reduce((s,p)=>s+p.sprints,0), unit: "", color: "#22c55e" },
            { label: "Avg Max Speed", value: (filtered.reduce((s,p)=>s+p.maxSpeed,0)/Math.max(1,filtered.length)).toFixed(1), unit: " px/s", color: "#3b82f6" },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color }}>{value}{unit}</div>
              <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── States ── */}
        {isLoading && (
          <p style={{ textAlign: "center", color: "#555", fontSize: "0.9rem", padding: "3rem 0" }}>
            Loading player data…
          </p>
        )}
        {!isLoading && error && (
          <p style={{ textAlign: "center", color: "#ef4444", fontSize: "0.9rem", padding: "3rem 0" }}>
            {error}
          </p>
        )}
        {!isLoading && !error && filtered.length === 0 && players.length > 0 && (
          <p style={{ textAlign: "center", color: "#555", fontSize: "0.9rem", padding: "3rem 0" }}>
            No players for this team filter.
          </p>
        )}

        {/* ── Player cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: "3rem" }}>
          {filtered.map((p, i) => (
            <motion.div key={`${matchId}-${p.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
              <PlayerCard player={p} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
