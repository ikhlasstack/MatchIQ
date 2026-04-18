"""
MatchIQ FastAPI Backend
========================
Start from the Pipeline/ folder:

    uvicorn api_server:app --port 8000

Then open: http://localhost:3000/demo
"""

import os
import sys

# The system libcudart.so.12 is v12.0 but cuDNN 9.x needs 12.1+. We must
# preload the venv's libcudart.so.12 (12.1) FIRST so cuDNN links against it
# instead of the stale system version — otherwise cudnnCreate() fails with
# CUDNN_STATUS_NOT_INITIALIZED (error 1001).
try:
    import ctypes
    from pathlib import Path as _Path
    import nvidia.cuda_runtime as _cuda_rt
    import nvidia.cudnn as _cudnn
    _rt_lib = _Path(_cuda_rt.__file__).parent / "lib" / "libcudart.so.12"
    if _rt_lib.exists():
        ctypes.CDLL(str(_rt_lib), mode=ctypes.RTLD_GLOBAL)
    _cudnn_lib = _Path(_cudnn.__file__).parent / "lib" / "libcudnn.so.9"
    if _cudnn_lib.exists():
        ctypes.CDLL(str(_cudnn_lib), mode=ctypes.RTLD_GLOBAL)
except Exception:
    pass

import io
import queue
import threading
import zipfile
from pathlib import Path

import cv2
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

# ── Resolve project paths ──────────────────────────────────────────────────────
PIPELINE_DIR  = Path(__file__).parent.resolve()
PROJECT_ROOT  = PIPELINE_DIR.parent
TEST_DATA_DIR = PROJECT_ROOT / "Test_Data"
CSV_DIR       = PROJECT_ROOT / "Match_Data_CSV"
INPUT_VIDEO   = TEST_DATA_DIR / "Testing.mp4"
TRACKED_VIDEO = TEST_DATA_DIR / "tracked_output.mp4"

# Pipeline scripts use CWD-relative paths — must be PROJECT_ROOT
os.chdir(PROJECT_ROOT)
sys.path.insert(0, str(PIPELINE_DIR))

# Load API keys from Pipeline/.env  (ROBOFLOW_API_KEY, HF_TOKEN, etc.)
from dotenv import load_dotenv          # noqa: E402
load_dotenv("../.env")

# ── Pitch coordinate normalisation ─────────────────────────────────────────────
_PX_MIN, _PX_MAX = 1405.4, 11780.6
_PY_MIN, _PY_MAX = 46.9,   7082.8


def _norm_pct(px, py):
    try:
        px, py = float(px), float(py)
    except (TypeError, ValueError):
        return None, None
    if 0 <= px <= 105 and 0 <= py <= 68:
        return round(px / 105 * 100, 2), round(py / 68 * 100, 2)
    x = (px - _PX_MIN) / (_PX_MAX - _PX_MIN) * 100
    y = (py - _PY_MIN) / (_PY_MAX - _PY_MIN) * 100
    return round(max(0.0, min(100.0, x)), 2), round(max(0.0, min(100.0, y)), 2)


# ── Frame streaming queue ──────────────────────────────────────────────────────
# Each element is raw JPEG bytes; None is the end-of-stream sentinel.
_frame_queue: queue.Queue = queue.Queue(maxsize=60)
_orig_video_writer = None          # saved reference during cv2 patch


class _StreamingVideoWriter:
    """Wraps cv2.VideoWriter so every written frame is also pushed to the
    MJPEG queue for live browser preview."""

    def __init__(self, *args, **kwargs):
        self._w = _orig_video_writer(*args, **kwargs)

    def write(self, frame):
        self._w.write(frame)
        ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
        if ok:
            try:
                _frame_queue.put_nowait(jpg.tobytes())
            except queue.Full:
                pass   # drop frame — consumer is too slow

    def release(self):
        self._w.release()

    def isOpened(self):
        return self._w.isOpened()

    def __getattr__(self, name):
        return getattr(self._w, name)


def _run_tracking_with_stream():
    """Calls player_tracking() while streaming each annotated frame via MJPEG.
    Patches cv2.VideoWriter at the module level so Player_Track.py intercepts it
    without any modification to that file."""
    global _orig_video_writer
    from Player_Track import player_tracking  # noqa: PLC0415

    # Clear any stale frames from a previous run
    while not _frame_queue.empty():
        try:
            _frame_queue.get_nowait()
        except queue.Empty:
            break

    _set(streaming=True)
    _orig_video_writer = cv2.VideoWriter
    cv2.VideoWriter = _StreamingVideoWriter
    try:
        player_tracking()
    finally:
        cv2.VideoWriter = _orig_video_writer
        _orig_video_writer = None
        _frame_queue.put(None)          # end-of-stream sentinel
        _set(streaming=False)


# ── Shared pipeline status ─────────────────────────────────────────────────────
_STATUS: dict = {
    "phase":     0,
    "done":      False,
    "error":     None,
    "running":   False,
    "streaming": False,   # True only while MJPEG frames are being pushed
}
_lock = threading.Lock()


def _set(**kw):
    with _lock:
        _STATUS.update(kw)


# ── Background pipeline runner ─────────────────────────────────────────────────
def _run_pipeline():
    _set(running=True, done=False, error=None, phase=0, streaming=False)
    try:
        from Movement_Features import features      # noqa
        from Fatigue           import fatigue       # noqa
        from goal_prob         import goal_prob     # noqa
        from Match_Outcome     import Match_Outcome # noqa

        # ── Phase 1: Player tracking — skipped for testing (existing CSVs used) ──
        _set(phase=1)
        _run_tracking_with_stream()

        # ── Phase 2: Movement features ────────────────────────────────────────
        _set(phase=2)
        features()

        # ── Phase 3: Fatigue + goal probability ───────────────────────────────
        _set(phase=3)
        fatigue()
        goal_prob()

        # ── Phase 4: Match outcome ────────────────────────────────────────────
        _set(phase=4)
        Match_Outcome()

        _set(done=True, running=False)

    except Exception as exc:
        _set(error=str(exc), running=False, streaming=False)


# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="MatchIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── GET / — health ─────────────────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status": "ok", "message": "MatchIQ API running"}


# ── POST /upload ───────────────────────────────────────────────────────────────
@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    TEST_DATA_DIR.mkdir(exist_ok=True)
    data = await file.read()
    INPUT_VIDEO.write_bytes(data)
    _set(phase=0, done=False, error=None, running=False, streaming=False)
    return {"ok": True, "filename": file.filename, "bytes": len(data)}


# ── POST /run ──────────────────────────────────────────────────────────────────
@app.post("/run")
def run_pipeline():
    with _lock:
        if _STATUS["running"]:
            raise HTTPException(status_code=409, detail="Pipeline already running")
        if not INPUT_VIDEO.exists():
            raise HTTPException(status_code=400, detail="No video uploaded yet")
    t = threading.Thread(target=_run_pipeline, daemon=True)
    t.start()
    return {"ok": True}


# ── GET /status ────────────────────────────────────────────────────────────────
@app.get("/status")
def get_status():
    with _lock:
        return dict(_STATUS)


# ── GET /stream/frames — live MJPEG during tracking ───────────────────────────
@app.get("/stream/frames")
def stream_frames():
    """Returns a multipart/x-mixed-replace MJPEG stream.
    Browser <img> tags natively render this as a live video feed."""

    def generate():
        while True:
            try:
                frame_bytes = _frame_queue.get(timeout=5.0)
            except queue.Empty:
                # Still waiting — check if we should give up
                with _lock:
                    if not _STATUS["streaming"]:
                        break
                continue

            if frame_bytes is None:    # end-of-stream sentinel
                break

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame_bytes
                + b"\r\n"
            )

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /results/fatigue ───────────────────────────────────────────────────────
@app.get("/results/fatigue")
def results_fatigue():
    path = CSV_DIR / "1_fatigue_scores.csv"
    if not path.exists():
        return []
    df = pd.read_csv(path).reset_index()
    df["fatigue_score"] = (df["fatigue_score"] * 100).round(1)
    records = []
    for _, row in df.iterrows():
        pid = row.get("player_id", row.get("index", "?"))
        records.append({
            "label": f"P{int(pid)}",
            "score": float(row["fatigue_score"]),
            "level": str(row.get("fatigue_level", "LOW")),
            "team":  int(row["team_id"]) if pd.notna(row.get("team_id")) else -1,
        })
    return records


# ── GET /results/goal-prob ─────────────────────────────────────────────────────
@app.get("/results/goal-prob")
def results_goal_prob():
    path = CSV_DIR / "1_goal_predictions.csv"
    if not path.exists():
        return []
    df     = pd.read_csv(path)
    frames = sorted(df["frame"].unique())
    step   = max(1, len(frames) // 150)
    result = []
    for frame in frames[::step]:
        fdf = df[df["frame"] == frame]
        t0  = fdf[fdf["team_id"] == 0]["goal_probability"].max()
        t1  = fdf[fdf["team_id"] == 1]["goal_probability"].max()
        result.append({
            "frame": int(frame),
            "t0": round(float(t0) if pd.notna(t0) else 0.0, 3),
            "t1": round(float(t1) if pd.notna(t1) else 0.0, 3),
        })
    return result


# ── GET /results/outcome ───────────────────────────────────────────────────────
@app.get("/results/outcome")
def results_outcome():
    path = CSV_DIR / "1_match_predictions.csv"
    if not path.exists():
        return {}
    row = pd.read_csv(path).iloc[0].to_dict()

    def pct(k): return round(float(row.get(k, 0)) * 100, 1)
    def val(k): return round(float(row.get(k, 0)), 1)

    return {
        "winA":       pct("win_prob_team0"),
        "draw":       pct("draw_prob"),
        "winB":       pct("win_prob_team1"),
        "possession": {"t0": val("possession_team0"), "t1": val("possession_team1")},
        "shots":      {"t0": int(row.get("shots_team0", 0)), "t1": int(row.get("shots_team1", 0))},
        "territory":  {"t0": val("territory_team0"),  "t1": val("territory_team1")},
        "momentum":   {"t0": val("momentum_team0"),   "t1": val("momentum_team1")},
    }


# ── GET /results/tracking ──────────────────────────────────────────────────────
@app.get("/results/tracking")
def results_tracking():
    path = CSV_DIR / "1_tracking.csv"
    if not path.exists():
        return []
    df         = pd.read_csv(path)
    last_frame = df["frame"].max()
    records    = []
    for _, row in df[df["frame"] == last_frame].iterrows():
        px, py = _norm_pct(row.get("pitch_x"), row.get("pitch_y"))
        if px is None:
            raw_x = row.get("x", 960)
            raw_y = row.get("y", 540)
            px = round(float(raw_x) / 1920 * 100, 2) if pd.notna(raw_x) else 50.0
            py = round(float(raw_y) / 1080 * 100, 2) if pd.notna(raw_y) else 50.0
        records.append({
            "id":   int(row["player_id"]),
            "team": int(row["team_id"]) if pd.notna(row.get("team_id")) else -1,
            "role": str(row["role"]),
            "x":    px,
            "y":    py,
        })
    return records


# ── GET /video/tracked ─────────────────────────────────────────────────────────
@app.get("/video/tracked")
def video_tracked():
    if not TRACKED_VIDEO.exists() or TRACKED_VIDEO.stat().st_size == 0:
        raise HTTPException(status_code=404, detail="Tracked video not ready yet")
    return FileResponse(
        str(TRACKED_VIDEO),
        media_type="video/mp4",
        headers={
            "Content-Disposition": "inline; filename=tracked_output.mp4",
            "Accept-Ranges": "bytes",
        },
    )


# ── GET /download/csv ──────────────────────────────────────────────────────────
@app.get("/download/csv")
def download_csv():
    csv_files = list(CSV_DIR.glob("*.csv"))
    if not csv_files:
        raise HTTPException(status_code=404, detail="No CSV files found yet")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in csv_files:
            zf.write(f, f.name)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=matchiq_data.zip"},
    )


# ── dev entry ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
