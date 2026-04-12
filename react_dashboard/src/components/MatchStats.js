import React from "react";

/* ── helpers ─────────────────────────────────────────────── */
function fv(val, digits = 1) {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(digits);
    return String(val);
}

/* Percent VS bar: both values should sum to ~100 */
function StatBar({ label, val0 = 50, val1 = 50, color0 = "#3b82f6", color1 = "#f43f5e" }) {
    const sum  = (val0 + val1) || 1;
    const pct0 = (val0 / sum) * 100;
    const pct1 = (val1 / sum) * 100;
    return (
        <div className="vs-row">
            <div className="vs-row-head">
                <span className="vs-num" style={{ color: color0 }}>{fv(val0)}%</span>
                <span className="vs-rowlabel">{label}</span>
                <span className="vs-num right" style={{ color: color1 }}>{fv(val1)}%</span>
            </div>
            <div className="vs-bar">
                <div className="vs-bar-seg" style={{ width: `${pct0}%`, background: color0 }} />
                <div className="vs-bar-seg" style={{ width: `${pct1}%`, background: color1 }} />
            </div>
        </div>
    );
}

/* ── component ──────────────────────────────────────────── */
export default function MatchStats({ matchOutcome, movementFeatures, frameId, detectionsCount }) {
    const mo = matchOutcome || {};
    const mf = movementFeatures || {};

    const win0 = mo.win_prob_team0 ?? 33.3;
    const draw = mo.draw_prob      ?? 33.3;
    const win1 = mo.win_prob_team1 ?? 33.3;

    return (
        <>
            {/* ── Session info ─────────────────────── */}
            <div className="card stats-card">
                <div className="section-label">Session</div>
                <div className="info-grid">
                    <div className="info-item">
                        <div className="info-val">{frameId ?? "—"}</div>
                        <div className="info-key">Frame</div>
                    </div>
                    <div className="info-item">
                        <div className="info-val">{detectionsCount}</div>
                        <div className="info-key">Detections</div>
                    </div>
                    <div className="info-item">
                        <div className="info-val">{fv(mf.avg_speed)}</div>
                        <div className="info-key">Avg Speed</div>
                    </div>
                    <div className="info-item">
                        <div className="info-val">{mf.sprint_count ?? "—"}</div>
                        <div className="info-key">Sprints</div>
                    </div>
                </div>
            </div>

            {/* ── Team comparison ──────────────────── */}
            <div className="card stats-card">
                {/* Team header */}
                <div className="team-header">
                    <div className="team-tag">
                        <span className="team-dot" style={{ background: "#3b82f6" }} />
                        Team 0
                    </div>
                    <div className="vs-badge">VS</div>
                    <div className="team-tag">
                        Team 1
                        <span className="team-dot" style={{ background: "#f43f5e" }} />
                    </div>
                </div>

                {/* VS bars */}
                <div className="vs-list">
                    <StatBar label="Possession" val0={mo.possession_team0} val1={mo.possession_team1} />
                    <StatBar label="Territory"  val0={mo.territory_team0}  val1={mo.territory_team1}  />
                    <StatBar label="Momentum"   val0={mo.momentum_team0}   val1={mo.momentum_team1}   />
                </div>

                {/* Shots */}
                <div className="divider-row">
                    <div className="dr-val" style={{ color: "#3b82f6" }}>{mo.shots_team0 ?? 0}</div>
                    <div className="dr-label">Shots on Target</div>
                    <div className="dr-val" style={{ color: "#f43f5e" }}>{mo.shots_team1 ?? 0}</div>
                </div>

                {/* Avg Danger */}
                <div className="divider-row" style={{ paddingTop: 10, marginTop: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6", minWidth: 40, textAlign: "center" }}>
                        {fv(mo.avg_danger_team0, 3)}
                    </div>
                    <div className="dr-label">Avg Danger</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f43f5e", minWidth: 40, textAlign: "center" }}>
                        {fv(mo.avg_danger_team1, 3)}
                    </div>
                </div>
            </div>

            {/* ── Win probability ──────────────────── */}
            <div className="card win-card">
                <div className="section-label">Win Probability</div>
                <div className="win-bar">
                    <div
                        className="win-seg"
                        style={{
                            width: `${win0}%`,
                            background: "linear-gradient(90deg, #1d4ed8, #3b82f6)",
                            borderRadius: "6px 0 0 6px",
                        }}
                    >
                        {win0 > 10 && <span>{fv(win0)}%</span>}
                    </div>
                    <div
                        className="win-seg"
                        style={{ width: `${draw}%`, background: "#4b5563" }}
                    >
                        {draw > 9 && <span>{fv(draw)}%</span>}
                    </div>
                    <div
                        className="win-seg"
                        style={{
                            width: `${win1}%`,
                            background: "linear-gradient(90deg, #be123c, #f43f5e)",
                            borderRadius: "0 6px 6px 0",
                        }}
                    >
                        {win1 > 10 && <span>{fv(win1)}%</span>}
                    </div>
                </div>
                <div className="win-labels">
                    <span style={{ color: "#3b82f6" }}>Team 0 Win</span>
                    <span>Draw</span>
                    <span style={{ color: "#f43f5e" }}>Team 1 Win</span>
                </div>
            </div>
        </>
    );
}
