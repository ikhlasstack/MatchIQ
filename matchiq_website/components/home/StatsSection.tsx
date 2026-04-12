"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const STATS = [
  { end: 500, suffix: "+", label: "Matches Analyzed",      desc: "and counting" },
  { end: 22,  suffix: "",  label: "Players Tracked / Match",desc: "avg per game" },
  { end: 4,   suffix: "",  label: "AI Modules",             desc: "fully automated" },
  { end: 95,  suffix: "%", label: "Detection Accuracy",    desc: "on test footage" },
];

function Counter({ end, suffix, duration = 2000 }: { end: number; suffix: string; duration?: number }) {
  const [count, setCount]   = useState(0);
  const ref    = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const step  = Math.ceil(end / (duration / 16));
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, end);
      setCount(current);
      if (current >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);

  return (
    <span ref={ref} className="gold-pulse" style={{ color: "#D4AF37" }}>
      {count}{suffix}
    </span>
  );
}

export default function StatsSection() {
  return (
    <section className="section-y" style={{ position: "relative", overflow: "hidden" }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 900px 300px at 50% 50%, rgba(212,175,55,0.06) 0%, transparent 70%)",
      }} />

      <div className="wrap" style={{ position: "relative" }}>
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: "4rem" }}
        >
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: "#D4AF37", marginBottom: "0.75rem" }}>
            By the Numbers
          </p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
            Performance{" "}
            <span style={{ color: "#D4AF37" }}>Metrics</span>
          </h2>
        </motion.div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
          {STATS.map(({ end, suffix, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="card-hover"
              style={{
                textAlign: "center",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "1rem",
                padding: "2.5rem 1.5rem",
              }}
            >
              <div style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 900, marginBottom: "0.5rem" }}>
                <Counter end={end} suffix={suffix} />
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#fff", marginBottom: "0.25rem" }}>{label}</div>
              <div style={{ fontSize: "0.75rem", color: "#555" }}>{desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
