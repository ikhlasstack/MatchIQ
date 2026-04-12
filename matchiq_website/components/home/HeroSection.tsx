"use client";

import { type CSSProperties } from "react";
import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

const TICKER_ITEMS = [
  "⚽ Player Tracking",
  "🔥 Fatigue Estimation",
  "🎯 Goal Probability",
  "📊 Match Outcome Prediction",
  "🏃 Sprint Detection",
  "🗺️ Pitch Radar",
  "📈 Team Analytics",
];

/* Shared animation variants — whileInView with amount:0 triggers the
   instant any part of the element enters the viewport */
const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0  },
};

const viewportOnce = { once: true, amount: 0 as const };

/* ── Animated pitch background ── */
function PitchGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div
        className="absolute inset-0"
        style={{ opacity: 0.06, animation: "pitchPan 22s ease-in-out infinite" }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 700"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="60" y="40" width="1080" height="620" rx="4"
            fill="none" stroke="#22c55e" strokeWidth="2.5" />
          <line x1="660" y1="40" x2="660" y2="660"
            stroke="#22c55e" strokeWidth="1.5" />
          <circle cx="660" cy="350" r="90"
            fill="none" stroke="#22c55e" strokeWidth="1.5" />
          <circle cx="660" cy="350" r="5" fill="#22c55e" />
          <rect x="60"  y="175" width="180" height="310"
            fill="none" stroke="#22c55e" strokeWidth="1.5" />
          <rect x="60"  y="260" width="60"  height="140"
            fill="none" stroke="#22c55e" strokeWidth="1.5" />
          <rect x="960" y="175" width="180" height="310"
            fill="none" stroke="#22c55e" strokeWidth="1.5" />
          <rect x="1080" y="260" width="60" height="140"
            fill="none" stroke="#22c55e" strokeWidth="1.5" />
          <circle cx="180"  cy="350" r="3" fill="#22c55e" />
          <circle cx="1140" cy="350" r="3" fill="#22c55e" />
        </svg>
      </div>
      {/* Gold radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

/* ── Floating metric card ── */
interface FloatingCardProps {
  label: string;
  value: string;
  sub?: string;
  delay?: number;
  cardStyle?: CSSProperties;
}

function FloatingCard({ label, value, sub, delay = 0, cardStyle }: FloatingCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ delay, duration: 0.65, ease: "easeOut" }}
      style={cardStyle}
      className="absolute bg-[#111111]/95 border border-[#2a2a2a] backdrop-blur-sm rounded-xl p-4 min-w-[170px]"
    >
      <p className="text-[10px] uppercase tracking-widest text-[#888] mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: "#D4AF37" }}>{value}</p>
      {sub && (
        <p className="text-xs text-[#666] mt-0.5 leading-snug">{sub}</p>
      )}
    </motion.div>
  );
}

/* ── Main hero ── */
export default function HeroSection() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <section
      className="relative flex items-center overflow-hidden pt-16"
      style={{ minHeight: "100vh" }}
    >
      <PitchGrid />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: copy ── */}
          <div>
            {/* Badge */}
            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-6"
                style={{
                  borderColor: "rgba(212,175,55,0.4)",
                  color: "#D4AF37",
                  background: "rgba(212,175,55,0.08)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#D4AF37" }}
                />
                AI-Powered · IBA Karachi FYP 2026
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ delay: 0.08, duration: 0.65, ease: "easeOut" }}
              className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6"
            >
              AI‑Powered
              <br />
              <span style={{ color: "#D4AF37" }}>Football</span>
              <br />
              Analytics
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ delay: 0.16, duration: 0.65, ease: "easeOut" }}
              className="text-lg text-[#888] leading-relaxed max-w-lg mb-8"
            >
              Upload any match footage. Get instant{" "}
              <span className="text-white font-medium">player tracking</span>,{" "}
              <span className="text-white font-medium">fatigue analysis</span>,{" "}
              <span className="text-white font-medium">goal probability</span>, and{" "}
              <span className="text-white font-medium">match outcome predictions</span>.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ delay: 0.22, duration: 0.65, ease: "easeOut" }}
              className="flex flex-wrap gap-3 mb-10"
            >
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black transition-all duration-200 hover:opacity-90 hover:scale-[1.02]"
                style={{ background: "#D4AF37" }}
              >
                Upload Match Video
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border transition-all duration-200 hover:bg-[#D4AF37] hover:text-black"
                style={{ borderColor: "#D4AF37", color: "#D4AF37" }}
              >
                <Play size={14} />
                View Demo
              </Link>
            </motion.div>

            {/* Ticker strip */}
            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ delay: 0.3, duration: 0.65, ease: "easeOut" }}
              className="overflow-hidden border-t border-b border-[#2a2a2a] py-3"
            >
              <div className="ticker-track">
                {doubled.map((item, i) => (
                  <span key={i} className="text-xs text-[#666] pr-8 whitespace-nowrap">
                    {item}
                    <span className="ml-8 text-[#2a2a2a]">|</span>
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Right: floating cards + orb ── */}
          <div className="relative h-[400px] hidden lg:block">
            <FloatingCard
              label="Player #7 Fatigue"
              value="57%"
              sub="Moderate — Sprint decay detected"
              delay={0.3}
              cardStyle={{ top: "8%", right: "4%" }}
            />
            <FloatingCard
              label="Goal Probability"
              value="0.73"
              sub="High danger · 12m from goal"
              delay={0.42}
              cardStyle={{ top: "40%", left: "0%" }}
            />
            <FloatingCard
              label="Team A Win Prob"
              value="65%"
              sub="Possession 58% · Shots 4–1"
              delay={0.54}
              cardStyle={{ bottom: "8%", right: "8%" }}
            />

            {/* Central orb */}
            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full flex items-center justify-center text-6xl select-none"
              style={{
                border: "1px solid rgba(212,175,55,0.18)",
                boxShadow:
                  "0 0 60px rgba(212,175,55,0.1), inset 0 0 60px rgba(212,175,55,0.05)",
              }}
            >
              ⚽
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
