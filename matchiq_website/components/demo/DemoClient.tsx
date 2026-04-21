"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, CheckCircle, Loader2, Download, FileText, Film, ChevronRight, AlertCircle,
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

/* ── Main Demo Client ─────────────────────────────────────────────────────── */
export default function DemoClient() {
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

  const wsRef = useRef<WebSocket | null>(null);

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

  /* Open WebSocket once pipeline starts; close when done/cancelled/error */
  const startWS = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`ws://localhost:8000/ws`);
    wsRef.current = ws;

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);

      if (msg.type === "positions") {
        if (Array.isArray(msg.rows) && msg.rows.length > 0) setLivePositions(msg.rows);
        return;
      }

      if (msg.type === "status") {
        /* Map phase → doneSteps */
        const phaseToSteps: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3 };
        setDoneSteps(msg.done ? 4 : (phaseToSteps[msg.phase] ?? 1));
        setIsStreaming(msg.streaming ?? false);
        setServerPhase(msg.phase ?? 0);

        if (msg.error) {
          ws.close();
          setErrorMsg(msg.error);
          setStage("error");
        } else if (msg.cancelled) {
          ws.close();
          setStage("cancelled");
          if (msg.match_id) setSavedMatchId(msg.match_id);
        } else if (msg.done) {
          ws.close();
          setStage("done");
          await fetchResults();
          if (msg.match_id) {
            setSavedMatchId(msg.match_id);
            setShowNaming(true);
          }
        }
      }
    };

    ws.onerror = () => { /* server not ready yet — will retry on next startProcessing */ };
  }, [fetchResults]);

  /* Clear live positions when streaming stops */
  useEffect(() => {
    if (!isStreaming) setLivePositions(null);
  }, [isStreaming]);

  /* Cleanup WS on unmount */
  useEffect(() => () => { wsRef.current?.close(); }, []);

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
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "2rem", alignItems: "start" }}>

          {/* ── Left Panel ── */}
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "1.75rem", position: "sticky", top: "80px" }}>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "1.25rem" }}>
              Upload &amp; Process
            </p>
            <UploadPanel
              stage={stage} doneSteps={doneSteps}
              fileName={fileName} errorMsg={errorMsg}
              savedMatchId={savedMatchId}
              onFile={startProcessing} onReset={reset} onCancel={cancelPipeline}
            />
          </div>

          {/* ── Right Panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Edit Names button — same style as Gallery header button */}
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
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
