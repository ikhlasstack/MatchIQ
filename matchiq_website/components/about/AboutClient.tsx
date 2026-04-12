"use client";

import { motion } from "framer-motion";
import { GraduationCap, Code2, Brain, Globe } from "lucide-react";

const TEAM = [
  { name: "Zainab Hasan",   role: "Computer Vision Engineer", icon: "👁️",  color: "#a855f7", bio: "Designed and implemented the YOLO-based player detection and ByteTrack multi-object tracking pipeline.",       skills: ["YOLO", "ByteTrack", "OpenCV", "Python"] },
  { name: "Ikhlas Khan",    role: "AI Engineer",              icon: "🧠",  color: "#3b82f6", bio: "Developed the fatigue estimation, goal probability model, and match outcome prediction algorithms.",           skills: ["PyTorch", "FastAPI", "NumPy", "SciPy"] },
  { name: "Musab Suhail",   role: "Full Stack Developer",     icon: "💻",  color: "#D4AF37", bio: "Built the real-time WebSocket pipeline, Next.js frontend, and all data visualization components.",             skills: ["Next.js", "Recharts", "WebSocket", "Node"] },
];

const STACK = [
  { name: "YOLO v8",    desc: "Object Detection",     color: "#8b5cf6" },
  { name: "ByteTrack",  desc: "Multi-Object Tracking",color: "#06b6d4" },
  { name: "Python",     desc: "Backend & AI",         color: "#3b82f6" },
  { name: "FastAPI",    desc: "REST API",              color: "#22c55e" },
  { name: "Next.js",    desc: "Frontend",              color: "#fff"    },
  { name: "Recharts",   desc: "Data Visualization",   color: "#f97316" },
  { name: "OpenCV",     desc: "Video Processing",      color: "#ec4899" },
  { name: "WebSocket",  desc: "Real-time Streaming",  color: "#eab308" },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay, duration: 0.6 },
});

export default function AboutClient() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* Hero */}
      <section style={{ background: "linear-gradient(180deg,#111 0%,#0a0a0a 100%)", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap section-y" style={{ textAlign: "center", position: "relative" }}>
          {/* Glow */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "300px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(212,175,55,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />
          <motion.div {...fade(0)}>
            <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", marginBottom: "1.25rem" }}>
              IBA Karachi · FYP 2026
            </span>
          </motion.div>
          <motion.h1 {...fade(0.06)} style={{ fontSize: "clamp(2.5rem,7vw,5rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: "1.25rem" }}>
            About <span style={{ color: "#D4AF37" }}>MatchIQ</span>
          </motion.h1>
          <motion.p {...fade(0.12)} style={{ fontSize: "1.1rem", color: "#888", maxWidth: "640px", margin: "0 auto", lineHeight: 1.7 }}>
            MatchIQ is an AI-powered football analytics platform built as a Final Year Project at{" "}
            <span style={{ color: "#fff", fontWeight: 600 }}>IBA Karachi</span>. We combine computer vision, biomechanics and predictive modelling to transform raw match footage into deep tactical intelligence — in real time.
          </motion.p>
        </div>
      </section>

      {/* Mission */}
      <section className="section-y" style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1.5rem" }}>
          {[
            { icon: "🎯", title: "Our Mission",   body: "Democratise elite football analytics. Make the insights available to top-tier clubs accessible to every coach with a smartphone and a match video." },
            { icon: "⚙️", title: "How We Do It", body: "We chain YOLO detection → ByteTrack persistent IDs → biomechanical fatigue models → probabilistic goal and outcome predictions into a single automated pipeline." },
            { icon: "🚀", title: "What's Next",  body: "Real-time WebSocket streaming, multi-camera support, set-piece analysis, and an open API so clubs and researchers can build on our platform." },
          ].map(({ icon, title, body }, i) => (
            <motion.div key={title} {...fade(i * 0.1)}
              className="card-hover"
              style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: "1rem", padding: "1.75rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>{icon}</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#D4AF37", marginBottom: "0.5rem" }}>{title}</h3>
              <p style={{ fontSize: "0.875rem", color: "#888", lineHeight: 1.7 }}>{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="section-y">
        <div className="wrap">
          <motion.div {...fade(0)} style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.5rem" }}>The Team</p>
            <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
              Built by <span style={{ color: "#D4AF37" }}>Engineers</span>
            </h2>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "1.5rem" }}>
            {TEAM.map(({ name, role, icon, color, bio, skills }, i) => (
              <motion.div key={name} {...fade(i * 0.12)}
                className="card-hover"
                style={{ background: "#111", border: `1px solid ${color}22`, borderRadius: "1.25rem", padding: "2rem", textAlign: "center" }}>
                {/* Avatar */}
                <div style={{ width: "5rem", height: "5rem", borderRadius: "50%", background: `${color}15`, border: `2px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "2.25rem" }}>
                  {icon}
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.25rem" }}>{name}</h3>
                <p style={{ fontSize: "0.8rem", color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>{role}</p>
                <p style={{ fontSize: "0.85rem", color: "#888", lineHeight: 1.65, marginBottom: "1.25rem" }}>{bio}</p>
                {/* Skill badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", justifyContent: "center" }}>
                  {skills.map(s => (
                    <span key={s} style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 600, background: `${color}11`, border: `1px solid ${color}33`, color }}>
                      {s}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="section-y" style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
        <div className="wrap">
          <motion.div {...fade(0)} style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.5rem" }}>Technology</p>
            <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
              Our <span style={{ color: "#D4AF37" }}>Stack</span>
            </h2>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "1rem" }}>
            {STACK.map(({ name, desc, color }, i) => (
              <motion.div key={name} {...fade(i * 0.06)}
                className="card-hover"
                style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: "0.875rem", padding: "1.25rem", textAlign: "center" }}>
                <Code2 size={20} style={{ color, margin: "0 auto 0.6rem" }} />
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color }}>{name}</div>
                <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "0.2rem" }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* University badge */}
      <section className="section-ys">
        <div className="wrap" style={{ textAlign: "center" }}>
          <motion.div {...fade(0)}
            style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "2rem 3rem", borderRadius: "1.25rem", background: "#111", border: "1px solid rgba(212,175,55,0.2)" }}>
            <GraduationCap size={36} style={{ color: "#D4AF37" }} />
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.01em" }}>IBA Karachi</div>
              <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.2rem" }}>Institute of Business Administration</div>
              <div style={{ fontSize: "0.75rem", color: "#D4AF37", fontWeight: 600, marginTop: "0.3rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Final Year Project · 2026</div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
