"use client";

import { useState } from "react";
import type { NamesMap } from "./PlayerNamingModal";

export interface OverlayRow {
  id:     number;
  team:   number;
  role:   string;
  x:      number;
  y:      number;
  px?:    number;
  py?:    number;
  bbox?:  [number, number, number, number];
  vx?:    number;
  vy?:    number;
  speed?: number;
}

export interface MovementRow {
  player_id:     number;
  team_id:       number;
  avg_speed:     number;
  max_speed:     number;
  total_sprints: number;
}

function dirGlyph(vx = 0, vy = 0): string {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag < 0.05) return "·";
  const deg = (Math.atan2(-vy, vx) * 180) / Math.PI;
  const idx = Math.round(((deg + 360) % 360) / 45) % 8;
  return ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"][idx];
}

const TEAM_COLOR: Record<number, string> = {
  0: "#3b82f6",
  1: "#f43f5e",
};

export default function PlayerDrawer({
  rows,
  names,
  movement,
  teamOverrides,
  roleOverrides,
  onTeamOverride,
  onRoleOverride,
  onNameChange,
  onNameSave,
}: {
  rows:             OverlayRow[] | null;
  names?:           NamesMap;
  movement?:        MovementRow[] | null;
  teamOverrides?:   Record<number, number>;
  roleOverrides?:   Record<number, string>;
  onTeamOverride?:  (id: number, team: number) => void;
  onRoleOverride?:  (id: number, role: string) => void;
  onNameChange?:    (id: number, name: string) => void;
  onNameSave?:      () => void;
}) {
  const [open,       setOpen]       = useState(true);
  const [search,     setSearch]     = useState("");
  const [teamFilter, setTeamFilter] = useState<number | null>(null);

  const movMap = new Map<number, MovementRow>();
  (movement ?? []).forEach(m => movMap.set(m.player_id, m));

  const effTeam = (r: OverlayRow) => teamOverrides?.[r.id] ?? r.team;
  const effRole = (r: OverlayRow) => roleOverrides?.[r.id] ?? r.role;

  const gkCount = (rows ?? []).filter(r => r.role !== "ball" && effRole(r) === "goalkeeper").length;

  const players = (rows ?? [])
    .filter(r => r.role !== "ball" && r.role !== "referee")
    .sort((a, b) => effTeam(a) !== effTeam(b) ? effTeam(a) - effTeam(b) : a.id - b.id);

  const teamName = (t: number) =>
    names?.teams?.[String(t)] ?? (t === 0 ? "Team A" : t === 1 ? "Team B" : `Team ${t}`);

  const filtered = players
    .filter(r => teamFilter === null || effTeam(r) === teamFilter)
    .filter(r => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return String(r.id).includes(q) || (names?.players?.[String(r.id)] ?? "").toLowerCase().includes(q);
    });

  return (
    <div style={{
      width: open ? "260px" : "44px",
      flexShrink: 0,
      background: "#0d0d0d",
      border: "1px solid #1e1e1e",
      borderRadius: "0.75rem",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "width 0.22s ease",
      maxHeight: "calc(100vh - 100px)",
    }}>

      {/* Header */}
      <div style={{
        padding: open ? "0.7rem 0.85rem 0.6rem" : "0.75rem 0",
        borderBottom: open ? "1px solid #1a1a1a" : "none",
        display: "flex",
        alignItems: open ? "flex-start" : "center",
        justifyContent: open ? "space-between" : "center",
        flexShrink: 0,
      }}>
        {open && (
          <div>
            <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#D4AF37", fontWeight: 700, margin: 0 }}>
              Players
            </p>
            <p style={{ fontSize: "0.7rem", color: "#444", marginTop: "2px" }}>
              {players.length} on field
            </p>
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          title={open ? "Collapse" : "Expand"}
          style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: "0.4rem", color: "#555", cursor: "pointer", fontSize: "0.75rem", padding: "3px 6px", lineHeight: 1, flexShrink: 0 }}
        >
          {open ? "›" : "‹"}
        </button>
      </div>

      {/* Search + team filter */}
      {open && (
        <div style={{ padding: "0.5rem 0.85rem", borderBottom: "1px solid #141414", flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or #ID…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "0.35rem 0.6rem", borderRadius: "0.45rem",
              background: "#111", border: "1px solid #222",
              color: "#ccc", fontSize: "0.75rem", outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {([null, 0, 1] as (number | null)[]).map(t => {
              const active = teamFilter === t;
              const col = t === null ? "#555" : (TEAM_COLOR[t] ?? "#555");
              return (
                <button
                  key={String(t)}
                  onClick={() => setTeamFilter(t)}
                  style={{
                    flex: 1, padding: "0.25rem 0", borderRadius: "0.35rem",
                    fontSize: "0.65rem", fontWeight: 600, cursor: "pointer",
                    background: active ? `${col}20` : "transparent",
                    border: active ? `1px solid ${col}88` : "1px solid #1e1e1e",
                    color: active ? col : "#444",
                  }}
                >
                  {t === null ? "All" : teamName(t)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Player list */}
      {open && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0.4rem 0.5rem" }}>
          {filtered.length === 0 ? (
            <p style={{ fontSize: "0.75rem", color: "#333", textAlign: "center", marginTop: "1.5rem" }}>
              {search ? "No matches" : "No data"}
            </p>
          ) : (
            filtered.map(row => {
              const team  = effTeam(row);
              const role  = effRole(row);
              const color = TEAM_COLOR[team] ?? "#888";
              const isGk  = role === "goalkeeper";
              const name  = names?.players?.[String(row.id)] ?? "";
              const speed = row.speed ?? 0;
              const dir   = dirGlyph(row.vx, row.vy);
              const mov   = movMap.get(row.id);
              const overridden = !!(teamOverrides?.[row.id] !== undefined || roleOverrides?.[row.id]);

              return (
                <div key={row.id} style={{
                  marginBottom: "0.35rem",
                  borderRadius: "0.55rem",
                  background: overridden ? "#191200" : "#111",
                  border: `1px solid ${overridden ? "#D4AF3728" : "#1a1a1a"}`,
                  overflow: "hidden",
                }}>
                  {/* Top row */}
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}88` }} />
                      <span style={{ fontSize: "0.58rem", color: "#444", lineHeight: 1 }}>#{row.id}</span>
                    </div>

                    {onNameChange ? (
                      <input
                        value={name}
                        onChange={e => onNameChange(row.id, e.target.value)}
                        onBlur={() => onNameSave?.()}
                        placeholder={`#${row.id}`}
                        style={{ background: "transparent", border: "none", borderBottom: "1px solid #2a2a2a", color: "#ccc", fontSize: "0.75rem", fontWeight: 600, outline: "none", fontFamily: "inherit", width: "100%", padding: "1px 2px" }}
                      />
                    ) : (
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name || `#${row.id}`}
                      </span>
                    )}

                    {onRoleOverride ? (
                      <button
                        onClick={() => { if (!isGk && gkCount >= 2) return; onRoleOverride(row.id, isGk ? "player" : "goalkeeper"); }}
                        title={!isGk && gkCount >= 2 ? "Max 2 GKs" : isGk ? "Remove GK" : "Set as GK"}
                        style={{ padding: "2px 5px", borderRadius: "3px", fontSize: "0.58rem", fontWeight: 700, cursor: (!isGk && gkCount >= 2) ? "not-allowed" : "pointer", opacity: (!isGk && gkCount >= 2) ? 0.35 : 1, background: isGk ? "rgba(212,175,55,0.15)" : "transparent", border: isGk ? "1px solid rgba(212,175,55,0.5)" : "1px solid #2a2a2a", color: isGk ? "#D4AF37" : "#444" }}
                      >GK</button>
                    ) : isGk ? (
                      <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "#D4AF37" }}>GK</span>
                    ) : null}

                    {onTeamOverride ? (
                      <select
                        value={team}
                        onChange={e => onTeamOverride(row.id, Number(e.target.value))}
                        style={{ background: "#161616", border: `1px solid ${color}55`, color, fontSize: "0.62rem", fontWeight: 700, borderRadius: "3px", padding: "2px 3px", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <option value={0}>{teamName(0)}</option>
                        <option value={1}>{teamName(1)}</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: "0.6rem", color, fontWeight: 600 }}>{teamName(team)}</span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div style={{ padding: "0 0.5rem 0.45rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <div style={{ height: 3, background: "#1e1e1e", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min((speed / 10) * 100, 100)}%`, background: color, borderRadius: 2, transition: "width 0.3s ease" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", color: "#555" }}>{dir}</span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: speed > 5 ? "#D4AF37" : "#666" }}>
                        {speed.toFixed(1)}<span style={{ fontSize: "0.58rem", color: "#333", marginLeft: "1px" }}>m/s</span>
                      </span>
                      {mov && (
                        <>
                          <span style={{ fontSize: "0.6rem", color: "#333" }}>·</span>
                          <span style={{ fontSize: "0.65rem", color: "#555" }}>max <span style={{ color: "#888", fontWeight: 600 }}>{mov.max_speed.toFixed(1)}</span></span>
                          <span style={{ fontSize: "0.6rem", color: "#333" }}>·</span>
                          <span style={{ fontSize: "0.65rem", color: "#555" }}><span style={{ color: "#888", fontWeight: 600 }}>{mov.total_sprints}</span> spr</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Collapsed label */}
      {!open && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "0.75rem" }}>
          <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#333", fontWeight: 700, writingMode: "vertical-rl" }}>
            Players
          </span>
        </div>
      )}
    </div>
  );
}
