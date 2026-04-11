import React, { use, useEffect, useRef, useState } from "react";
import VideoCanvas from "./components/VideoCanvas";

const WS_URL = "ws://localhost:8765";

function formatValue(value) {
    if (value === null || value === undefined) {
        return "-";
    }
    if (typeof value === "number") {
        return Number.isInteger(value) ? `${value}` : value.toFixed(3);
    }
    if (typeof value === "string") {
        return value;
    }
    return JSON.stringify(value, null, 2);
}

function renderPlayerCard(det) {
    const fatigue = det.fatigue || {};
    const movement = det.movement || {};
    const goal = det.goal_probability || {};

    return (
        <div
            key={`${det.role}-${det.player_id}-${det.team_id}`}
            style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafafa" }}
        >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {det.role === "ball" ? "Ball" : `#${det.player_id} ${det.role}`}
            </div>
            <div>Team: {formatValue(det.team_id)}</div>
            <div>Confidence: {formatValue(det.confidence)}</div>
            {det.role !== "ball" && (
                <>
                    <div>Fatigue: {formatValue(fatigue.fatigue_level)} ({formatValue(fatigue.fatigue_score)})</div>
                    <div>Speed: {formatValue(movement.speed)}</div>
                    <div>Acceleration: {formatValue(movement.acceleration)}</div>
                    <div>Goal Probability: {formatValue(goal.goal_probability)}</div>
                </>
            )}
        </div>
    );
}

export default function App() {
    const [frames, setFrames] = useState([]);
    const [frameIdx, setFrameIdx] = useState(0);
    const [play, setPlay] = useState(false);
    const [live, setLive] = useState(true);
    const [overlays, setOverlays] = useState({
        detections: true,
        fatigue: true,
        goal_prob: true,
        match_outcome: true,
        movement_features: true,
    });
    const [llmSummary, setLlmSummary] = useState("");
    const [completedVideos, setCompletedVideos] = useState([]);
    const [streamDone, setStreamDone] = useState(false);
    const [playerFilter, setPlayerFilter] = useState("all"); // "all" | "team0" | "team1" | "goalkeeper"
    const [detailLevel, setDetailLevel] = useState("full"); // "full" | "compact"
    const wsRef = useRef(null);
    const liveRef = useRef(live);
    const playRef = useRef(play);
    const playBackSpeed = useRef(50); // ms per frame for playback
    const playerRegistryRef = useRef({}); // persistent map: key -> latest detection
    const [playerRegistry, setPlayerRegistry] = useState({}); // triggers re-render on updates

    // WebSocket connection
    useEffect(() => {
        wsRef.current = new window.WebSocket(WS_URL);
        wsRef.current.onmessage = async (event) => {
            let text;
            if (typeof event.data === "string") {
                text = event.data;
            } else if (event.data instanceof Blob) {
                text = await event.data.text();
            } else {
                return;
            }
            const data = JSON.parse(text);
            if (data.type === "frame") {
                setFrames((prev) => [...prev, data]);
            } else if (data.type === "llm_summary") {
                setLlmSummary(data.text || "");
            } else if (data.type === "video_complete") {
                setCompletedVideos((prev) => [
                    ...prev,
                    { filename: data.filename, total_frames: data.total_frames, timestamp: data.timestamp },
                ]);
                setStreamDone(true);
            }
        };
        return () => wsRef.current && wsRef.current.close();
        // eslint-disable-next-line
    }, []);

    // Live follow: when live mode is on, snap to the latest frame as they arrive
    useEffect(() => {
        liveRef.current = live;
        if (live && frames.length > 0) {
            setFrameIdx(frames.length - 1);
        }
    }, [live, frames.length]);

    // Sequential playback: advance one frame per tick when playing (not live)
    useEffect(() => {
        playRef.current = play;

        if (!play || live) return;
        const interval = setInterval(() => {
            setFrameIdx((idx) => {
                if (idx < frames.length - 1) return idx + 1;
                return idx;
            });
        }, playBackSpeed.current);
        return () => clearInterval(interval);
    }, [play, live, frames.length]);

    // Overlay toggles
    const handleOverlayChange = (key) =>
        setOverlays((o) => ({ ...o, [key]: !o[key] }));

    const current = frames[frameIdx] || {};

    // Merge current frame detections into persistent registry
    useEffect(() => {
        const detections = current.detections;
        if (!Array.isArray(detections) || detections.length === 0) return;
        const reg = { ...playerRegistryRef.current };
        let changed = false;
        for (const det of detections) {
            if (det.role === "referee") continue;
            const key = det.role === "ball" ? `ball-${det.player_id}` : `${det.role}-${det.player_id}-${det.team_id}`;
            reg[key] = { ...det, _lastSeen: current.frame_id };
            changed = true;
        }
        if (changed) {
            playerRegistryRef.current = reg;
            setPlayerRegistry({ ...reg });
        }
    }, [frameIdx]); // eslint-disable-line react-hooks/exhaustive-deps

    const registryValues = Object.values(playerRegistry);
    const ballDetections = registryValues.filter((d) => d.role === "ball");
    const playerDetections = registryValues.filter((d) => d.role !== "ball");
    // Sort by team then player_id so card order is stable
    playerDetections.sort((a, b) => (a.team_id - b.team_id) || (a.player_id - b.player_id));
    const filteredPlayers = playerDetections.filter((det) => {
        if (playerFilter === "all") return true;
        if (playerFilter === "team0") return det.team_id === 0;
        if (playerFilter === "team1") return det.team_id === 1;
        if (playerFilter === "goalkeeper") return det.role === "goalkeeper";
        return true;
    });
    // Check if a player is currently visible in this frame
    const currentIds = new Set(
        (current.detections || []).filter(d => d.role !== "referee").map(d =>
            d.role === "ball" ? `ball-${d.player_id}` : `${d.role}-${d.player_id}-${d.team_id}`
        )
    );

    return (
        <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24 }}>
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <h2 style={{ marginTop: 0 }}>Real-Time CV Dashboard</h2>
                    <div style={{ background: "#ffffff", borderRadius: 18, padding: 16, boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)" }}>
                        <VideoCanvas
                            frame={current}
                            overlays={overlays}
                            width={960}
                            height={540}
                        />
                        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                            <button
                                onClick={() => { setLive(false); setPlay(!play); }}
                                style={{ padding: "4px 8px", borderRadius: 6, fontWeight: play && !live ? 700 : 20 }}
                            >
                                {(play && !live) ? "⏸" : (!play && !live) ? "▶" : "⏸"}
                            </button>
                            <button
                                onClick={() => { setPlay(false); setLive(true); }}
                                style={{ padding: "4px 8px", borderRadius: 6, fontWeight: live ? 700 : 400, color: live ? "#16a34a" : undefined }}
                            >
                                ⏺ Live
                            </button>
                            <select
                                value={playBackSpeed.current}
                                onChange={(e) => { playBackSpeed.current = Number(e.target.value); }}
                                style={{ padding: "4px 8px", borderRadius: 6 }}
                            >
                                <option value={200}>0.25x</option>
                                <option value={100}>0.5x</option>
                                <option value={50}>1x</option>
                                <option value={25}>2x</option>
                                <option value={12}>4x</option>
                            </select>
                            <input
                                type="range"
                                min={0}
                                max={Math.max(frames.length - 1, 0)}
                                value={frameIdx}
                                onChange={(e) => { setLive(false); setPlay(false); setFrameIdx(Number(e.target.value)); }}
                                style={{ flex: 1, minWidth: 220 }}
                            />
                            <span style={{ fontSize: 13, color: "#6b7280" }}>
                                {frameIdx + 1} / {frames.length}{live ? " (LIVE)" : streamDone ? " (Complete)" : ""}
                            </span>
                            {Object.keys(overlays).map((key) => (
                                <label key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input
                                        type="checkbox"
                                        checked={overlays[key]}
                                        onChange={() => handleOverlayChange(key)}
                                    />
                                    {key.replace(/_/g, " ")}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <aside style={{ width: 360, maxHeight: "calc(100vh - 48px)", overflowY: "auto", background: "#ffffff", borderRadius: 18, padding: 18, boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)" }}>
                    <h3 style={{ marginTop: 0 }}>Live Analytics</h3>
                    <div>Frame: {formatValue(current.frame_id)}</div>
                    <div>Detections: {formatValue(current.detections?.length || 0)}</div>
                    <div>Average Speed: {formatValue(current.movement_features?.avg_speed)}</div>
                    <div>Sprints: {formatValue(current.movement_features?.sprint_count)}</div>
                    <div style={{ marginTop: 14, fontWeight: 700 }}>Match State</div>
                    <div>Possession: {formatValue(current.match_outcome?.possession_team0)}% / {formatValue(current.match_outcome?.possession_team1)}%</div>
                    <div>Shots: {formatValue(current.match_outcome?.shots_team0)} / {formatValue(current.match_outcome?.shots_team1)}</div>
                    <div>Danger: {formatValue(current.match_outcome?.avg_danger_team0)} / {formatValue(current.match_outcome?.avg_danger_team1)}</div>
                    <div>Territory: {formatValue(current.match_outcome?.territory_team0)} / {formatValue(current.match_outcome?.territory_team1)}</div>
                    <div>Momentum: {formatValue(current.match_outcome?.momentum_team0)} / {formatValue(current.match_outcome?.momentum_team1)}</div>
                    <div>Win: T1%  v  T2%  :  {formatValue(current.match_outcome?.win_prob_team0)}%  v  {formatValue(current.match_outcome?.win_prob_team1)}%</div>
                    <div>Draw%: {formatValue(current.match_outcome?.draw_prob)}%</div>

                    <div style={{ marginTop: 18, fontWeight: 700 }}>Events</div>
                    <pre style={{ maxHeight: 120, overflow: "auto", background: "#f9fafb", padding: 12, borderRadius: 10 }}>
                        {formatValue(current.events || [])}
                    </pre>

                    <div style={{ marginTop: 18, fontWeight: 700 }}>LLM Summary</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{llmSummary || "No summary yet."}</div>

                    {completedVideos.length > 0 && (
                        <>
                            <div style={{ marginTop: 18, fontWeight: 700 }}>Completed Videos</div>
                            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                                {completedVideos.map((v, i) => (
                                    <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#f0fdf4" }}>
                                        <div style={{ fontWeight: 600 }}>{v.filename}</div>
                                        <div style={{ fontSize: 13, color: "#6b7280" }}>{v.total_frames} frames</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </aside>
            </div>

            {/* Tracked Objects Panel */}
            <div style={{ marginTop: 24, background: "#ffffff", borderRadius: 18, padding: 18, boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                    <h3 style={{ margin: 0 }}>Tracked Objects</h3>
                    <select
                        value={playerFilter}
                        onChange={(e) => setPlayerFilter(e.target.value)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
                    >
                        <option value="all">All Players</option>
                        <option value="team0">Team 0</option>
                        <option value="team1">Team 1</option>
                        <option value="goalkeeper">Goalkeepers</option>
                    </select>
                    <select
                        value={detailLevel}
                        onChange={(e) => setDetailLevel(e.target.value)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
                    >
                        <option value="full">Full Details</option>
                        <option value="compact">Compact</option>
                    </select>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                        Showing {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} + {ballDetections.length} ball{ballDetections.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Ball — always visible */}
                {ballDetections.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#ca8a04", marginBottom: 6 }}>Ball</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                            {ballDetections.map((det) => (
                                <div
                                    key={`ball-${det.player_id}`}
                                    style={{ border: "2px solid #eab308", borderRadius: 12, padding: 12, background: "#fefce8" }}
                                >
                                    <div style={{ fontWeight: 700 }}>Ball</div>
                                    <div>Confidence: {formatValue(det.confidence)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Players — filtered */}
                {filteredPlayers.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
                        {filteredPlayers.map((det) => {
                            const fatigue = det.fatigue || {};
                            const movement = det.movement || {};
                            const goal = det.goal_probability || {};
                            const teamColor = det.team_id === 0 ? "#3b82f6" : det.team_id === 1 ? "#ec4899" : "#9ca3af";
                            const key = `${det.role}-${det.player_id}-${det.team_id}`;
                            const isVisible = currentIds.has(key);
                            return (
                                <div
                                    key={key}
                                    style={{
                                        border: `2px solid ${teamColor}`,
                                        borderRadius: 12,
                                        padding: 12,
                                        background: isVisible ? "#fafafa" : "#f3f4f6",
                                        opacity: isVisible ? 1 : 0.5,
                                        transition: "opacity 0.3s, background 0.3s",
                                    }}
                                >
                                    <div style={{ fontWeight: 700, marginBottom: 4, color: teamColor, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>#{det.player_id} {det.role}</span>
                                        {!isVisible && <span style={{ fontSize: 10, color: "#9ca3af" }}>off-screen</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#6b7280" }}>Team {formatValue(det.team_id)}</div>
                                    {detailLevel === "full" && (
                                        <>
                                            <div>Confidence: {formatValue(det.confidence)}</div>
                                            <div>Fatigue: {formatValue(fatigue.fatigue_level)} ({formatValue(fatigue.fatigue_score)})</div>
                                            <div>Speed: {formatValue(movement.speed)}</div>
                                            <div>Accel: {formatValue(movement.acceleration)}</div>
                                            <div>Goal Prob: {formatValue(goal.goal_probability)}</div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ color: "#9ca3af" }}>No tracked players match the current filter.</div>
                )}
            </div>
        </div>
    );
}
