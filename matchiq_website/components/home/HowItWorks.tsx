"use client";

import { motion } from "framer-motion";
import { Upload, Cpu, BarChart3, LayoutDashboard } from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    number: "01",
    title: "Upload Video",
    desc: "Drag and drop any match footage — MP4, AVI or MOV. Up to 2 GB supported.",
  },
  {
    icon: Cpu,
    number: "02",
    title: "AI Detection",
    desc: "YOLO + ByteTrack identify every player, ball and referee frame by frame.",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "Analytics Engine",
    desc: "Speed, fatigue, goal probability and match outcome computed in real time.",
  },
  {
    icon: LayoutDashboard,
    number: "04",
    title: "View Results",
    desc: "Explore interactive dashboards, export CSVs or download the annotated video.",
  },
];

export default function HowItWorks() {
  return (
    <section className="section-y relative">
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
            How It Works
          </p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
            From Footage to{" "}
            <span style={{ color: "#D4AF37" }}>Insight</span>
          </h2>
          <p style={{ marginTop: "1rem", color: "#888", maxWidth: "36rem", margin: "1rem auto 0" }}>
            Four automated steps turn raw match video into actionable analytics — no manual work required.
          </p>
        </motion.div>

        {/* Steps */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
          {STEPS.map(({ icon: Icon, number, title, desc }, i) => (
            <motion.div
              key={number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="card-hover"
              style={{
                position: "relative",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "1rem",
                padding: "1.75rem 1.5rem",
                textAlign: "center",
              }}
            >
              {/* Number badge */}
              <div style={{
                position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                fontSize: "0.7rem", fontWeight: 900, padding: "2px 10px", borderRadius: "999px",
                background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37",
                whiteSpace: "nowrap",
              }}>
                {number}
              </div>

              {/* Icon */}
              <div style={{
                width: "3.5rem", height: "3.5rem", borderRadius: "0.75rem",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "1rem auto 1.25rem",
                background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.18)",
              }}>
                <Icon size={22} style={{ color: "#D4AF37" }} />
              </div>

              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>{title}</h3>
              <p style={{ fontSize: "0.875rem", color: "#888", lineHeight: 1.6 }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
