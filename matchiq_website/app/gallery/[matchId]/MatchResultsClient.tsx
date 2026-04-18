"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Clock, Users, Film, Download } from "lucide-react";
import FatigueChart from "@/components/demo/tabs/FatigueChart";
import GoalProbChart from "@/components/demo/tabs/GoalProbChart";
import MatchOutcomeChart from "@/components/demo/tabs/MatchOutcomeChart";
import PitchRadar from "@/components/demo/tabs/PitchRadar";
import VideoTab from "@/components/demo/tabs/VideoTab";
import type { FatigueRow, GoalProbRow, OutcomeData, TrackingRow } from "@/components/demo/DemoClient";

const API = "http://localhost:8000";

type TabId = "video" | "fatigue" | "goal" | "outcome" | "radar";

const TABS: { id: TabId; label: string }[] = [
  { id: "video",   label: "Tracked Video"   },
  { id: "fatigue", label: "Player Fatigue"  },
  { id: "goal",    label: "Goal Probability" },
  { id: "outcome", label: "Match Outcome"   },
  { id: "radar",   label: "Pitch Radar"     },
];

interface MatchMeta {
  id: string;
  name: string;
  date: string;
  duration: string;
  frames: number;
  players: number;
}

export default function MatchResultsClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [activeTab,    setActiveTab]    = useState<TabId>("video");
  const [meta,         setMeta]         = useState<MatchMeta | null>(null);
  const [fatigueData,  setFatigueData]  = useState<FatigueRow[] | null>(null);
  const [goalProbData, setGoalProbData] = useState<GoalProbRow[] | null>(null);
  const [outcomeData,  setOutcomeData]  = useState<OutcomeData | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingRow[] | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const videoUrl    = `${API}/matches/${matchId}/video`;
  const downloadUrl = `${API}/matches/${matchId}/video`;

  useEffect(() => {
    async function load() {
      try {
        const [metaRes, fat, goal, out, track] = await Promise.all([
          fetch(`${API}/matches/${matchId}`).then(r => {
            if (!r.ok) throw new Error("Match not found");
            return r.json();
          }),
          fetch(`${API}/matches/${matchId}/results/fatigue`).then(r => r.json()),
          fetch(`${API}/matches/${matchId}/results/goal-prob`).then(r => r.json()),
          fetch(`${API}/matches/${matchId}/results/outcome`).then(r => r.json()),
          fetch(`${API}/matches/${matchId}/results/tracking`).then(r => r.json()),
        ]);
        setMeta(metaRes);
        setFatigueData(fat);
        setGoalProbData(goal);
        setOutcomeData(out);
        setTrackingData(track);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not load match data. Is the backend running?");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#555" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚽</div>
          <p>Loading match data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#888" }}>
          <p style={{ marginBottom: "1rem", color: "#ef4444" }}>{error}</p>
          <button onClick={() => router.push("/gallery")} style={{ color: "#D4AF37", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>← Back to Gallery</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ paddingTop: "1.5rem", paddingBottom: "1.5rem" }}>
          <button
            onClick={() => router.push("/gallery")}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#888", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", marginBottom: "1rem", padding: 0 }}>
            <ArrowLeft size={14} /> Back to Gallery
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.3rem" }}>Match Analysis</p>
              <h1 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
                {meta?.name ?? matchId}
              </h1>
              {meta && (
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                  {[
                    { icon: Calendar, value: meta.date },
                    { icon: Clock,    value: meta.duration },
                    { icon: Users,    value: `${meta.players} players` },
                    { icon: Film,     value: `${(meta.frames / 1000).toFixed(1)}k frames` },
                  ].map(({ icon: Icon, value }) => (
                    <div key={value} style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#888", fontSize: "0.8rem" }}>
                      <Icon size={13} style={{ color: "#D4AF37" }} /> {value}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Download button */}
            <a
              href={downloadUrl}
              download={`${meta?.name ?? matchId}_tracked.mp4`}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", borderRadius: "0.75rem", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.35)", color: "#D4AF37", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", alignSelf: "flex-start" }}>
              <Download size={14} /> Download Video
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", position: "sticky", top: "64px", zIndex: 40 }}>
        <div className="wrap" style={{ display: "flex", gap: "0", overflowX: "auto" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: "0.875rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid #D4AF37" : "2px solid transparent", color: activeTab === tab.id ? "#D4AF37" : "#888", whiteSpace: "nowrap", transition: "color 0.2s" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}>
            {activeTab === "video"   && <VideoTab done={true} isStreaming={false} phase={4} videoUrl={videoUrl} />}
            {activeTab === "fatigue" && <FatigueChart data={fatigueData} />}
            {activeTab === "goal"    && <GoalProbChart data={goalProbData} />}
            {activeTab === "outcome" && <MatchOutcomeChart data={outcomeData} />}
            {activeTab === "radar"   && <PitchRadar data={trackingData} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
