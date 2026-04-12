import React, { useEffect, useRef } from "react";

/* ── constants ───────────────────────────────────────────────── */
const TEAM_COLORS = { 0: "#3b82f6", 1: "#f43f5e" };

/* ── helpers ─────────────────────────────────────────────────── */
function fatigueColor(level) {
    if (!level) return null;
    switch (level.toLowerCase()) {
        case "low":      return "#22c55e";
        case "moderate": return "#eab308";
        case "high":     return "#f97316";
        case "critical": return "#ef4444";
        default:         return null;
    }
}

/* ── overlay drawing ─────────────────────────────────────────── */
function drawOverlays(ctx, frame, overlays) {
    if (!ctx || !frame) return;

    const sourceW  = frame.frame_width  || ctx.canvas.width;
    const sourceH  = frame.frame_height || ctx.canvas.height;
    const scaleX   = ctx.canvas.width  / sourceW;
    const scaleY   = ctx.canvas.height / sourceH;

    if (!overlays.detections || !Array.isArray(frame.detections)) return;

    ctx.save();
    ctx.font = "bold 12px Inter, sans-serif";

    frame.detections.forEach(det => {
        const [x1, y1, x2, y2] = det.bbox || [0, 0, 0, 0];
        const role  = det.role || "object";
        const color = role === "ball"
            ? "#ffd400"
            : (TEAM_COLORS[det.team_id] || "#ffffff");

        const left   = x1 * scaleX;
        const top    = y1 * scaleY;
        const width  = (x2 - x1) * scaleX;
        const height = (y2 - y1) * scaleY;

        /* ─ Bounding box ─ */
        ctx.shadowColor = color;
        ctx.shadowBlur  = 5;
        ctx.strokeStyle = color;
        ctx.lineWidth   = role === "ball" ? 2.5 : 2;
        ctx.strokeRect(left, top, width, height);
        ctx.shadowBlur  = 0;

        /* ─ Label pill ─ */
        const label   = role === "ball" ? "⚽ Ball" : `#${det.player_id} ${role}`;
        const txtW    = ctx.measureText(label).width;
        const lblTop  = Math.max(top - 20, 0);
        const lblH    = 18;
        const lblPad  = 5;

        // Background
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(left, lblTop, txtW + lblPad * 2, lblH, 3);
        } else {
            ctx.fillRect(left, lblTop, txtW + lblPad * 2, lblH);
        }
        ctx.fill();

        // Text
        ctx.fillStyle = role === "ball" ? "#000" : "#fff";
        ctx.fillText(label, left + lblPad, lblTop + 13);

        /* ─ Fatigue dot (top-right corner) ─ */
        if (overlays.fatigue && det.fatigue && role !== "ball") {
            const fc = fatigueColor(det.fatigue.fatigue_level);
            if (fc) {
                const dotX = left + width - 6;
                const dotY = top + 6;
                ctx.fillStyle   = fc;
                ctx.shadowColor = fc;
                ctx.shadowBlur  = 7;
                ctx.beginPath();
                ctx.arc(dotX, dotY, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        /* ─ Goal probability bar (bottom of box) ─ */
        if (overlays.goal_prob && det.goal_probability && role !== "ball") {
            const prob = det.goal_probability.goal_probability || 0;
            if (prob > 0.15) {
                const barColor = prob > 0.60 ? "#ef4444"
                               : prob > 0.35 ? "#f97316"
                               :               "#eab308";
                ctx.fillStyle   = barColor;
                ctx.shadowColor = barColor;
                ctx.shadowBlur  = 4;
                ctx.fillRect(left, top + height - 4, width * prob, 4);
                ctx.shadowBlur = 0;
            }
        }

        /* ─ Sprint lightning bolt label ─ */
        if (overlays.movement_features && det.movement?.is_sprinting) {
            ctx.fillStyle = "#eab308";
            ctx.font      = "bold 13px Inter, sans-serif";
            ctx.fillText("⚡", left + width - 16, top + height - 4);
            ctx.font = "bold 12px Inter, sans-serif";
        }
    });

    ctx.restore();
}

/* ── Component ───────────────────────────────────────────────── */
export default function VideoCanvas({ frame, overlays, width, height }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);

        if (frame && frame.image) {
            const img  = new window.Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, width, height);
                drawOverlays(ctx, frame, overlays);
            };
            img.src = "data:image/jpeg;base64," + frame.image;
        } else {
            /* ── Empty / waiting state ── */
            ctx.fillStyle = "#07090f";
            ctx.fillRect(0, 0, width, height);

            // Subtle grid
            ctx.strokeStyle = "rgba(255,255,255,0.022)";
            ctx.lineWidth   = 1;
            for (let x = 0; x < width; x += 60) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            }
            for (let y = 0; y < height; y += 60) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            }

            // Center text
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.font         = "bold 18px Inter, sans-serif";
            ctx.fillStyle    = "rgba(255,255,255,0.12)";
            ctx.fillText("⚽  Waiting for stream…", width / 2, height / 2 - 14);

            ctx.font      = "13px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.fillText("ws://localhost:8765", width / 2, height / 2 + 14);

            ctx.textAlign    = "left";
            ctx.textBaseline = "alphabetic";
        }
    }, [frame, overlays, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                display: "block",
                width:   "100%",
                height:  "auto",
                background: "#07090f",
            }}
        />
    );
}
