"use client";

export interface OverlayToggles {
  showDetection: boolean;
  showDirection: boolean;
  showSkeleton:  boolean;
}

const TOGGLES: { key: keyof OverlayToggles; label: string; icon: string; liveOnly?: boolean }[] = [
  { key: "showDetection", label: "Detection", icon: "◎" },
  { key: "showDirection", label: "Direction", icon: "▲" },
  { key: "showSkeleton",  label: "Skeleton",  icon: "🦴", liveOnly: true },
];

export default function OverlayToggleBar({
  toggles,
  onChange,
  isStreaming = false,
}: {
  toggles:     OverlayToggles;
  onChange:    (next: OverlayToggles) => void;
  isStreaming?: boolean;
}) {
  const flip = (key: keyof OverlayToggles) =>
    onChange({ ...toggles, [key]: !toggles[key] });

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.6rem 0.75rem",
      background: "#111", border: "1px solid #2a2a2a",
      borderRadius: "0.75rem", flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#444", fontWeight: 600, marginRight: "0.25rem" }}>
        Overlays
      </span>
      {TOGGLES.map(({ key, label, icon, liveOnly }) => {
        const on       = toggles[key];
        const disabled = liveOnly && !isStreaming;
        return (
          <button
            key={key}
            onClick={() => !disabled && flip(key)}
            title={disabled ? "Only available during live stream" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "0.3rem 0.75rem", borderRadius: "999px",
              fontSize: "0.78rem", fontWeight: 600,
              cursor:     disabled ? "not-allowed" : "pointer",
              opacity:    disabled ? 0.35 : 1,
              transition: "all 0.15s",
              background: on && !disabled ? "rgba(212,175,55,0.15)" : "transparent",
              border:     on && !disabled ? "1px solid rgba(212,175,55,0.6)" : "1px solid #2a2a2a",
              color:      on && !disabled ? "#D4AF37" : "#555",
            }}
          >
            <span style={{ fontSize: "0.7rem" }}>{icon}</span>
            {label}
            {liveOnly && <span style={{ fontSize: "0.58rem", color: "#444", marginLeft: "2px" }}>live</span>}
          </button>
        );
      })}
    </div>
  );
}
