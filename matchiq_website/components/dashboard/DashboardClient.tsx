"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ChevronDown, ChevronUp, Zap, Activity, Timer, TrendingUp } from "lucide-react";
import {
  PLAYERS_DASHBOARD, MATCHES_LIST, PLAYER_SERIES, PLAYER_SPRINT_ZONES,
  fatigueColor,
} from "@/lib/mockData";

/* ── types ─────────────────────────────────────────────────── */
type Player = typeof PLAYERS_DASHBOARD[number];

/* ── helpers ────────────────────────────────────────────────── */
const teamColor = (team: number) => team === 0 ? "#3b82f6" : "#f43f5e";
const teamLabel = (team: number) => `Team ${team}`;

const STAT_CARD = ({ icon: Icon, label, value, unit }: { icon: React.ElementType; label: string; value: string | number; unit: string }) => (
  <div style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
    <Icon size={16} style={{ color: "#D4AF37", margin: "0 auto 0.4rem" }} />
    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#fff" }}>{value}<span style={{ fontSize: "0.75rem", color: "#888", marginLeft: 2 }}>{unit}</span></div>
    <div style={{ fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
  </div>
);

/* ── expanded charts ────────────────────────────────────────── */
function PlayerCharts({ player }: { player: Player }) {
  const series   = PLAYER_SERIES[player.id]   ?? [];
  const sprintZones = PLAYER_SPRINT_ZONES[player.id] ?? [];

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
          <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.75rem" }}>
            Speed Over Time (m/s)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={series} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="frame" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false}
                label={{ value: "Frame", position: "insideBottomRight", offset: -5, fill: "#444", fontSize: 10 }} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}m`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.75rem" }}
                formatter={(v) => [`${Number(v).toFixed(2)} m/s`, "Speed"]} />
              <Line dataKey="speed" stroke={teamColor(player.team)} strokeWidth={2} dot={false}
                activeDot={{ r: 4, fill: teamColor(player.team) }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Acceleration chart */}
        <div>
          <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.75rem" }}>
            Acceleration Profile (m/s²)
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={series} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="frame" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.75rem" }}
                formatter={(v) => [`${Number(v).toFixed(2)} m/s²`, "Accel"]} />
              <Line dataKey="accel" stroke="#D4AF37" strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: "#D4AF37" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sprint heatmap */}
        {sprintZones.length > 0 && (
          <div>
            <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.75rem" }}>
              Sprint Frequency by Frame Zone
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={sprintZones} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="zone" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.75rem" }}
                  formatter={(v) => [Number(v), "Sprints"]} />
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

/* ── player card ────────────────────────────────────────────── */
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
      {/* Card header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        {/* Left: ID + team badge */}
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

        {/* Right: fatigue badge + toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            padding: "3px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700,
            background: `${fc}22`, border: `1px solid ${fc}66`, color: fc,
          }}>
            {player.fatigueLevel} · {player.fatigue}%
          </div>
          {open ? <ChevronUp size={16} style={{ color: "#555" }} /> : <ChevronDown size={16} style={{ color: "#555" }} />}
        </div>
      </div>

      {/* Quick stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginTop: "1.25rem" }}>
        <STAT_CARD icon={Activity}   label="Avg Spd"   value={player.avgSpeed} unit=" m/s" />
        <STAT_CARD icon={TrendingUp} label="Max Spd"   value={player.maxSpeed} unit=" m/s" />
        <STAT_CARD icon={Zap}        label="Sprints"   value={player.sprints}  unit="" />
        <STAT_CARD icon={Timer}      label="Fatigue"   value={`${player.fatigue}%`} unit="" />
      </div>

      {/* Expanded charts */}
      <AnimatePresence>
        {open && <PlayerCharts player={player} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── main ────────────────────────────────────────────────────── */
export default function DashboardClient() {
  const [match,       setMatch]      = useState(0);
  const [teamFilter,  setTeamFilter] = useState<"all" | 0 | 1>("all");
  const [sortBy,      setSortBy]     = useState<"fatigue" | "speed" | "sprints">("fatigue");

  const players = PLAYERS_DASHBOARD
    .filter(p => teamFilter === "all" || p.team === teamFilter)
    .sort((a, b) =>
      sortBy === "fatigue"  ? b.fatigue  - a.fatigue  :
      sortBy === "speed"    ? b.maxSpeed - a.maxSpeed  :
                              b.sprints  - a.sprints
    );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* ── Page header ── */}
      <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.4rem" }}>
            Analytics
          </p>
          <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            Player Performance <span style={{ color: "#D4AF37" }}>Dashboard</span>
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
              value={match}
              onChange={e => setMatch(Number(e.target.value))}
              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {MATCHES_LIST.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>

          {/* Team filter */}
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {(["all", 0, 1] as const).map(t => (
              <button key={String(t)} onClick={() => setTeamFilter(t)}
                style={{
                  padding: "0.35rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                  border: teamFilter === t ? "1px solid #D4AF37" : "1px solid #2a2a2a",
                  background: teamFilter === t ? "rgba(212,175,55,0.12)" : "transparent",
                  color: teamFilter === t ? "#D4AF37" : "#888",
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
                  border: sortBy === s ? "1px solid #D4AF37" : "1px solid #2a2a2a",
                  background: sortBy === s ? "rgba(212,175,55,0.12)" : "transparent",
                  color: sortBy === s ? "#D4AF37" : "#888", textTransform: "capitalize",
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div className="wrap" style={{ paddingTop: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Players",       value: players.length,  unit: "",    color: "#D4AF37" },
            { label: "Avg Fatigue",   value: `${Math.round(players.reduce((s,p)=>s+p.fatigue,0)/Math.max(1,players.length))}%`, unit: "", color: "#f97316" },
            { label: "Total Sprints", value: players.reduce((s,p)=>s+p.sprints,0), unit: "", color: "#22c55e" },
            { label: "Avg Max Speed", value: (players.reduce((s,p)=>s+p.maxSpeed,0)/Math.max(1,players.length)).toFixed(1), unit: " m/s", color: "#3b82f6" },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color }}>{value}{unit}</div>
              <div style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Player cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: "3rem" }}>
          {players.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
              <PlayerCard player={p} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
