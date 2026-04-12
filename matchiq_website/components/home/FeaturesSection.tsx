"use client";

import { motion } from "framer-motion";
import { UserCheck, Layers, Flame, Target, TrendingUp, MapPin } from "lucide-react";

const FEATURES = [
  { icon: UserCheck, title: "Player Tracking",     tag: "Computer Vision",   desc: "YOLO + ByteTrack maintain consistent player IDs across every frame, even through occlusions." },
  { icon: Layers,    title: "Team Classification", tag: "Clustering",        desc: "Automatic jersey color clustering assigns each player to their team without manual labeling." },
  { icon: Flame,     title: "Fatigue Estimation",  tag: "Biomechanics",      desc: "Speed decay and sprint-frequency analysis score each player's live fatigue level continuously." },
  { icon: Target,    title: "Goal Probability",    tag: "Predictive AI",     desc: "Distance, shot angle and defender positioning feed a real-time probabilistic goal model." },
  { icon: TrendingUp,title: "Match Outcome",       tag: "Match Intelligence", desc: "Possession, shots, territory and momentum combine into live win/draw/loss probabilities." },
  { icon: MapPin,    title: "Pitch Radar",         tag: "Visualization",     desc: "A live 2-D top-down pitch shows every player position, ball location and zones of control." },
];

export default function FeaturesSection() {
  return (
    <section className="section-y" style={{ background: "#111111" }}>
      <div className="wrap">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: "4rem" }}
        >
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: "#D4AF37", marginBottom: "0.75rem" }}>
            Capabilities
          </p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
            Six Modules.{" "}
            <span style={{ color: "#D4AF37" }}>One Pipeline.</span>
          </h2>
          <p style={{ marginTop: "1rem", color: "#888", maxWidth: "36rem", margin: "1rem auto 0" }}>
            Every analysis component runs automatically from a single video upload.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {FEATURES.map(({ icon: Icon, title, tag, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.09, duration: 0.55 }}
              className="card-hover"
              style={{
                background: "#0a0a0a",
                border: "1px solid #2a2a2a",
                borderRadius: "1rem",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {/* Icon + tag */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{
                  width: "3rem", height: "3rem", borderRadius: "0.75rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)",
                }}>
                  <Icon size={20} style={{ color: "#D4AF37" }} />
                </div>
                <span style={{
                  fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600,
                  padding: "3px 8px", borderRadius: "6px",
                  background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.12)", color: "#D4AF37",
                }}>
                  {tag}
                </span>
              </div>

              {/* Text */}
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.4rem" }}>{title}</h3>
                <p style={{ fontSize: "0.875rem", color: "#888", lineHeight: 1.65 }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
