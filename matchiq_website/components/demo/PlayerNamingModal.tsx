"use client";

import { useState, useEffect } from "react";
import { X, Save, Users } from "lucide-react";
import type { FatigueRow, TrackingRow } from "./DemoClient";

const API = "http://localhost:8000";

export interface NamesMap {
  players: Record<string, string>; // player_id → name
  teams: Record<string, string>;   // team_id ("0"/"1") → name
}

interface Props {
  matchId: string;
  fatigueData: FatigueRow[] | null;
  trackingData: TrackingRow[] | null;
  onClose: () => void;
  onSaved: (names: NamesMap) => void;
}

export default function PlayerNamingModal({ matchId, fatigueData, trackingData, onClose, onSaved }: Props) {
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [teamNames,   setTeamNames]   = useState<Record<string, string>>({ "0": "", "1": "" });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  /* Build unique player list from available data */
  const players = buildPlayerList(fatigueData, trackingData);

  /* Pre-fill with any existing names */
  useEffect(() => {
    fetch(`${API}/matches/${matchId}/names`)
      .then(r => r.json())
      .then((data: NamesMap) => {
        if (data.players) setPlayerNames(data.players);
        if (data.teams)   setTeamNames(prev => ({ ...prev, ...data.teams }));
      })
      .catch(() => {});
  }, [matchId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/matches/${matchId}/names`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: playerNames, teams: teamNames }),
      });
      const data: NamesMap = await res.json();
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", width: "100%", maxWidth: "720px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "1.5rem 1.5rem 1rem", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Users size={18} style={{ color: "#D4AF37" }} />
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Assign Player &amp; Team Names</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: "0.25rem" }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Team names */}
          <div>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.75rem" }}>
              Team Names
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[["0", "#3b82f6"], ["1", "#f43f5e"]] .map(([tid, color]) => (
                <label key={tid} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#888" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 6 }} />
                    Team {Number(tid) + 1}
                  </span>
                  <input
                    value={teamNames[tid] ?? ""}
                    onChange={e => setTeamNames(prev => ({ ...prev, [tid]: e.target.value }))}
                    placeholder={`Team ${Number(tid) + 1} name…`}
                    style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: "0.5rem", padding: "0.45rem 0.75rem", fontSize: "0.875rem", outline: "none" }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Player names — split by team */}
          <div>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.75rem" }}>
              Player Names
            </p>
            {players.length === 0 ? (
              <p style={{ color: "#555", fontSize: "0.85rem" }}>No player data available.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {([["0", "#3b82f6"], ["1", "#f43f5e"]] as const).map(([tid, color]) => {
                  const teamPlayers = players.filter(p => String(p.team) === tid);
                  const teamLabel = teamNames[tid] || `Team ${Number(tid) + 1}`;
                  return (
                    <div key={tid}>
                      {/* Team column header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", paddingBottom: "0.4rem", borderBottom: `1px solid ${color}22` }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color }}>{teamLabel}</span>
                      </div>
                      {/* Players in this team */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {teamPlayers.length === 0 ? (
                          <p style={{ fontSize: "0.78rem", color: "#444" }}>No players detected</p>
                        ) : teamPlayers.map(p => (
                          <label key={p.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span style={{ fontSize: "0.7rem", color: "#666" }}>ID {p.id}</span>
                            <input
                              value={playerNames[String(p.id)] ?? ""}
                              onChange={e => setPlayerNames(prev => ({ ...prev, [String(p.id)]: e.target.value }))}
                              placeholder={`P${p.id} name…`}
                              style={{ background: "#1a1a1a", border: `1px solid #2a2a2a`, color: "#fff", borderRadius: "0.5rem", padding: "0.4rem 0.65rem", fontSize: "0.85rem", outline: "none", width: "100%", boxSizing: "border-box" }}
                              onFocus={e => (e.currentTarget.style.borderColor = color)}
                              onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1a1a1a", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: "0.6rem", background: "transparent", border: "1px solid #2a2a2a", color: "#888", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.25rem", borderRadius: "0.6rem", background: saved ? "#22c55e" : "#D4AF37", border: "none", color: "#000", fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, opacity: saving ? 0.7 : 1, transition: "background 0.3s" }}>
            <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save Names"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Derive sorted player list from whatever data is available */
function buildPlayerList(
  fatigue: FatigueRow[] | null,
  tracking: TrackingRow[] | null,
): { id: number; team: number }[] {
  const map = new Map<number, number>();

  if (fatigue) {
    for (const row of fatigue) {
      const id = parseInt(row.label.replace(/\D/g, ""), 10);
      if (!isNaN(id)) map.set(id, row.team);
    }
  }
  if (tracking) {
    for (const row of tracking) {
      if (row.role === "ball" || row.role === "referee") continue;
      if (!map.has(row.id)) map.set(row.id, row.team);
    }
  }

  return Array.from(map.entries())
    .map(([id, team]) => ({ id, team }))
    .sort((a, b) => a.id - b.id);
}
