import React from "react";

/* ── helpers ─────────────────────────────────────────────────── */
function fv(val, digits = 2) {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(digits);
    return String(val);
}

function fatigueColor(level) {
    if (!level) return "#4b5563";
    switch (level.toLowerCase()) {
        case "low":      return "#22c55e";
        case "moderate": return "#eab308";
        case "high":     return "#f97316";
        case "critical": return "#ef4444";
        default:         return "#4b5563";
    }
}

function goalProbColor(prob) {
    if (!prob && prob !== 0) return "var(--text-primary)";
    if (prob > 0.60) return "#ef4444";
    if (prob > 0.35) return "#f97316";
    if (prob > 0.18) return "#eab308";
    return "var(--text-primary)";
}

/* ── PlayerCard ─────────────────────────────────────────────── */
function PlayerCard({ det, isVisible, detailLevel }) {
    const fatigue  = det.fatigue         || {};
    const movement = det.movement        || {};
    const goal     = det.goal_probability || {};

    const teamColor = det.team_id === 0 ? "#3b82f6"
                    : det.team_id === 1 ? "#f43f5e"
                    :                     "#6b7280";

    const fColor  = fatigueColor(fatigue.fatigue_level);
    const fWidth  = Math.min(100, Math.max(0, (Number(fatigue.fatigue_score) || 0) * 100));
    const probPct = goal.goal_probability !== undefined
        ? `${(goal.goal_probability * 100).toFixed(0)}%`
        : "—";

    return (
        <div
            className={`player-card ${isVisible ? "" : "offscreen"} fade-in`}
            style={{ borderColor: isVisible ? teamColor : "rgba(255,255,255,0.06)" }}
        >
            {/* Top row */}
            <div className="pc-top">
                <span className="pc-num" style={{ color: teamColor }}>#{det.player_id}</span>
                <span
                    className="pc-role"
                    style={{ background: `${teamColor}20`, color: teamColor }}
                >
                    {det.role}
                </span>
                {det.movement?.is_sprinting && isVisible
                    ? <span className="pc-badge-sprint">⚡ Sprint</span>
                    : !isVisible
                        ? <span className="pc-badge-off">off-screen</span>
                        : null
                }
            </div>

            {/* Fatigue bar */}
            {detailLevel === "full" && (
                <div className="pc-fatigue">
                    <div className="pc-fatigue-head">
                        <span className="pc-fatigue-lbl">Fatigue</span>
                        <span className="pc-fatigue-lvl" style={{ color: fColor }}>
                            {fatigue.fatigue_level || "—"}
                        </span>
                    </div>
                    <div className="pc-fatigue-track">
                        <div
                            className="pc-fatigue-fill"
                            style={{ width: `${fWidth}%`, background: fColor }}
                        />
                    </div>
                </div>
            )}

            {/* Stats grid */}
            {detailLevel === "full" ? (
                <div className="pc-stats">
                    <div className="pc-stat">
                        <span className="pc-stat-v">{fv(movement.speed)}</span>
                        <span className="pc-stat-k">Speed</span>
                    </div>
                    <div className="pc-stat">
                        <span className="pc-stat-v">{fv(movement.acceleration)}</span>
                        <span className="pc-stat-k">Accel</span>
                    </div>
                    <div className="pc-stat">
                        <span className="pc-stat-v" style={{ color: goalProbColor(goal.goal_probability) }}>
                            {probPct}
                        </span>
                        <span className="pc-stat-k">Goal Prob</span>
                    </div>
                    <div className="pc-stat">
                        <span className="pc-stat-v">{fv(det.confidence)}</span>
                        <span className="pc-stat-k">Conf</span>
                    </div>
                </div>
            ) : (
                <div className="pc-compact">
                    <span style={{ color: "#8b9ab8" }}>Spd {fv(movement.speed)}</span>
                    <span style={{ color: fColor }}>{fatigue.fatigue_level || "—"}</span>
                    <span style={{ color: goalProbColor(goal.goal_probability) }}>{probPct}</span>
                </div>
            )}
        </div>
    );
}

/* ── PlayerGrid ─────────────────────────────────────────────── */
export default function PlayerGrid({
    filteredPlayers, ballDetections,
    playerFilter, setPlayerFilter,
    detailLevel, setDetailLevel,
    currentIds,
}) {
    return (
        <div className="card pg-container">
            {/* Header */}
            <div className="pg-header">
                <div className="pg-title">
                    <span>Tracked Objects</span>
                    <span className="pg-count">
                        {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""}
                        {ballDetections.length > 0 ? ` + ${ballDetections.length} ball` : ""}
                    </span>
                </div>
                <div className="pg-controls">
                    <select
                        id="select-player-filter"
                        className="select"
                        value={playerFilter}
                        onChange={e => setPlayerFilter(e.target.value)}
                    >
                        <option value="all">All Players</option>
                        <option value="team0">Team 0</option>
                        <option value="team1">Team 1</option>
                        <option value="goalkeeper">Goalkeepers</option>
                    </select>
                    <select
                        id="select-detail-level"
                        className="select"
                        value={detailLevel}
                        onChange={e => setDetailLevel(e.target.value)}
                    >
                        <option value="full">Full Details</option>
                        <option value="compact">Compact</option>
                    </select>
                </div>
            </div>

            {/* Ball chips */}
            {ballDetections.length > 0 && (
                <div className="ball-strip">
                    <span className="section-label" style={{ color: "#ca8a04", margin: 0 }}>⚽ Ball</span>
                    {ballDetections.map(det => (
                        <div key={`ball-${det.player_id}`} className="ball-chip">
                            <span className="ball-emoji">⚽</span>
                            <span className="ball-conf">
                                Conf: {det.confidence != null
                                    ? `${(det.confidence * 100).toFixed(0)}%`
                                    : "—"}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Player cards */}
            {filteredPlayers.length > 0 ? (
                <div className="players-grid">
                    {filteredPlayers.map(det => {
                        const key = `${det.role}-${det.player_id}-${det.team_id}`;
                        return (
                            <PlayerCard
                                key={key}
                                det={det}
                                isVisible={currentIds.has(key)}
                                detailLevel={detailLevel}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="pg-empty">No tracked players match the current filter.</div>
            )}
        </div>
    );
}
