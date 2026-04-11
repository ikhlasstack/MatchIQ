import React, { useEffect, useRef } from "react";

function drawOverlays(ctx, frame, overlays) {
    if (!ctx || !frame) return;
    if (overlays.detections && Array.isArray(frame.detections)) {
        const sourceWidth = frame.frame_width || ctx.canvas.width;
        const sourceHeight = frame.frame_height || ctx.canvas.height;
        const scaleX = ctx.canvas.width / sourceWidth;
        const scaleY = ctx.canvas.height / sourceHeight;

        ctx.lineWidth = 2;
        ctx.font = "14px sans-serif";
        frame.detections.forEach((det) => {
            const [x1, y1, x2, y2] = det.bbox || [0, 0, 0, 0];
            const role = det.role || "object";
            const color = role === "ball" ? "#ffd400" : det.team_id === 0 ? "#18a0fb" : det.team_id === 1 ? "#ff4d6d" : "#ffffff";
            const left = x1 * scaleX;
            const top = y1 * scaleY;
            const width = (x2 - x1) * scaleX;
            const height = (y2 - y1) * scaleY;
            const label = role === "ball" ? "Ball" : `#${det.player_id} ${role}`;

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.strokeRect(left, top, width, height);
            ctx.fillText(label, left, Math.max(top - 6, 12));
        });
    }
}

export default function VideoCanvas({ frame, overlays, width, height }) {
    const canvasRef = useRef();

    useEffect(() => {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        if (frame && frame.image) {
            const img = new window.Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, width, height);
                drawOverlays(ctx, frame, overlays);
            };
            img.src = "data:image/jpeg;base64," + frame.image;
        }
    }, [frame, overlays, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ border: "1px solid #ccc", background: "#222" }}
        />
    );
}
