import React, { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import VideoCanvas from "./components/VideoCanvas";
import MatchStats    from "./components/MatchStats";
import PlayerGrid    from "./components/PlayerGrid";

const WS_URL = "ws://localhost:8765";

export default function App() {
    /* ── State ─────────────────────────────────────────── */
    const [frames,          setFrames]          = useState([]);
    const [frameIdx,        setFrameIdx]        = useState(0);
    const [play,            setPlay]            = useState(false);
    const [live,            setLive]            = useState(true);
    const [wsStatus,        setWsStatus]        = useState("connecting");
    const [llmSummary,      setLlmSummary]      = useState("");
    const [completedVideos, setCompletedVideos] = useState([]);
    const [streamDone,      setStreamDone]      = useState(false);
    const [playerFilter,    setPlayerFilter]    = useState("all");
    const [detailLevel,     setDetailLevel]     = useState("full");
    const [overlays,        setOverlays]        = useState({
        detections:        true,
        fatigue:           true,
        goal_prob:         true,
        match_outcome:     true,
        movement_features: true,
    });

    const wsRef              = useRef(null);
    const playBackSpeed      = useRef(50);
    const playerRegistryRef  = useRef({});
    const [playerRegistry,   setPlayerRegistry] = useState({});

    /* ── WebSocket (auto-reconnect) ────────────────────── */
    useEffect(() => {
        let cancelled = false;

        function connect() {
            if (cancelled) return;
            setWsStatus("connecting");
            const ws = new window.WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen  = () => !cancelled && setWsStatus("connected");
            ws.onclose = () => {
                if (!cancelled) {
                    setWsStatus("disconnected");
                    setTimeout(connect, 3000);          // retry
                }
            };
            ws.onerror = () => { /* absorbed by onclose */ };

            ws.onmessage = async (event) => {
                let text;
                if (typeof event.data === "string")       text = event.data;
                else if (event.data instanceof Blob)      text = await event.data.text();
                else return;

                try {
                    const data = JSON.parse(text);
                    if (data.type === "frame") {
                        setFrames(prev => [...prev, data]);
                    } else if (data.type === "llm_summary") {
                        setLlmSummary(data.text || "");
                    } else if (data.type === "video_complete") {
                        setCompletedVideos(prev => [
                            ...prev,
                            { filename: data.filename, total_frames: data.total_frames, timestamp: data.timestamp },
                        ]);
                        setStreamDone(true);
                    }
                } catch (_) { /* ignore invalid JSON */ }
            };
        }

        connect();
        return () => {
            cancelled = true;
            wsRef.current && wsRef.current.close();
        };
    }, []);

    /* ── Live follow ───────────────────────────────────── */
    useEffect(() => {
        if (live && frames.length > 0) setFrameIdx(frames.length - 1);
    }, [live, frames.length]);

    /* ── Sequential playback ───────────────────────────── */
    useEffect(() => {
        if (!play || live) return;
        const id = setInterval(() => {
            setFrameIdx(idx => idx < frames.length - 1 ? idx + 1 : idx);
        }, playBackSpeed.current);
        return () => clearInterval(id);
    }, [play, live, frames.length]);

    /* ── Overlay toggle ────────────────────────────────── */
    const handleOverlayChange = useCallback(
        key => setOverlays(o => ({ ...o, [key]: !o[key] })),
        []
    );

    /* ── Current frame shorthand ───────────────────────── */
    const current         = frames[frameIdx] || {};
    const matchOutcome    = current.match_outcome    || {};
    const movementFeats   = current.movement_features || {};

    /* ── Player registry (persistent across frames) ────── */
    useEffect(() => {
        const dets = current.detections;
        if (!Array.isArray(dets) || dets.length === 0) return;
        const reg = { ...playerRegistryRef.current };
        let changed = false;
        for (const det of dets) {
            if (det.role === "referee") continue;
            const key = det.role === "ball"
                ? `ball-${det.player_id}`
                : `${det.role}-${det.player_id}-${det.team_id}`;
            reg[key] = { ...det, _lastSeen: current.frame_id };
            changed = true;
        }
        if (changed) {
            playerRegistryRef.current = reg;
            setPlayerRegistry({ ...reg });
        }
    }, [frameIdx]); // eslint-disable-line react-hooks/exhaustive-deps

    const registryValues  = Object.values(playerRegistry);
    const ballDetections  = registryValues.filter(d => d.role === "ball");
    const playerDets      = registryValues
        .filter(d => d.role !== "ball")
        .sort((a, b) => (a.team_id - b.team_id) || (a.player_id - b.player_id));

    const filteredPlayers = playerDets.filter(d => {
        if (playerFilter === "all")        return true;
        if (playerFilter === "team0")      return d.team_id === 0;
        if (playerFilter === "team1")      return d.team_id === 1;
        if (playerFilter === "goalkeeper") return d.role === "goalkeeper";
        return true;
    });

    const currentIds = new Set(
        (current.detections || [])
            .filter(d => d.role !== "referee")
            .map(d => d.role === "ball"
                ? `ball-${d.player_id}`
                : `${d.role}-${d.player_id}-${d.team_id}`)
    );

    /* ── Overlay label map ─────────────────────────────── */
    const overlayLabels = {
        detections:        "Detections",
        fatigue:           "Fatigue",
        goal_prob:         "Goal Prob",
        match_outcome:     "Match State",
        movement_features: "Movement",
    };

    /* ── Connection badge ──────────────────────────────── */
    const connLabel = { connecting: "Connecting…", connected: "Connected", disconnected: "Disconnected" };

    /* ── Render ────────────────────────────────────────── */
    return (
        <div className="app">

            {/* ════════════ HEADER ════════════ */}
            <header className="app-header">
                <div className="header-brand">
                    <span className="header-logo-icon">⚽</span>
                    <div>
                        <div className="header-app-name">MatchIQ</div>
                        <div className="header-app-sub">Football AI Analytics</div>
                    </div>
                </div>

                <div className="header-center">
                    {wsStatus === "connected" && frames.length > 0 && (
                        <div className="live-badge">
                            <span className="live-dot" />
                            LIVE
                        </div>
                    )}
                </div>

                <div className="header-right">
                    <div className={`conn-badge conn-${wsStatus}`}>
                        <span className="conn-dot" />
                        {connLabel[wsStatus]}
                    </div>
                    {frames.length > 0 && (
                        <div className="frame-badge">
                            <strong>{frames.length}</strong> frames{streamDone ? " ✓" : ""}
                        </div>
                    )}
                </div>
            </header>

            {/* ════════════ MAIN BODY ════════════ */}
            <div className="app-body">

                {/* ── Video column ── */}
                <section className="video-col">
                    <div className="card video-card">

                        {/* Canvas */}
                        <div className="video-canvas-wrap">
                            <VideoCanvas
                                frame={current}
                                overlays={overlays}
                                width={960}
                                height={540}
                            />
                        </div>

                        {/* Controls */}
                        <div className="controls-bar">
                            <div className="controls-left">
                                <button
                                    id="btn-play-pause"
                                    className={`btn ${play && !live ? "play-btn" : ""}`}
                                    onClick={() => { setLive(false); setPlay(p => !p); }}
                                    title="Play / Pause"
                                >
                                    {play && !live ? "⏸ Pause" : "▶ Play"}
                                </button>
                                <button
                                    id="btn-live"
                                    className={`btn ${live ? "live-btn active" : ""}`}
                                    onClick={() => { setPlay(false); setLive(true); }}
                                >
                                    <span className={live ? "live-dot" : ""} style={!live ? { display: "none" } : {}} />
                                    ⏺ Live
                                </button>
                                <select
                                    id="select-speed"
                                    className="select"
                                    defaultValue={50}
                                    onChange={e => { playBackSpeed.current = Number(e.target.value); }}
                                >
                                    <option value={200}>0.25×</option>
                                    <option value={100}>0.5×</option>
                                    <option value={50}>1×</option>
                                    <option value={25}>2×</option>
                                    <option value={12}>4×</option>
                                </select>
                            </div>

                            <div className="timeline-wrap">
                                <div className="timeline-meta">
                                    <span>Frame {frameIdx + 1} / {frames.length}</span>
                                    {live
                                        ? <span className="tl-status">● LIVE</span>
                                        : streamDone
                                            ? <span className="tl-status">✓ Complete</span>
                                            : null
                                    }
                                </div>
                                <input
                                    id="timeline-slider"
                                    type="range"
                                    className="slider"
                                    min={0}
                                    max={Math.max(frames.length - 1, 0)}
                                    value={frameIdx}
                                    onChange={e => {
                                        setLive(false);
                                        setPlay(false);
                                        setFrameIdx(Number(e.target.value));
                                    }}
                                />
                            </div>
                        </div>

                        {/* Overlay toggles */}
                        <div className="overlay-row">
                            <span className="section-label">Overlays</span>
                            <div className="pill-group">
                                {Object.entries(overlayLabels).map(([key, label]) => (
                                    <label key={key} id={`overlay-${key}`} className={`pill ${overlays[key] ? "active" : ""}`}>
                                        <input
                                            type="checkbox"
                                            checked={overlays[key]}
                                            onChange={() => handleOverlayChange(key)}
                                            style={{ display: "none" }}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* LLM summary */}
                    {llmSummary && (
                        <div className="card llm-card fade-in">
                            <div className="section-label">🤖 AI Commentary</div>
                            <p className="llm-body">{llmSummary}</p>
                        </div>
                    )}

                    {/* Completed videos */}
                    {completedVideos.length > 0 && (
                        <div className="card completed-card fade-in">
                            <div className="section-label">✅ Completed Sessions</div>
                            <div className="completed-list">
                                {completedVideos.map((v, i) => (
                                    <div key={i} className="completed-item">
                                        <span className="completed-icon">🎬</span>
                                        <div>
                                            <div className="completed-name">{v.filename}</div>
                                            <div className="completed-meta">{v.total_frames} frames</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* ── Analytics sidebar ── */}
                <aside className="analytics-col">
                    <MatchStats
                        matchOutcome={matchOutcome}
                        movementFeatures={movementFeats}
                        frameId={current.frame_id}
                        detectionsCount={current.detections?.length ?? 0}
                    />
                </aside>
            </div>

            {/* ════════════ PLAYER GRID ════════════ */}
            <section className="player-section">
                <PlayerGrid
                    filteredPlayers={filteredPlayers}
                    ballDetections={ballDetections}
                    playerFilter={playerFilter}
                    setPlayerFilter={setPlayerFilter}
                    detailLevel={detailLevel}
                    setDetailLevel={setDetailLevel}
                    currentIds={currentIds}
                />
            </section>

        </div>
    );
}
