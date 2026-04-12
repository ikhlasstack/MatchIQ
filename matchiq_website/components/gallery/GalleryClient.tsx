"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Users, Film, Eye, Filter } from "lucide-react";
import { GALLERY_MATCHES } from "@/lib/mockData";

const ALL_TEAMS = ["All", "20 Players", "21 Players", "22 Players"];

export default function GalleryClient() {
  const [sort,       setSort]       = useState<"date" | "duration">("date");
  const [teamFilter, setTeamFilter] = useState("All");
  const [search,     setSearch]     = useState("");

  const filtered = GALLERY_MATCHES
    .filter(m => {
      if (teamFilter !== "All" && !`${m.players} Players`.includes(teamFilter.replace(" Players", ""))) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) =>
      sort === "date"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : b.frames - a.frames
    );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.4rem" }}>Gallery</p>
          <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            Match <span style={{ color: "#D4AF37" }}>Library</span>
          </h1>
          <p style={{ color: "#888", fontSize: "0.9rem" }}>Browse all processed matches and view their analytics reports</p>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", position: "sticky", top: "64px", zIndex: 40 }}>
        <div className="wrap" style={{ paddingTop: "0.875rem", paddingBottom: "0.875rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* Search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search matches…"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.85rem", outline: "none", width: "180px" }}
          />
          {/* Team count */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Filter size={13} style={{ color: "#888" }} />
            {ALL_TEAMS.map(t => (
              <button key={t} onClick={() => setTeamFilter(t)}
                style={{ padding: "0.3rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: teamFilter === t ? "1px solid #D4AF37" : "1px solid #2a2a2a", background: teamFilter === t ? "rgba(212,175,55,0.12)" : "transparent", color: teamFilter === t ? "#D4AF37" : "#888" }}>
                {t}
              </button>
            ))}
          </div>
          {/* Sort */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>Sort:</span>
            {(["date", "duration"] as const).map(s => (
              <button key={s} onClick={() => setSort(s)}
                style={{ padding: "0.3rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", textTransform: "capitalize", border: sort === s ? "1px solid #D4AF37" : "1px solid #2a2a2a", background: sort === s ? "rgba(212,175,55,0.12)" : "transparent", color: sort === s ? "#D4AF37" : "#888" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
        <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "1.25rem" }}>{filtered.length} match{filtered.length !== 1 ? "es" : ""} found</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "1.25rem" }}>
          {filtered.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              className="card-hover"
              style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "1rem", overflow: "hidden" }}
            >
              {/* Thumbnail */}
              <div style={{ height: "140px", background: "linear-gradient(135deg,#0d1a0e 0%,#0a0a0a 100%)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #1a1a1a", position: "relative" }}>
                {/* Mini pitch SVG */}
                <svg viewBox="0 0 200 120" width="160" height="96" style={{ opacity: 0.15 }}>
                  <rect x="5" y="5" width="190" height="110" rx="2" fill="none" stroke="#22c55e" strokeWidth="1.5" />
                  <line x1="100" y1="5" x2="100" y2="115" stroke="#22c55e" strokeWidth="1" />
                  <circle cx="100" cy="60" r="20" fill="none" stroke="#22c55e" strokeWidth="1" />
                  <rect x="5" y="35" width="30" height="50" fill="none" stroke="#22c55e" strokeWidth="1" />
                  <rect x="165" y="35" width="30" height="50" fill="none" stroke="#22c55e" strokeWidth="1" />
                </svg>
                <div style={{ position: "absolute", fontSize: "2.5rem" }}>⚽</div>
                {/* Match ID badge */}
                <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.7)", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "2px 8px", fontSize: "0.7rem", color: "#888" }}>
                  #{String(match.id).padStart(3, "0")}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.2rem" }}>{match.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Calendar size={12} style={{ color: "#888" }} />
                      <span style={{ fontSize: "0.75rem", color: "#888" }}>{match.date}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "3px 8px", borderRadius: "6px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                    <span style={{ fontSize: "0.7rem", color: "#22c55e", fontWeight: 600 }}>Processed</span>
                  </div>
                </div>

                {/* Quick stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                  {[
                    { icon: Clock, label: "Duration", value: match.duration },
                    { icon: Users, label: "Players",  value: match.players  },
                    { icon: Film,  label: "Frames",   value: `${(match.frames / 1000).toFixed(0)}k` },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} style={{ background: "#0a0a0a", borderRadius: "0.5rem", padding: "0.5rem", textAlign: "center" }}>
                      <Icon size={12} style={{ color: "#D4AF37", margin: "0 auto 0.2rem" }} />
                      <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{value}</div>
                      <div style={{ fontSize: "0.62rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                    </div>
                  ))}
                </div>

                <button style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.6rem", borderRadius: "0.75rem", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.35)", color: "#D4AF37", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#D4AF37"; (e.currentTarget as HTMLButtonElement).style.color = "#000"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#D4AF37"; }}>
                  <Eye size={14} /> View Analysis
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
