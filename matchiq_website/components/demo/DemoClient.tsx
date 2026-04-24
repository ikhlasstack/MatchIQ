"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, CheckCircle, Loader2, Download, FileText, Film, ChevronRight, AlertCircle,
  Radio, Square,
} from "lucide-react";
import FatigueChart from "./tabs/FatigueChart";
import GoalProbChart from "./tabs/GoalProbChart";
import MatchOutcomeChart from "./tabs/MatchOutcomeChart";
import PitchRadar from "./tabs/PitchRadar";
import VideoTab from "./tabs/VideoTab";
import PlayerNamingModal, { type NamesMap } from "./PlayerNamingModal";

const API = "http://localhost:8000";

/* ── Types ────────────────────────────────────────────────────────────────── */
type Stage = "idle" | "uploading" | "processing" | "cancelling" | "cancelled" | "done" | "error";
type TabId = "video" | "fatigue" | "goal" | "outcome";

export type FatigueRow = { label: string; score: number; level: string; team: number };
export type GoalProbRow = { frame: number; t0: number; t1: number };
export type OutcomeData = {
  winA: number; draw: number; winB: number;
  possession: { t0: number; t1: number };
  shots: { t0: number; t1: number };
  territory: { t0: number; t1: number };
  momentum: { t0: number; t1: number };
};
export type TrackingRow = { id: number; team: number; role: string; x: number; y: number };
export type AllTrackingData = { fps: number; total_frames: number; frames: Record<string, TrackingRow[]> };

const PROCESSING_STEPS = [
  "Uploading footage…",
  "Detecting & tracking players…",
  "Computing movement & fatigue…",
  "Predicting match outcome…",
];

const TABS: { id: TabId; label: string }[] = [
  { id: "video", label: "Tracked Video" },
  { id: "fatigue", label: "Player Fatigue" },
  { id: "goal", label: "Goal Probability" },
  { id: "outcome", label: "Match Outcome" },
];

type StreamStatus = "idle" | "resolving" | "streaming" | "stopped";

/* ── Real-Time Mode Panel ─────────────────────────────────────────────────── */
function RealTimeModePanel({
  ws, onPositions, annotRef, onFirstFrame, onFrame,
}: {
  ws: WebSocket | null;
  onPositions: (rows: TrackingRow[]) => void;
  annotRef: React.RefObject<HTMLCanvasElement | null>;
  onFirstFrame: () => void;
  onFrame: (b64: string) => void;
}) {
  const [url,    setUrl]    = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error,  setError]  = useState("");

  // Handle messages from server
  useEffect(() => {
    if (!ws) return;
    const handler = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "rt_frame" && msg.image) {
          onFrame(msg.image as string);   // parent handles buffering + canvas draw
          onFirstFrame();
        }
        if (msg.type === "rt_status") setStatus(msg.status as StreamStatus);
        if (msg.type === "rt_error")  { setError(msg.detail ?? "Server error"); setStatus("idle"); }
        if (msg.type === "positions" && Array.isArray(msg.rows)) onPositions(msg.rows as TrackingRow[]);
      } catch { /* ignore */ }
    };
    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [ws, onPositions, annotRef]);

  const start = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) { setError("WebSocket not connected"); return; }
    if (!url.trim()) { setError("Enter a stream URL"); return; }
    setError("");
    setStatus("resolving");
    ws.send(JSON.stringify({ type: "yt_start", url: url.trim() }));
  };

  const stop = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "yt_stop" }));
    setStatus("stopped");
  };

  const canStart = !!url.trim() && !!ws && status !== "resolving" && status !== "streaming";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600 }}>
        Live Stream Analysis
      </p>
      <p style={{ fontSize: "0.78rem", color: "#555", lineHeight: 1.5 }}>
        Paste a YouTube, Twitch, or any streamlink-compatible URL. Live streams and VODs both work.
      </p>

      {/* URL input */}
      <input
        type="text"
        value={url}
        onChange={e => { setUrl(e.target.value); setError(""); }}
        onKeyDown={e => e.key === "Enter" && canStart && start()}
        placeholder="https://youtube.com/watch?v=..."
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "0.65rem 0.85rem", borderRadius: "0.65rem",
          background: "#0a0a0a", border: "1px solid #2a2a2a",
          color: "#fff", fontSize: "0.82rem", outline: "none",
          fontFamily: "inherit",
        }}
      />

      {/* Status indicator */}
      {status !== "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {status === "resolving" && <Loader2 size={13} style={{ color: "#D4AF37", animation: "spin 1s linear infinite", flexShrink: 0 }} />}
          {status === "streaming" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} />}
          {status === "stopped"   && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#555", display: "inline-block", flexShrink: 0 }} />}
          <span style={{ fontSize: "0.78rem", color: status === "streaming" ? "#22c55e" : status === "resolving" ? "#D4AF37" : "#555" }}>
            {status === "resolving" ? "Resolving stream URL…" : status === "streaming" ? "Streaming" : "Stopped"}
          </span>
        </div>
      )}

      {/* Error */}
      {error && <p style={{ fontSize: "0.78rem", color: "#ef4444" }}>{error}</p>}

      {/* Start / Stop */}
      {status !== "streaming" ? (
        <button onClick={start} disabled={!canStart}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "0.7rem", borderRadius: "0.75rem", background: canStart ? "#D4AF37" : "#1a1a1a", color: canStart ? "#000" : "#444", fontWeight: 700, fontSize: "0.875rem", border: "none", cursor: canStart ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
          <Radio size={15} /> Analyse Stream
        </button>
      ) : (
        <button onClick={stop}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "0.7rem", borderRadius: "0.75rem", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700, fontSize: "0.875rem", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}>
          <Square size={13} /> Stop
        </button>
      )}

      <p style={{ fontSize: "0.7rem", color: "#333", lineHeight: 1.5 }}>
        Requires <code style={{ color: "#555" }}>streamlink</code> or <code style={{ color: "#555" }}>yt-dlp</code> installed on the server.
      </p>
    </div>
  );
}

/* ── Upload Panel ─────────────────────────────────────────────────────────── */
function UploadPanel({
  stage, doneSteps, fileName, errorMsg, savedMatchId, onFile, onReset, onCancel,
}: {
  stage: Stage; doneSteps: number; fileName: string;
  errorMsg: string; savedMatchId: string | null;
  onFile: (f: File) => void; onReset: () => void; onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Drop zone */}
      <div
        onClick={() => stage === "idle" && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${drag ? "#D4AF37" : stage !== "idle" ? "#2a2a2a" : "rgba(212,175,55,0.35)"}`,
          borderRadius: "1rem", padding: "2.5rem 1.5rem", textAlign: "center",
          cursor: stage === "idle" ? "pointer" : "default",
          background: drag ? "rgba(212,175,55,0.04)" : "rgba(255,255,255,0.015)",
          transition: "all 0.3s",
        }}
      >
        <input ref={inputRef} type="file" accept=".mp4,.avi,.mov" style={{ display: "none" }}
          onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />

        {stage === "idle" ? (
          <>
            <div style={{ width: "3.5rem", height: "3.5rem", borderRadius: "50%", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <Upload size={22} style={{ color: "#D4AF37" }} />
            </div>
            <p style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Drop your match video here
            </p>
            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "1rem" }}>or click to browse</p>
            <p style={{ fontSize: "0.7rem", color: "#555" }}>MP4 · AVI · MOV &nbsp;·&nbsp; Max 2 GB</p>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "center" }}>
            <Film size={18} style={{ color: "#D4AF37" }} />
            <span style={{ fontSize: "0.9rem", color: "#D4AF37", fontWeight: 600, wordBreak: "break-all" }}>
              {fileName}
            </span>
          </div>
        )}
      </div>

      {/* Processing steps */}
      <AnimatePresence>
        {(stage === "processing" || stage === "cancelling" || stage === "done" || stage === "uploading") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1rem", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600 }}>
              Processing
            </p>
            {PROCESSING_STEPS.map((label, i) => {
              const done = i < doneSteps;
              const current = i === doneSteps && stage !== "done";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {done
                    ? <CheckCircle size={18} style={{ color: "#22c55e", flexShrink: 0 }} />
                    : current
                      ? <Loader2 size={18} style={{ color: "#D4AF37", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                      : <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #333", flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: "0.875rem", color: done ? "#fff" : current ? "#D4AF37" : "#555" }}>
                    {label}
                  </span>
                </div>
              );
            })}
            {/* Cancel button — only while actively processing */}
            {stage === "processing" && (
              <button
                onClick={onCancel}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "0.25rem", padding: "0.55rem", borderRadius: "0.65rem", background: "transparent", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                ✕ Cancel pipeline
              </button>
            )}
            {stage === "cancelling" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem", borderRadius: "0.65rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Loader2 size={14} style={{ color: "#ef4444", animation: "spin 1s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: "0.8rem", color: "#ef4444" }}>Stopping after current frame…</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancelled state */}
      {stage === "cancelled" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <AlertCircle size={16} style={{ color: "#f87171", flexShrink: 0 }} />
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f87171" }}>Pipeline cancelled</p>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#888" }}>
            Partial data up to the cancellation point has been saved automatically.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {savedMatchId && (
              <button
                onClick={() => window.open(`/gallery/${savedMatchId}`, "_blank")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "0.65rem", borderRadius: "0.65rem", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.35)", color: "#D4AF37", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                View partial match in Gallery
              </button>
            )}
            <button onClick={onReset}
              style={{ fontSize: "0.8rem", color: "#555", textAlign: "center", background: "none", border: "none", cursor: "pointer" }}>
              ↩ Analyse another video
            </button>
          </div>
        </motion.div>
      )}

      {/* Error state */}
      {stage === "error" && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.75rem", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: "1px" }} />
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#ef4444", marginBottom: "0.25rem" }}>Pipeline Error</p>
            <p style={{ fontSize: "0.78rem", color: "#f87171" }}>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Export buttons */}
      <AnimatePresence>
        {stage === "done" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600 }}>
              Export Results
            </p>
            <button
              onClick={() => window.open(`${API}/video/tracked`, "_blank")}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "0.75rem", borderRadius: "0.75rem", background: "#D4AF37", color: "#000", fontWeight: 700, fontSize: "0.875rem", border: "none", cursor: "pointer" }}>
              <Download size={16} /> Download Tracked Video
            </button>
            <button
              onClick={() => window.open(`${API}/download/csv`, "_blank")}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "0.75rem", borderRadius: "0.75rem", background: "transparent", color: "#D4AF37", fontWeight: 600, fontSize: "0.875rem", border: "1px solid rgba(212,175,55,0.4)", cursor: "pointer" }}>
              <FileText size={16} /> Export CSV Data
            </button>
            <button onClick={onReset}
              style={{ fontSize: "0.8rem", color: "#555", textAlign: "center", background: "none", border: "none", cursor: "pointer", paddingTop: "0.25rem" }}>
              ↩ Analyse another video
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type InputMode = "upload" | "realtime";

/* ── Main Demo Client ─────────────────────────────────────────────────────── */
export default function DemoClient() {
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [stage, setStage] = useState<Stage>("idle");
  const [doneSteps, setDoneSteps] = useState(0);
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("fatigue");

  /* Real data from API */
  const [fatigueData, setFatigueData] = useState<FatigueRow[] | null>(null);
  const [goalProbData, setGoalProbData] = useState<GoalProbRow[] | null>(null);
  const [outcomeData, setOutcomeData] = useState<OutcomeData | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingRow[] | null>(null);
  const [allTrackingData, setAllTrackingData] = useState<AllTrackingData | null>(null);
  const [livePositions, setLivePositions] = useState<TrackingRow[] | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isStreaming,   setIsStreaming]   = useState(false);
  const [serverPhase,   setServerPhase]   = useState(0);
  const [savedMatchId,  setSavedMatchId]  = useState<string | null>(null);
  const [showNaming,    setShowNaming]    = useState(false);
  const [names,         setNames]         = useState<NamesMap>({ players: {}, teams: {} });

  const wsRef      = useRef<WebSocket | null>(null);
  const annotRef   = useRef<HTMLCanvasElement | null>(null);
  const rtFrames   = useRef<string[]>([]);          // base64 JPEG buffer for scrubbing
  const [activeWs,        setActiveWs]        = useState<WebSocket | null>(null);
  const [rtLivePositions, setRtLivePositions] = useState<TrackingRow[] | null>(null);
  const [rtHasFrame,      setRtHasFrame]      = useState(false);
  const [rtFrameCount,    setRtFrameCount]    = useState(0);   // drives scrubber max
  const [rtFrameIdx,      setRtFrameIdx]      = useState(0);   // current scrubber position
  const [rtIsLive,        setRtIsLive]        = useState(true);
  const [rtIsPlaying,     setRtIsPlaying]     = useState(false);
  const [rtPlaySpeed,     setRtPlaySpeed]     = useState(50);  // ms between frames

  /* Fetch all results once pipeline is done */
  const fetchResults = useCallback(async () => {
    try {
      const [fat, goal, out, track, allTrack] = await Promise.all([
        fetch(`${API}/results/fatigue`).then(r => r.json()),
        fetch(`${API}/results/goal-prob`).then(r => r.json()),
        fetch(`${API}/results/outcome`).then(r => r.json()),
        fetch(`${API}/results/tracking`).then(r => r.json()),
        fetch(`${API}/results/tracking/frames`).then(r => r.json()),
      ]);
      setFatigueData(fat);
      setGoalProbData(goal);
      setOutcomeData(out);
      setTrackingData(track);
      setAllTrackingData(allTrack);
    } catch (_) {
      /* non-fatal — charts fall back to loading state */
    }
  }, []);

  /* Open WebSocket — persistent in realtime mode, auto-closes on done/error in upload mode */
  const startWS = useCallback((keepAlive = false) => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`ws://localhost:8000/ws`);
    wsRef.current = ws;
    if (keepAlive) setActiveWs(ws);

    ws.onmessage = async (ev) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.type === "positions") {
        if (Array.isArray(msg.rows) && msg.rows.length > 0) {
          if (keepAlive) setRtLivePositions(msg.rows as TrackingRow[]);
          else setLivePositions(msg.rows as TrackingRow[]);
        }
        return;
      }

      // rt_frame and rt_error are handled by RealTimeModePanel's own listener; skip here
      if (msg.type === "rt_frame" || msg.type === "rt_error") return;

      if (msg.type === "status") {
        /* Map phase → doneSteps */
        const phaseToSteps: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3 };
        setDoneSteps(msg.done ? 4 : (phaseToSteps[msg.phase as number] ?? 1));
        setIsStreaming((msg.streaming as boolean) ?? false);
        setServerPhase((msg.phase as number) ?? 0);

        if (!keepAlive) {
          if (msg.error) {
            ws.close();
            setErrorMsg(msg.error as string);
            setStage("error");
          } else if (msg.cancelled) {
            ws.close();
            setStage("cancelled");
            if (msg.match_id) setSavedMatchId(msg.match_id as string);
          } else if (msg.done) {
            ws.close();
            setStage("done");
            await fetchResults();
            if (msg.match_id) {
              setSavedMatchId(msg.match_id as string);
              setShowNaming(true);
            }
          }
        }
      }
    };

    ws.onerror = () => { /* non-fatal */ };
  }, [fetchResults]);

  /* Clear live positions when streaming stops */
  useEffect(() => {
    if (!isStreaming) setLivePositions(null);
  }, [isStreaming]);

  /* Open a persistent WS when switching to realtime mode */
  useEffect(() => {
    if (inputMode === "realtime") {
      startWS(true);
    } else {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setActiveWs(null);
      setRtLivePositions(null);
      setRtHasFrame(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode]);

  /* Cleanup WS on unmount */
  useEffect(() => () => { wsRef.current?.close(); }, []);

  /* Draw frame at rtFrameIdx onto the canvas whenever user scrubs */
  useEffect(() => {
    const b64 = rtFrames.current[rtFrameIdx];
    if (!b64 || !annotRef.current) return;
    const img = new Image();
    img.onload = () => {
      const c = annotRef.current;
      if (!c) return;
      c.width  = img.naturalWidth  || 960;
      c.height = img.naturalHeight || 540;
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    };
    img.src = `data:image/jpeg;base64,${b64}`;
  }, [rtFrameIdx]);

  /* Sequential playback when not live */
  useEffect(() => {
    if (!rtIsPlaying || rtIsLive) return;
    const id = setInterval(() => {
      setRtFrameIdx(i => {
        if (i >= rtFrames.current.length - 1) return i;
        return i + 1;
      });
    }, rtPlaySpeed);
    return () => clearInterval(id);
  }, [rtIsPlaying, rtIsLive, rtPlaySpeed]);

  /* When switching back to live, jump to latest frame */
  const rtGoLive = () => {
    setRtIsPlaying(false);
    setRtIsLive(true);
    setRtFrameIdx(Math.max(0, rtFrames.current.length - 1));
  };

  /* Reset rt buffer when switching modes */
  useEffect(() => {
    if (inputMode !== "realtime") {
      rtFrames.current = [];
      setRtFrameCount(0);
      setRtFrameIdx(0);
      setRtIsLive(true);
      setRtIsPlaying(false);
    }
  }, [inputMode]);

  /* Main flow triggered by file selection */
  const startProcessing = async (file: File) => {
    setFileName(file.name);
    setStage("uploading");
    setDoneSteps(0);
    setFatigueData(null); setGoalProbData(null); setOutcomeData(null); setTrackingData(null);

    try {
      /* 1. Upload */
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch(`${API}/upload`, { method: "POST", body: form });
      if (!upRes.ok) throw new Error("Upload failed");
      setDoneSteps(1);

      /* 2. Start pipeline */
      const runRes = await fetch(`${API}/run`, { method: "POST" });
      if (!runRes.ok) throw new Error("Failed to start pipeline");
      setStage("processing");

      /* 3. Connect WebSocket for push updates */
      startWS();
    } catch (err) {
      setErrorMsg(String(err));
      setStage("error");
    }
  };

  const cancelPipeline = async () => {
    setStage("cancelling");
    try { await fetch(`${API}/cancel`, { method: "POST" }); } catch (_) {}
  };

  const reset = () => {
    wsRef.current?.close();
    setStage("idle"); setDoneSteps(0); setFileName(""); setErrorMsg("");
    setFatigueData(null); setGoalProbData(null); setOutcomeData(null);
    setTrackingData(null); setAllTrackingData(null); setLivePositions(null); setCurrentFrame(0);
    setSavedMatchId(null); setShowNaming(false); setNames({ players: {}, teams: {} });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>
      {showNaming && savedMatchId && (
        <PlayerNamingModal
          matchId={savedMatchId}
          fatigueData={fatigueData}
          trackingData={trackingData}
          onClose={() => setShowNaming(false)}
          onSaved={saved => { setNames(saved); setShowNaming(false); }}
        />
      )}
      {/* Page header */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "1.5rem 0" }}>
        <div className="wrap">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
              Match <span style={{ color: "#D4AF37" }}>Demo</span>
            </h1>
            <ChevronRight size={16} style={{ color: "#555" }} />
            <span style={{ fontSize: "0.85rem", color: "#888" }}>
              {stage === "idle" ? "Upload a video to begin" : stage === "done" ? fileName : stage === "error" ? "Error occurred" : "Processing…"}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "#555", marginTop: "0.25rem" }}>
            Full AI pipeline: player tracking · fatigue estimation · goal probability · match outcome
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {(["upload", "realtime"] as InputMode[]).map(m => (
            <button key={m} onClick={() => setInputMode(m)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "0.45rem 1rem", borderRadius: "0.5rem", fontSize: "0.82rem",
                fontWeight: 600, cursor: "pointer",
                border: inputMode === m ? "1px solid #D4AF37" : "1px solid #2a2a2a",
                background: inputMode === m ? "rgba(212,175,55,0.12)" : "transparent",
                color: inputMode === m ? "#D4AF37" : "#666",
                transition: "all 0.2s",
              }}>
              {m === "upload" ? <Upload size={13} /> : <Radio size={13} />}
              {m === "upload" ? "Upload & Analyse" : "Real-Time Stream"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "2rem", alignItems: "start" }}>

          {/* ── Left Panel ── */}
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem", position: "sticky", top: "80px" }}>
            {inputMode === "upload" ? (
              <>
                <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "1.25rem" }}>
                  Upload &amp; Process
                </p>
                <UploadPanel
                  stage={stage} doneSteps={doneSteps}
                  fileName={fileName} errorMsg={errorMsg}
                  savedMatchId={savedMatchId}
                  onFile={startProcessing} onReset={reset} onCancel={cancelPipeline}
                />
              </>
            ) : (
              <RealTimeModePanel
                ws={activeWs}
                onPositions={rows => setRtLivePositions(rows)}
                annotRef={annotRef}
                onFirstFrame={() => setRtHasFrame(true)}
                onFrame={b64 => {
                  rtFrames.current.push(b64);
                  setRtFrameCount(rtFrames.current.length);
                  if (rtIsLive) setRtFrameIdx(rtFrames.current.length - 1);
                }}
              />
            )}
          </div>

          {/* ── Right Panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {inputMode === "upload" ? (
              <>
                {/* Edit Names button */}
                {stage === "done" && savedMatchId && (
                  <button
                    onClick={() => setShowNaming(true)}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", borderRadius: "0.75rem", background: "transparent", border: "1px solid rgba(212,175,55,0.35)", color: "#D4AF37", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "flex-start" }}>
                    ✏ Edit Names
                  </button>
                )}

                {/* Tabs */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      style={{
                        padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.85rem",
                        fontWeight: 600, cursor: "pointer",
                        border: activeTab === t.id ? "1px solid #D4AF37" : "1px solid #2a2a2a",
                        background: activeTab === t.id ? "rgba(212,175,55,0.12)" : "transparent",
                        color: activeTab === t.id ? "#D4AF37" : "#888",
                        transition: "all 0.2s",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "2rem", minHeight: "480px", position: "relative" }}>
                  <AnimatePresence mode="wait">
                    <motion.div key={activeTab}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                      {activeTab === "video" && (
                        <VideoTab
                          done={stage === "done"}
                          isStreaming={isStreaming}
                          phase={serverPhase}
                          onFrameChange={setCurrentFrame}
                        />
                      )}
                      {activeTab === "fatigue" && <FatigueChart data={fatigueData} names={names} />}
                      {activeTab === "goal" && <GoalProbChart data={goalProbData} names={names} />}
                      {activeTab === "outcome" && <MatchOutcomeChart data={outcomeData} names={names} />}
                    </motion.div>
                  </AnimatePresence>

                  {/* Floating minimap — live during streaming, frame-synced post-pipeline */}
                  {activeTab === "video" && (isStreaming || stage === "done") && (
                    <PitchRadar
                      data={isStreaming ? livePositions : trackingData}
                      allData={isStreaming ? null : allTrackingData}
                      currentFrame={isStreaming ? undefined : currentFrame}
                      names={names}
                      floating
                    />
                  )}
                </div>

                {stage === "idle" && (
                  <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#333" }}>
                    ↑ Upload a video on the left to see live results here
                  </p>
                )}
              </>
            ) : (
              /* Real-time mode right panel — annotated feed + scrubber + minimap */
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* Canvas */}
                <div style={{ background: "#000", border: "1px solid #2a2a2a", borderRadius: "1.25rem", overflow: "hidden", minHeight: "320px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {/* Live / scrubbing badge */}
                  {rtHasFrame && (
                    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.75)", border: `1px solid ${rtIsLive ? "rgba(239,68,68,0.55)" : "rgba(212,175,55,0.5)"}`, borderRadius: "6px", padding: "4px 10px" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", background: rtIsLive ? "#ef4444" : "#D4AF37", animation: rtIsLive ? "livePulse 1.2s ease-in-out infinite" : "none" }} />
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: rtIsLive ? "#ef4444" : "#D4AF37" }}>
                        {rtIsLive ? "LIVE" : rtIsPlaying ? "PLAYING" : "PAUSED"}
                      </span>
                    </div>
                  )}
                  <canvas ref={annotRef} style={{ width: "100%", display: "block" }} />
                  {!rtHasFrame && (
                    <p style={{ position: "absolute", fontSize: "0.8rem", color: "#333" }}>
                      Annotated feed will appear here
                    </p>
                  )}
                </div>

                {/* Scrubber — only shown once frames arrive */}
                {rtHasFrame && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.7rem", color: "#555" }}>
                        Frame&nbsp;<strong style={{ color: "#888" }}>{rtFrameIdx + 1}</strong>
                        &nbsp;/&nbsp;{rtFrameCount}
                      </span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: rtIsLive ? "#ef4444" : "#D4AF37" }}>
                        {rtIsLive ? "● LIVE" : "◈ Scrubbing"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(rtFrameCount - 1, 0)}
                      value={rtFrameIdx}
                      onChange={e => {
                        setRtIsLive(false);
                        setRtIsPlaying(false);
                        setRtFrameIdx(Number(e.target.value));
                      }}
                      style={{ width: "100%", accentColor: "#D4AF37", cursor: "pointer", height: "4px" }}
                    />

                    {/* Controls */}
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.25rem" }}>
                      <button
                        onClick={() => { setRtIsLive(false); setRtIsPlaying(p => !p); }}
                        style={{ padding: "0.38rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", background: (rtIsPlaying && !rtIsLive) ? "rgba(212,175,55,0.12)" : "transparent", border: (rtIsPlaying && !rtIsLive) ? "1px solid #D4AF37" : "1px solid #2a2a2a", color: (rtIsPlaying && !rtIsLive) ? "#D4AF37" : "#888" }}>
                        {rtIsPlaying && !rtIsLive ? "⏸ Pause" : "▶ Play"}
                      </button>
                      <button
                        onClick={rtGoLive}
                        style={{ padding: "0.38rem 0.85rem", borderRadius: "0.5rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", background: rtIsLive ? "rgba(239,68,68,0.1)" : "transparent", border: rtIsLive ? "1px solid rgba(239,68,68,0.5)" : "1px solid #2a2a2a", color: rtIsLive ? "#ef4444" : "#888" }}>
                        {rtIsLive && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "livePulse 1.2s ease-in-out infinite" }} />}
                        ⏺ Live
                      </button>
                      <select
                        value={rtPlaySpeed}
                        onChange={e => setRtPlaySpeed(Number(e.target.value))}
                        style={{ padding: "0.38rem 0.5rem", borderRadius: "0.5rem", fontSize: "0.82rem", fontWeight: 600, background: "#111", border: "1px solid #2a2a2a", color: "#888", cursor: "pointer" }}>
                        <option value={200}>0.25×</option>
                        <option value={100}>0.5×</option>
                        <option value={50}>1×</option>
                        <option value={25}>2×</option>
                        <option value={12}>4×</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Live minimap */}
                <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.5rem" }}>
                  <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "1rem" }}>
                    Live Minimap
                  </p>
                  <PitchRadar
                    data={rtLivePositions}
                    allData={null}
                    currentFrame={undefined}
                    names={{ players: {}, teams: {} }}
                    floating={false}
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
