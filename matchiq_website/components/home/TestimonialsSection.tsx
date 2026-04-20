"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "MatchIQ completely changed how we review matches. The fatigue tracking alone saved us from two potential hamstring injuries mid-season.",
    name: "Ahmed Raza", title: "Head of Performance", club: "Karachi United FC", stars: 5,
  },
  {
    quote: "Our analysts used to spend 4 hours reviewing footage manually. MatchIQ processes a full match in minutes with accuracy we've never seen before.",
    name: "Sultan Mehmood", title: "Lead Video Analyst", club: "Lahore City FC", stars: 5,
  },
  {
    quote: "The goal probability model is surprisingly accurate. We've adjusted our tactical pressing patterns based on the threat maps it generates.",
    name: "Hamza Ali", title: "Tactical Coach", club: "Islamabad FC Academy", stars: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section className="section-y" style={{ background: "#111111" }}>
      <div className="wrap">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: "3.5rem" }}
        >
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: "#D4AF37", marginBottom: "0.75rem" }}>
            What They Say
          </p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
            Trusted by{" "}
            <span style={{ color: "#D4AF37" }}>Coaches & Analysts</span>
          </h2>
        </motion.div>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          {TESTIMONIALS.map(({ quote, name, title, club, stars }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="card-hover"
              style={{
                background: "#0a0a0a",
                border: "1px solid #2a2a2a",
                borderRadius: "1rem",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {/* Stars */}
              <div style={{ display: "flex", gap: "4px" }}>
                {Array.from({ length: stars }).map((_, idx) => (
                  <Star key={idx} size={14} fill="#D4AF37" style={{ color: "#D4AF37" }} />
                ))}
              </div>

              {/* Quote */}
              <blockquote style={{ fontSize: "0.9rem", color: "#bbb", lineHeight: 1.7, flex: 1 }}>
                &ldquo;{quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingTop: "1rem", borderTop: "1px solid #1a1a1a" }}>
                <div style={{
                  width: "2.5rem", height: "2.5rem", borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.9rem", fontWeight: 900,
                  background: "rgba(212,175,55,0.12)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.2)",
                }}>
                  {name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#888" }}>
                    {title} · <span style={{ color: "#D4AF37" }}>{club}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
