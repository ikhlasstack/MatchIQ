"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const API       = "http://localhost:8000";
const CANVAS_W  = 960;   // canvas buffer width  (CSS makes it responsive)
const CANVAS_H  = 540;   // canvas buffer height

/* ── MJPEG stream parser ───────────────────────────────────────────────────────
 * Reads a multipart/x-mixed-replace stream with the Fetch API and extracts
 * individual JPEG frames by scanning for SOI (FF D8 FF) / EOI (FF D9) markers.
 * Calls onFrame with the raw compressed bytes of each complete JPEG.
 * ---------------------------------------------------------------------------- */
async function parseMjpegStream(
  url: string,
  onFrame: (jpeg: Uint8Array<ArrayBuffer>) => void,
  signal: AbortSignal,
) {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch {
    return;                 // aborted before connect
  }
  if (!res.body) return;

  const reader = res.body.getReader();

  /** Concatenate two typed arrays. */
  const concat = (a: Uint8Array, b: Uint8Array) => {
    const out = new Uint8Array(a.length + b.length);
    out.set(a); out.set(b, a.length);
    return out;
  };

  /** Find the first occurrence of a byte sequence starting at `from`. */
  const findSeq = (buf: Uint8Array, seq: readonly number[], from = 0): number => {
    outer: for (let i = from; i <= buf.length - seq.length; i++) {
      for (let j = 0; j < seq.length; j++) {
        if (buf[i + j] !== seq[j]) continue outer;
      }
      return i;
    }
    return -1;
  };

  const SOI = [0xFF, 0xD8, 0xFF] as const;
  const EOI = [0xFF, 0xD9]       as const;
  let buffer = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = concat(buffer, value);

      // Extract as many complete JPEGs as are present in the current buffer
      let soiIdx = findSeq(buffer, SOI);
      while (soiIdx !== -1) {
        const eoiIdx = findSeq(buffer, EOI, soiIdx + 2);
        if (eoiIdx === -1) break;                   // frame not complete yet
        onFrame(buffer.slice(soiIdx, eoiIdx + 2));  // emit the JPEG
        buffer  = buffer.slice(eoiIdx + 2);
        soiIdx  = findSeq(buffer, SOI);
      }

      // Keep the tail (partial frame) but discard leading garbage
      if (soiIdx === -1 && buffer.length > 4096) {
        buffer = new Uint8Array(0);               // discard stale bytes
      }
    }
  } catch (err: unknown) {
    if ((err as { name?: string })?.name !== "AbortError") {
      console.warn("MJPEG parse error:", err);
    }
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fmtTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ── Custom video player for the final tracked output ───────────────────────── */
function TrackedVideoPlayer({
  done,
  videoRef,
  videoUrl,
}: {
  done: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl?: string;
}) {
  const [playing,   setPlaying]   = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [speed,     setSpeed]     = useState(1);
  const [fullscr,   setFullscr]   = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const seek = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val;
    setCurrent(val);
  };

  const changeSpeed = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
  };

  const toggleFullscreen = () => {
    if (!wrapRef.current) return;
    if (!document.fullscreenElement) {
      wrapRef.current.requestFullscreen().then(() => setFullscr(true));
    } else {
      document.exitFullscreen().then(() => setFullscr(false));
    }
  };

  /* Sync state from the video element */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime  = () => setCurrent(v.currentTime);
    const onMeta  = () => setDuration(v.duration);
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    v.addEventListener("timeupdate",      onTime);
    v.addEventListener("loadedmetadata",  onMeta);
    v.addEventListener("play",            onPlay);
    v.addEventListener("pause",           onPause);
    v.addEventListener("ended",           onEnded);
    return () => {
      v.removeEventListener("timeupdate",     onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play",           onPlay);
      v.removeEventListener("pause",          onPause);
      v.removeEventListener("ended",          onEnded);
    };
  }, [videoRef]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {!done && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "6px 12px",
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: "8px",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: "0.78rem", color: "#22c55e" }}>Computing features in background…</span>
        </div>
      )}

      {/* Video element — hidden native controls */}
      <div ref={wrapRef} style={{ position: "relative", background: "#000", borderRadius: "0.75rem", overflow: "hidden" }}>
        <video
          ref={videoRef}
          src={videoUrl ?? `${API}/video/tracked`}
          playsInline
          onClick={toggle}
          style={{ width: "100%", display: "block", maxHeight: fullscr ? "100vh" : "400px", cursor: "pointer" }}
        />
        {/* Big play overlay when paused */}
        {!playing && (
          <div
            onClick={toggle}
            style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.35)", cursor: "pointer",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(212,175,55,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "1.4rem", marginLeft: 4 }}>▶</span>
            </div>
          </div>
        )}
      </div>

      {/* Seek bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={e => seek(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#D4AF37", cursor: "pointer", height: "4px" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.7rem", color: "#666" }}>{fmtTime(current)}</span>
          <span style={{ fontSize: "0.7rem", color: "#444" }}>{fmtTime(duration)}</span>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>

        {/* Play / Pause */}
        <button
          onClick={toggle}
          style={{
            padding: "0.38rem 0.9rem", borderRadius: "0.5rem",
            fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
            background: playing ? "rgba(212,175,55,0.12)" : "transparent",
            border:     playing ? "1px solid #D4AF37"     : "1px solid #2a2a2a",
            color:      playing ? "#D4AF37"               : "#888",
          }}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        {/* Speed */}
        <select
          value={speed}
          onChange={e => changeSpeed(Number(e.target.value))}
          style={{
            padding: "0.38rem 0.5rem", borderRadius: "0.5rem",
            fontSize: "0.82rem", fontWeight: 600,
            background: "#111", border: "1px solid #2a2a2a", color: "#888",
            cursor: "pointer",
          }}
        >
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
        </select>

        {/* Skip back 10 s */}
        <button
          onClick={() => seek(Math.max(0, current - 10))}
          title="−10 s"
          style={{
            padding: "0.38rem 0.7rem", borderRadius: "0.5rem",
            fontSize: "0.82rem", cursor: "pointer",
            background: "transparent", border: "1px solid #2a2a2a", color: "#888",
          }}
        >⏪ 10s</button>

        {/* Skip forward 10 s */}
        <button
          onClick={() => seek(Math.min(duration, current + 10))}
          title="+10 s"
          style={{
            padding: "0.38rem 0.7rem", borderRadius: "0.5rem",
            fontSize: "0.82rem", cursor: "pointer",
            background: "transparent", border: "1px solid #2a2a2a", color: "#888",
          }}
        >10s ⏩</button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          style={{
            marginLeft: "auto",
            padding: "0.38rem 0.7rem", borderRadius: "0.5rem",
            fontSize: "0.82rem", cursor: "pointer",
            background: "transparent", border: "1px solid #2a2a2a", color: "#888",
          }}
        >{fullscr ? "⛶" : "⛶"} Fullscreen</button>
      </div>

      <p style={{ fontSize: "0.75rem", color: "#555", textAlign: "center" }}>
        Player bounding boxes · Team colour labels · Ball tracking
      </p>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function VideoTab({
  done,
  isStreaming,
  phase,
  videoUrl,
}: {
  done: boolean;
  isStreaming: boolean;
  phase: number;
  videoUrl?: string;
}) {
  /* ── post-pipeline <video> ref ── */
  const videoRef = useRef<HTMLVideoElement>(null);

  /* ── live frame buffer ── */
  const [frames,    setFrames]    = useState<Uint8Array<ArrayBuffer>[]>([]);
  const [frameIdx,  setFrameIdx]  = useState(0);
  const [isLive,    setIsLive]    = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(50);  // ms between frames

  // Ref mirror of frames so callbacks don't go stale
  const framesRef = useRef<Uint8Array<ArrayBuffer>[]>([]);

  /* ── canvas ref ── */
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── Draw the selected frame on the canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameData = frames[frameIdx];
    if (!frameData) {
      // Waiting / empty state
      ctx.fillStyle = "#07090f";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle    = "rgba(255,255,255,0.08)";
      ctx.font         = "bold 15px Inter, sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚽  Connecting to stream…", CANVAS_W / 2, CANVAS_H / 2);
      ctx.textAlign    = "left";
      ctx.textBaseline = "alphabetic";
      return;
    }

    // Decode JPEG → draw on canvas
    const blob = new Blob([frameData], { type: "image/jpeg" });
    const url  = URL.createObjectURL(blob);
    const img  = new window.Image();
    img.onload = () => {
      // Guard: canvas may have unmounted by the time the image decodes
      if (!canvasRef.current) { URL.revokeObjectURL(url); return; }
      canvasRef.current.getContext("2d")?.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [frameIdx, frames]);

  /* ── Live follow: when live, always display the newest frame ── */
  useEffect(() => {
    if (isLive && frames.length > 0) {
      setFrameIdx(frames.length - 1);
    }
  }, [isLive, frames.length]);

  /* ── Sequential playback (only when not live) ── */
  useEffect(() => {
    if (!isPlaying || isLive) return;
    const id = setInterval(() => {
      setFrameIdx(idx => {
        // Stop at the last buffered frame; don't wrap
        if (idx >= framesRef.current.length - 1) return idx;
        return idx + 1;
      });
    }, playSpeed);
    return () => clearInterval(id);
  }, [isPlaying, isLive, playSpeed]);

  /* ── MJPEG capture: start when streaming begins, abort on cleanup ── */
  useEffect(() => {
    if (!isStreaming) return;

    let mounted = true;
    const controller = new AbortController();

    // Reset to a clean live session
    setFrames([]);
    setFrameIdx(0);
    setIsLive(true);
    setIsPlaying(false);
    framesRef.current = [];

    parseMjpegStream(
      `${API}/stream/frames`,
      (jpeg) => {
        if (!mounted) return;
        setFrames(prev => {
          const next = [...prev, jpeg];
          framesRef.current = next;
          return next;
        });
      },
      controller.signal,
    );

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isStreaming]);

  /* ── Post-pipeline video: reload when pipeline finishes ── */
  useEffect(() => {
    if (done && videoRef.current) videoRef.current.load();
  }, [done]);

  useEffect(() => {
    const ready = (phase >= 2 || done) && !isStreaming;
    if (ready && videoRef.current && videoRef.current.readyState === 0) {
      videoRef.current.load();
    }
  }, [phase, done, isStreaming]);

  /* ── Jump to live (stable callback — reads framesRef, not stale state) ── */
  const goLive = useCallback(() => {
    setIsPlaying(false);
    setIsLive(true);
    setFrameIdx(framesRef.current.length > 0 ? framesRef.current.length - 1 : 0);
  }, []);

  const showVideo = (phase >= 2 || done) && !isStreaming;

  /* ════════════════════════════════════════════════════════════════════════════
   * CASE 1 — Live stream with frame scrubbing
   * ════════════════════════════════════════════════════════════════════════════ */
  if (isStreaming) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        {/* ── Canvas (annotated frame) ── */}
        <div style={{ position: "relative" }}>
          {/* Status badge */}
          <div style={{
            position: "absolute", top: 10, left: 10, zIndex: 10,
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(0,0,0,0.75)",
            border: `1px solid ${isLive ? "rgba(239,68,68,0.55)" : "rgba(212,175,55,0.5)"}`,
            borderRadius: "6px", padding: "4px 10px",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", display: "inline-block",
              background: isLive ? "#ef4444" : "#D4AF37",
              animation: isLive ? "livePulse 1.2s ease-in-out infinite" : "none",
            }} />
            <span style={{
              fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em",
              color: isLive ? "#ef4444" : "#D4AF37",
            }}>
              {isLive ? "LIVE" : isPlaying ? "PLAYING" : "PAUSED"}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{
              width: "100%", height: "auto", display: "block",
              borderRadius: "0.75rem", border: "1px solid #2a2a2a",
              background: "#07090f",
            }}
          />
        </div>

        {/* ── Timeline ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.7rem", color: "#555" }}>
              Frame&nbsp;<strong style={{ color: "#888" }}>{frameIdx + 1}</strong>
              &nbsp;/&nbsp;{frames.length}
            </span>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700,
              color: isLive ? "#ef4444" : "#D4AF37",
            }}>
              {isLive ? "● LIVE" : "◈ Scrubbing"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(frames.length - 1, 0)}
            value={frameIdx}
            onChange={e => {
              setIsLive(false);
              setIsPlaying(false);
              setFrameIdx(Number(e.target.value));
            }}
            style={{ width: "100%", accentColor: "#D4AF37", cursor: "pointer", height: "4px" }}
          />
        </div>

        {/* ── Controls ── */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Play / Pause */}
          <button
            onClick={() => { setIsLive(false); setIsPlaying(p => !p); }}
            style={{
              padding: "0.38rem 0.85rem", borderRadius: "0.5rem",
              fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              background: (isPlaying && !isLive) ? "rgba(212,175,55,0.12)" : "transparent",
              border:     (isPlaying && !isLive) ? "1px solid #D4AF37"         : "1px solid #2a2a2a",
              color:      (isPlaying && !isLive) ? "#D4AF37"                   : "#888",
            }}
          >
            {isPlaying && !isLive ? "⏸ Pause" : "▶ Play"}
          </button>

          {/* Live */}
          <button
            onClick={goLive}
            style={{
              padding: "0.38rem 0.85rem", borderRadius: "0.5rem",
              fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "5px",
              background: isLive ? "rgba(239,68,68,0.1)"    : "transparent",
              border:     isLive ? "1px solid rgba(239,68,68,0.5)" : "1px solid #2a2a2a",
              color:      isLive ? "#ef4444"                  : "#888",
            }}
          >
            {isLive && (
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#ef4444", display: "inline-block",
                animation: "livePulse 1.2s ease-in-out infinite",
              }} />
            )}
            ⏺ Live
          </button>

          {/* Speed */}
          <select
            value={playSpeed}
            onChange={e => setPlaySpeed(Number(e.target.value))}
            style={{
              padding: "0.38rem 0.5rem", borderRadius: "0.5rem",
              fontSize: "0.82rem", fontWeight: 600,
              background: "#111", border: "1px solid #2a2a2a", color: "#888",
              cursor: "pointer",
            }}
          >
            <option value={200}>0.25×</option>
            <option value={100}>0.5×</option>
            <option value={50}>1×</option>
            <option value={25}>2×</option>
            <option value={12}>4×</option>
          </select>

          <span style={{ fontSize: "0.7rem", color: "#444", marginLeft: "auto" }}>
            ⚽ Tracking players in real time
          </span>
        </div>

        <style>{`
          @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        `}</style>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════════
   * CASE 2 — Post-pipeline: custom video player (play/pause, seek, speed)
   * ════════════════════════════════════════════════════════════════════════════ */
  if (showVideo) {
    return <TrackedVideoPlayer done={done} videoRef={videoRef} videoUrl={videoUrl} />;
  }

  /* ════════════════════════════════════════════════════════════════════════════
   * CASE 3 — Idle: pitch placeholder
   * ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{
        position: "relative", background: "#050505",
        borderRadius: "0.75rem", overflow: "hidden",
        aspectRatio: "16/9", display: "flex",
        alignItems: "center", justifyContent: "center",
        border: "1px solid #2a2a2a",
      }}>
        <svg viewBox="0 0 640 360" width="100%" height="100%" style={{ opacity: 0.12 }}>
          <rect x="20" y="20" width="600" height="320" rx="3" fill="none" stroke="#22c55e" strokeWidth="2" />
          <line x1="320" y1="20" x2="320" y2="340" stroke="#22c55e" strokeWidth="1" />
          <circle cx="320" cy="180" r="50" fill="none" stroke="#22c55e" strokeWidth="1" />
          <rect x="20" y="115" width="90" height="130" fill="none" stroke="#22c55e" strokeWidth="1" />
          <rect x="530" y="115" width="90" height="130" fill="none" stroke="#22c55e" strokeWidth="1" />
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>⚽</div>
          <p style={{ fontSize: "0.85rem", color: "#888" }}>Tracked video preview</p>
          <p style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.25rem" }}>
            Run the pipeline to see real output
          </p>
        </div>
      </div>
    </div>
  );
}
