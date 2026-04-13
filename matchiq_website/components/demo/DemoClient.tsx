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

const API = "http://localhost:8000";

/* ── Types ────────────────────────────────────────────────────────────────── */
type Stage = "idle" | "uploading" | "processing" | "done" | "error";
type TabId = "video" | "fatigue" | "goal" | "outcome" | "radar";

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
  { id: "radar", label: "Pitch Radar" },
];

/* ── Upload Panel ─────────────────────────────────────────────────────────── */
function UploadPanel({
  stage, doneSteps, fileName, errorMsg, onFile, onReset,
}: {
  stage: Stage; doneSteps: number; fileName: string;
  errorMsg: string; onFile: (f: File) => void; onReset: () => void;
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
        {stage !== "idle" && stage !== "error" && (
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
          </motion.div>
        )}
      </AnimatePresence>

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

/* ── Video Tab ────────────────────────────────────────────────────────────── */
function VideoTab({ done }: { done: boolean }) {
  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <video
          src={`${API}/video/tracked`}
          controls
          style={{ width: "100%", borderRadius: "0.75rem", border: "1px solid #2a2a2a", background: "#000", maxHeight: "420px" }}
        />
        <p style={{ fontSize: "0.75rem", color: "#555", textAlign: "center" }}>
          Player bounding boxes · Team colour labels · Ball tracking
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ position: "relative", background: "#050505", borderRadius: "0.75rem", overflow: "hidden", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #2a2a2a" }}>
        <svg viewBox="0 0 640 360" width="100%" height="100%" style={{ opacity: 0.12 }}>
          <rect x="20" y="20" width="600" height="320" rx="3" fill="none" stroke="#22c55e" strokeWidth="2" />
          <line x1="320" y1="20" x2="320" y2="340" stroke="#22c55e" strokeWidth="1" />
          <circle cx="320" cy="180" r="50" fill="none" stroke="#22c55e" strokeWidth="1" />
          <rect x="20" y="115" width="90" height="130" fill="none" stroke="#22c55e" strokeWidth="1" />
          <rect x="530" y="115" width="90" height="130" fill="none" stroke="#22c55e" strokeWidth="1" />
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>⚽</div>
          <p style={{ fontSize: "0.85rem", color: "#888" }}>Tracked video preview</p>
          <p style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.25rem" }}>Run the pipeline to see real output</p>
        </div>
      </div>
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Fetch all results once pipeline is done */
  const fetchResults = useCallback(async () => {
    try {
      const [fat, goal, out, track] = await Promise.all([
        fetch(`${API}/results/fatigue`).then(r => r.json()),
        fetch(`${API}/results/goal-prob`).then(r => r.json()),
        fetch(`${API}/results/outcome`).then(r => r.json()),
        fetch(`${API}/results/tracking`).then(r => r.json()),
      ]);
      setFatigueData(fat);
      setGoalProbData(goal);
      setOutcomeData(out);
      setTrackingData(track);
    } catch (_) {
      /* non-fatal — charts fall back to loading state */
    }
  }, []);

  /* Poll /status while pipeline is running */
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status`);
        const data = await res.json();

        /* Map phase → doneSteps:
           phase 0 = just uploaded     → 1 step done (upload)
           phase 1 = tracking running  → 1 step done
           phase 2 = features running  → 2 steps done
           phase 3 = fatigue/goal      → 3 steps done
           phase 4 = outcome running   → 3 steps done
           done                        → 4 steps done  */
        const phaseToSteps: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3 };
        setDoneSteps(data.done ? 4 : (phaseToSteps[data.phase] ?? 1));

        if (data.error) {
          clearInterval(pollRef.current!);
          setErrorMsg(data.error);
          setStage("error");
        } else if (data.done) {
          clearInterval(pollRef.current!);
          setStage("done");
          await fetchResults();
        }
      } catch (_) { /* server might still be starting */ }
    }, 2500);
  }, [fetchResults]);

  /* Cleanup polling on unmount */
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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

      /* 3. Poll */
      startPolling();
    } catch (err) {
      setErrorMsg(String(err));
      setStage("error");
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStage("idle"); setDoneSteps(0); setFileName(""); setErrorMsg("");
    setFatigueData(null); setGoalProbData(null); setOutcomeData(null); setTrackingData(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>
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
              onFile={startProcessing} onReset={reset}
            />
          </div>

          {/* ── Right Panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
            <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "2rem", minHeight: "480px" }}>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {activeTab === "video" && <VideoTab done={stage === "done"} />}
                  {activeTab === "fatigue" && <FatigueChart data={fatigueData} />}
                  {activeTab === "goal" && <GoalProbChart data={goalProbData} />}
                  {activeTab === "outcome" && <MatchOutcomeChart data={outcomeData} />}
                  {activeTab === "radar" && <PitchRadar data={trackingData} />}
                </motion.div>
              </AnimatePresence>
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
