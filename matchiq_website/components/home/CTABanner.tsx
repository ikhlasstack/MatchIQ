"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTABanner() {
  return (
    <section className="section-y">
      <div className="wrap">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          style={{
            position: "relative",
            borderRadius: "1.5rem",
            overflow: "hidden",
            background: "linear-gradient(135deg, #1a1500 0%, #2a1f00 45%, #1a1500 100%)",
            border: "1px solid rgba(212,175,55,0.3)",
            boxShadow: "0 0 80px rgba(212,175,55,0.08), inset 0 0 80px rgba(212,175,55,0.03)",
            textAlign: "center",
            padding: "5rem 2rem",
          }}
        >
          {/* Orb decorations */}
          <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.16) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-80px", left: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            <span style={{
              display: "inline-block", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600,
              padding: "5px 14px", borderRadius: "999px", marginBottom: "1.5rem",
              background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37",
            }}>
              Get Started — It&apos;s Free
            </span>

            <h2 style={{ fontSize: "clamp(2.2rem, 6vw, 3.75rem)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1.25rem" }}>
              Ready to Analyze
              <br />
              <span style={{ color: "#D4AF37" }}>Your Match?</span>
            </h2>

            <p style={{ fontSize: "1.1rem", color: "#888", maxWidth: "36rem", margin: "0 auto 2.5rem" }}>
              Upload a video and receive a complete analytics report — player tracking, fatigue,
              goal probability and match outcome in minutes.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
              <Link
                href="/demo"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "0.875rem 2rem", borderRadius: "0.75rem",
                  fontSize: "0.95rem", fontWeight: 700, color: "#000",
                  background: "#D4AF37", textDecoration: "none",
                  transition: "opacity 0.2s",
                }}
              >
                Upload Video Now
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/about"
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "0.875rem 2rem", borderRadius: "0.75rem",
                  fontSize: "0.95rem", fontWeight: 600, color: "#D4AF37",
                  border: "1px solid rgba(212,175,55,0.35)", textDecoration: "none",
                  transition: "background 0.2s",
                }}
              >
                Learn More
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
