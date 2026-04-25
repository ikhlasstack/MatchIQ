"use client";

import { useState, useEffect } from "react";
import { X, Save, Users, GitMerge, RefreshCw } from "lucide-react";
import type { FatigueRow, TrackingRow } from "./DemoClient";

const API = "http://localhost:8000";

export interface NamesMap {
  players: Record<string, string>; // player_id → name
  teams: Record<string, string>;   // team_id ("0"/"1") → name
}

interface IdMerge {
  from: number;
  to:   number;
}

interface Props {
  matchId: string;
  fatigueData: FatigueRow[] | null;
  trackingData: TrackingRow[] | null;
  onClose: () => void;
  onSaved: (names: NamesMap) => void;
  onCorrectionsApplied?: () => void;
  /** Lifted state so parent (VideoTab) can preview corrections live */
  teamOverrides?: Record<number, number>;
  roleOverrides?: Record<number, string>;
  onTeamOverridesChange?: (v: Record<number, number>) => void;
  onRoleOverridesChange?: (v: Record<number, string>) => void;
}

export default function PlayerNamingModal({
  matchId, fatigueData, trackingData, onClose, onSaved, onCorrectionsApplied,
  teamOverrides: externalTeamOverrides,
  roleOverrides: externalRoleOverrides,
  onTeamOverridesChange,
  onRoleOverridesChange,
}: Props) {
  const [playerNames,   setPlayerNames]   = useState<Record<string, string>>({});
  const [teamNames,     setTeamNames]     = useState<Record<string, string>>({ "0": "", "1": "" });
  const [teamOverrides, _setTeamOverrides] = useState<Record<number, number>>(externalTeamOverrides ?? {});
  const [roleOverrides, _setRoleOverrides] = useState<Record<number, string>>(externalRoleOverrides ?? {});

  function setTeamOverrides(v: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) {
    _setTeamOverrides(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      onTeamOverridesChange?.(next);
      return next;
    });
  }
  function setRoleOverrides(v: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) {
    _setRoleOverrides(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      onRoleOverridesChange?.(next);
      return next;
    });
  }
  const [idMerges,      setIdMerges]      = useState<IdMerge[]>([]);
  const [mergeFrom,     setMergeFrom]     = useState<string>("");
  const [mergeTo,       setMergeTo]       = useState<string>("");
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [applying,      setApplying]      = useState(false);
  const [applyDone,     setApplyDone]     = useState(false);
  const [applyError,    setApplyError]    = useState<string | null>(null);
  const [rerendering,   setRerendering]   = useState(false);
  const [renderPct,     setRenderPct]     = useState(0);
  const [renderError,   setRenderError]   = useState<string | null>(null);

  const players   = buildPlayerList(fatigueData, trackingData);
  const playerIds = players.map(p => p.id);

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

  /* ── Role helpers ── */
  function effectiveRole(p: { id: number; role: string }): string {
    return roleOverrides[p.id] ?? p.role;
  }

  // Count how many players are currently marked as GK (including overrides)
  function gkCount(): number {
    return players.filter(p => effectiveRole(p) === "goalkeeper").length;
  }

  function toggleGk(pid: number, currentRole: string) {
    const original = players.find(p => p.id === pid)?.role ?? "player";
    if (currentRole === "goalkeeper") {
      // Demote back to player
      const newRole = original === "goalkeeper" ? "goalkeeper" : "player";
      // If reverting to original, remove override; otherwise force "player"
      if (original === "goalkeeper") {
        setRoleOverrides(prev => { const n = { ...prev }; delete n[pid]; return n; });
      } else {
        setRoleOverrides(prev => { const n = { ...prev }; delete n[pid]; return n; });
      }
    } else {
      // Promote to GK — only if under the 2 GK limit
      if (gkCount() >= 2) return;
      if (original === "goalkeeper") {
        setRoleOverrides(prev => { const n = { ...prev }; delete n[pid]; return n; });
      } else {
        setRoleOverrides(prev => ({ ...prev, [pid]: "goalkeeper" }));
      }
    }
  }

  /* ── Team helpers ── */
  function effectiveTeam(pid: number): number {
    if (pid in teamOverrides) return teamOverrides[pid];
    return players.find(p => p.id === pid)?.team ?? 0;
  }

  function setTeamOverride(pid: number, team: number) {
    const original = players.find(p => p.id === pid)?.team ?? -1;
    if (team === original) {
      setTeamOverrides(prev => { const n = { ...prev }; delete n[pid]; return n; });
    } else {
      setTeamOverrides(prev => ({ ...prev, [pid]: team }));
    }
  }

  /* ── Merge helpers ── */
  function addMerge() {
    const from = parseInt(mergeFrom, 10);
    const to   = parseInt(mergeTo, 10);
    if (isNaN(from) || isNaN(to) || from === to) return;
    if (idMerges.some(m => m.from === from && m.to === to)) return;
    setIdMerges(prev => [...prev, { from, to }]);
    setMergeFrom("");
    setMergeTo("");
  }

  function removeMerge(idx: number) {
    setIdMerges(prev => prev.filter((_, i) => i !== idx));
  }

  /* ── Save names ── */
  async function handleSaveNames() {
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

  /* ── Apply corrections ── */
  async function handleApplyCorrections() {
    const hasTeam = Object.keys(teamOverrides).length > 0;
    const hasRole = Object.keys(roleOverrides).length > 0;
    const hasMerge = idMerges.length > 0;
    if (!hasTeam && !hasRole && !hasMerge) return;
    setApplying(true);
    setApplyError(null);
    setRenderError(null);
    try {
      const res = await fetch(`${API}/matches/${matchId}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_merges:      idMerges,
          team_overrides: Object.fromEntries(Object.entries(teamOverrides).map(([k, v]) => [k, v])),
          role_overrides: Object.fromEntries(Object.entries(roleOverrides).map(([k, v]) => [k, v])),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        setApplyError(err.detail ?? "Corrections failed");
        return;
      }
      setApplyDone(true);
      setTimeout(() => setApplyDone(false), 3000);
      setTeamOverrides({});
      setRoleOverrides({});
      setIdMerges([]);

      // Kick off video rerender
      setRerendering(true);
      setRenderPct(0);
      try {
        const rrRes = await fetch(`${API}/matches/${matchId}/rerender`, { method: "POST" });
        if (!rrRes.ok || !rrRes.body) {
          setRenderError("Rerender failed to start");
          setRerendering(false);
          onCorrectionsApplied?.();
          return;
        }
        const reader = rrRes.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const msg = JSON.parse(line.slice(5).trim());
            if (msg.pct !== undefined) setRenderPct(msg.pct);
            if (msg.error) { setRenderError(msg.error); break; }
            if (msg.done) { setRenderPct(100); }
          }
        }
      } catch {
        setRenderError("Rerender connection lost");
      } finally {
        setRerendering(false);
        onCorrectionsApplied?.();
      }
    } finally {
      setApplying(false);
    }
  }

  const hasPendingCorrections =
    Object.keys(teamOverrides).length > 0 ||
    Object.keys(roleOverrides).length > 0 ||
    idMerges.length > 0;

  const currentGkCount = gkCount();

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !rerendering) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", width: "100%", maxWidth: "760px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

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
        <div style={{ overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>

          {/* ── Team names ── */}
          <div>
            <SectionLabel>Team Names</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {(["0", "1"] as const).map((tid) => (
                <label key={tid} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#888" }}>
                    <TeamDot tid={tid} />
                    Team {Number(tid) + 1}
                  </span>
                  <input
                    value={teamNames[tid] ?? ""}
                    onChange={e => setTeamNames(prev => ({ ...prev, [tid]: e.target.value }))}
                    placeholder={`Team ${Number(tid) + 1} name…`}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* ── Players ── */}
          <div>
            <SectionLabel>Players</SectionLabel>
            <p style={{ fontSize: "0.72rem", color: "#555", marginBottom: "0.75rem" }}>
              Edit names, reassign teams, and mark goalkeepers (max 2). Changes are staged until you click <em>Apply Corrections</em>.
            </p>
            {players.length === 0 ? (
              <p style={{ color: "#555", fontSize: "0.85rem" }}>No player data available.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {players.map(p => {
                  const eff        = effectiveTeam(p.id);
                  const role       = effectiveRole(p);
                  const isGk       = role === "goalkeeper";
                  const overridden = (p.id in teamOverrides) || (p.id in roleOverrides);
                  const color      = eff === 0 ? "#3b82f6" : "#f43f5e";
                  const canPromote = !isGk && currentGkCount >= 2;
                  return (
                    <div key={p.id} style={{ display: "grid", gridTemplateColumns: "3.5rem 1fr auto auto", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0.6rem", borderRadius: "0.5rem", background: overridden ? "#1a1600" : "#161616", border: `1px solid ${overridden ? "#D4AF3733" : "#1e1e1e"}` }}>
                      {/* ID + GK badge */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "#555" }}>#{p.id}</span>
                        {isGk && (
                          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#D4AF37", letterSpacing: "0.04em" }}>GK</span>
                        )}
                      </div>
                      {/* Name input */}
                      <input
                        value={playerNames[String(p.id)] ?? ""}
                        onChange={e => setPlayerNames(prev => ({ ...prev, [String(p.id)]: e.target.value }))}
                        placeholder={`P${p.id} name…`}
                        style={{ ...inputStyle, padding: "0.35rem 0.6rem" }}
                        onFocus={e => (e.currentTarget.style.borderColor = color)}
                        onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                      {/* GK toggle */}
                      <button
                        onClick={() => toggleGk(p.id, role)}
                        disabled={canPromote}
                        title={canPromote ? "Max 2 goalkeepers" : isGk ? "Remove goalkeeper role" : "Assign as goalkeeper"}
                        style={{ padding: "0.28rem 0.55rem", borderRadius: "0.4rem", fontSize: "0.7rem", fontWeight: 700, cursor: canPromote ? "not-allowed" : "pointer", border: `1px solid ${isGk ? "#D4AF37" : "#2a2a2a"}`, background: isGk ? "rgba(212,175,55,0.12)" : "transparent", color: isGk ? "#D4AF37" : "#444", opacity: canPromote ? 0.35 : 1, transition: "all 0.2s", whiteSpace: "nowrap" }}
                      >
                        GK
                      </button>
                      {/* Team selector */}
                      <select
                        value={eff}
                        onChange={e => setTeamOverride(p.id, parseInt(e.target.value, 10))}
                        style={{ background: "#1a1a1a", border: `1px solid ${color}66`, color, borderRadius: "0.4rem", padding: "0.3rem 0.5rem", fontSize: "0.78rem", cursor: "pointer", outline: "none" }}
                      >
                        <option value={0} style={{ color: "#3b82f6" }}>
                          {teamNames["0"] || "Team 1"}
                        </option>
                        <option value={1} style={{ color: "#f43f5e" }}>
                          {teamNames["1"] || "Team 2"}
                        </option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
            {currentGkCount >= 2 && (
              <p style={{ fontSize: "0.7rem", color: "#D4AF3788", marginTop: "0.5rem" }}>
                2 goalkeepers assigned. Demote one to assign another.
              </p>
            )}
          </div>

          {/* ── ID Merge ── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <GitMerge size={14} style={{ color: "#D4AF37" }} />
              <SectionLabel style={{ margin: 0 }}>Merge IDs</SectionLabel>
            </div>
            <p style={{ fontSize: "0.72rem", color: "#555", marginBottom: "0.75rem" }}>
              Merge a misdetected secondary ID into the correct primary ID. All frames from the secondary ID will be reassigned to the primary.
            </p>

            {idMerges.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.75rem" }}>
                {idMerges.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.65rem", background: "#161616", border: "1px solid #2a2a2a", borderRadius: "0.45rem", fontSize: "0.8rem", color: "#ccc" }}>
                    <span style={{ color: "#f43f5e" }}>#{m.from}</span>
                    <span style={{ color: "#555" }}>→</span>
                    <span style={{ color: "#3b82f6" }}>#{m.to}</span>
                    <button onClick={() => removeMerge(i)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#444", cursor: "pointer", padding: "0 0.2rem" }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <select value={mergeFrom} onChange={e => setMergeFrom(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">Secondary ID (remove)…</option>
                {playerIds.map(id => (
                  <option key={id} value={id}>#{id}{playerNames[String(id)] ? ` – ${playerNames[String(id)]}` : ""}</option>
                ))}
              </select>
              <span style={{ color: "#555", fontSize: "0.8rem" }}>→</span>
              <select value={mergeTo} onChange={e => setMergeTo(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">Primary ID (keep)…</option>
                {playerIds.map(id => (
                  <option key={id} value={id}>#{id}{playerNames[String(id)] ? ` – ${playerNames[String(id)]}` : ""}</option>
                ))}
              </select>
              <button
                onClick={addMerge}
                disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
                style={{ padding: "0.4rem 0.85rem", borderRadius: "0.45rem", background: "#D4AF37", border: "none", color: "#000", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", opacity: (!mergeFrom || !mergeTo || mergeFrom === mergeTo) ? 0.4 : 1 }}
              >
                Add
              </button>
            </div>
          </div>

          {applyError && (
            <div style={{ padding: "0.6rem 0.9rem", background: "#2a0a0a", border: "1px solid #f43f5e44", borderRadius: "0.5rem", color: "#f43f5e", fontSize: "0.8rem" }}>
              {applyError}
            </div>
          )}

          {(rerendering || renderPct === 100) && !renderError && (
            <div style={{ padding: "0.75rem 1rem", background: "#0d1a0d", border: "1px solid #22c55e44", borderRadius: "0.6rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.78rem", color: "#22c55e", fontWeight: 600 }}>
                  {renderPct < 100 ? "Re-rendering video…" : "Video ready"}
                </span>
                <span style={{ fontSize: "0.72rem", color: "#22c55e88" }}>{renderPct.toFixed(0)}%</span>
              </div>
              <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${renderPct}%`, background: "#22c55e", borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            </div>
          )}

          {renderError && (
            <div style={{ padding: "0.6rem 0.9rem", background: "#2a0a0a", border: "1px solid #f43f5e44", borderRadius: "0.5rem", color: "#f43f5e", fontSize: "0.8rem" }}>
              Rerender: {renderError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={onClose} disabled={rerendering} style={{ padding: "0.5rem 1.25rem", borderRadius: "0.6rem", background: "transparent", border: "1px solid #2a2a2a", color: rerendering ? "#444" : "#888", fontSize: "0.875rem", cursor: rerendering ? "not-allowed" : "pointer", fontWeight: 600 }}>
            Skip
          </button>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              onClick={handleApplyCorrections}
              disabled={applying || rerendering || !hasPendingCorrections}
              title={!hasPendingCorrections ? "No pending corrections" : undefined}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.1rem", borderRadius: "0.6rem", background: applyDone ? "#22c55e" : "#1a1a1a", border: `1px solid ${applyDone ? "#22c55e" : hasPendingCorrections ? "#D4AF37" : "#2a2a2a"}`, color: applyDone ? "#000" : hasPendingCorrections ? "#D4AF37" : "#555", fontSize: "0.875rem", cursor: (applying || rerendering || !hasPendingCorrections) ? "not-allowed" : "pointer", fontWeight: 700, opacity: (applying || rerendering) ? 0.7 : 1, transition: "all 0.3s" }}
            >
              <RefreshCw size={13} style={{ animation: (applying || rerendering) ? "spin 1s linear infinite" : "none" }} />
              {applyDone ? "Applied!" : applying ? "Recalculating…" : rerendering ? "Rendering…" : "Apply Corrections"}
            </button>
            <button
              onClick={handleSaveNames}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.25rem", borderRadius: "0.6rem", background: saved ? "#22c55e" : "#D4AF37", border: "none", color: "#000", fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, opacity: saving ? 0.7 : 1, transition: "background 0.3s" }}
            >
              <Save size={14} />
              {saved ? "Saved!" : saving ? "Saving…" : "Save Names"}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────────────────────── */

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.75rem", ...style }}>
      {children}
    </p>
  );
}

function TeamDot({ tid }: { tid: string }) {
  const color = tid === "0" ? "#3b82f6" : "#f43f5e";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 6 }} />;
}

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: "0.5rem",
  padding: "0.45rem 0.75rem",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  color: "#ccc",
  borderRadius: "0.5rem",
  padding: "0.4rem 0.6rem",
  fontSize: "0.8rem",
  outline: "none",
  cursor: "pointer",
};

/* ── Build player list ──────────────────────────────────────────────────────── */
function buildPlayerList(
  fatigue: FatigueRow[] | null,
  tracking: TrackingRow[] | null,
): { id: number; team: number; role: string }[] {
  const map = new Map<number, { team: number; role: string }>();

  if (fatigue) {
    for (const row of fatigue) {
      const id = parseInt(row.label.replace(/\D/g, ""), 10);
      if (!isNaN(id)) map.set(id, { team: row.team, role: "player" });
    }
  }
  if (tracking) {
    for (const row of tracking) {
      if (row.role === "ball" || row.role === "referee") continue;
      if (!map.has(row.id)) {
        map.set(row.id, { team: row.team, role: row.role });
      } else if (row.role === "goalkeeper") {
        map.set(row.id, { team: map.get(row.id)!.team, role: "goalkeeper" });
      }
    }
  }

  return Array.from(map.entries())
    .map(([id, { team, role }]) => ({ id, team, role }))
    .sort((a, b) => a.id - b.id);
}
