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

import base64
import io
import json
import queue
import shutil
import subprocess
import threading
import zipfile
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from fastapi import Body, FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

# ── Resolve project paths ──────────────────────────────────────────────────────
PIPELINE_DIR  = Path(__file__).parent.resolve()
PROJECT_ROOT  = PIPELINE_DIR.parent
TEST_DATA_DIR = PROJECT_ROOT / "Test_Data"
CSV_DIR       = PROJECT_ROOT / "Match_Data_CSV"
SAVED_DIR     = PROJECT_ROOT / "Saved_Matches"
INPUT_VIDEO   = TEST_DATA_DIR / "Testing.mp4"
TRACKED_VIDEO = TEST_DATA_DIR / "tracked_output.mp4"

# Pipeline scripts use CWD-relative paths — must be PROJECT_ROOT
os.chdir(PROJECT_ROOT)
sys.path.insert(0, str(PIPELINE_DIR))

# Load API keys from Pipeline/.env  (ROBOFLOW_API_KEY, HF_TOKEN, etc.)
from dotenv import load_dotenv          # noqa: E402
load_dotenv(PIPELINE_DIR / ".env")

# ── Pre-loaded detection models (loaded once at startup, reused every pipeline run) ──
_player_model  = None
_field_model   = None
_models_ready  = False   # set to True once models are loaded and warmed up

# ── Real-time tracker (one shared instance; reset per session) ─────────────────
_rt_tracker = None          # RealTimeTracker | None
_rt_lock    = threading.Lock()
_rt_frame_queue: queue.Queue = queue.Queue(maxsize=30)  # annotated JPEG bytes for /stream/realtime

# ── Stream-capture state (one active stream session at a time) ─────────────────
_stream_stop  = threading.Event()   # set to kill the capture thread
_stream_thread: threading.Thread | None = None


def _load_models():
    global _player_model, _field_model, _models_ready
    from inference import get_model  # noqa: PLC0415
    api_key = os.getenv("ROBOFLOW_API_KEY")
    print("[MatchIQ] Loading player detection model...")
    _player_model = get_model(model_id="football-vgiqa-3njno/2", api_key=api_key)
    print("[MatchIQ] Loading field detection model...")
    _field_model  = get_model(model_id="football-field-detection-f07vi/14", api_key=api_key)
    print("[MatchIQ] Warming up models (first-inference JIT)...")
    try:
        import numpy as _np
        _dummy = _np.zeros((64, 64, 3), dtype=_np.uint8)
        _player_model.infer(_dummy, confidence=0.3)
        _field_model.infer(_dummy, confidence=0.3)
    except Exception as _e:
        print(f"[MatchIQ] Warmup warning (non-fatal): {_e}")
    _models_ready = True
    print("[MatchIQ] Models ready.")


# ── Uploaded video filename (set during /upload, read by _save_match) ──────────
_uploaded_filename: str = "Unknown.mp4"


# ── Player/team naming helpers ─────────────────────────────────────────────────
def _names_path(match_dir: Path) -> Path:
    return match_dir / "names.json"


def _read_names(match_dir: Path) -> dict:
    p = _names_path(match_dir)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {"players": {}, "teams": {}}


def _write_names(match_dir: Path, data: dict) -> None:
    _names_path(match_dir).write_text(json.dumps(data, indent=2))


# ── Persistent match storage ───────────────────────────────────────────────────
def _save_match(original_name: str):
    """Copy all pipeline outputs into a timestamped folder under Saved_Matches/."""
    match_id  = "match_" + datetime.now().strftime("%Y%m%d_%H%M%S")
    match_dir = SAVED_DIR / match_id
    match_dir.mkdir(parents=True, exist_ok=True)

    csv_names = [
        "1_tracking.csv",
        "1_Movement_Features.csv",
        "1_fatigue_scores.csv",
        "1_goal_predictions.csv",
        "1_match_predictions.csv",
    ]
    for name in csv_names:
        src = CSV_DIR / name
        if src.exists():
            shutil.copy2(src, match_dir / name)

    if TRACKED_VIDEO.exists():
        shutil.copy2(TRACKED_VIDEO, match_dir / "tracked_output.mp4")

    if INPUT_VIDEO.exists():
        shutil.copy2(INPUT_VIDEO, match_dir / "source_video.mp4")

    # Derive stats from tracking CSV
    tracking_csv = match_dir / "1_tracking.csv"
    frames, players, duration_str = 0, 0, "00:00"
    if tracking_csv.exists():
        import pandas as _pd
        df = _pd.read_csv(tracking_csv)
        frames  = int(df["frame"].max()) + 1 if not df.empty else 0
        players = int(df[~df["role"].str.lower().isin(_EXCLUDE_ROLES)]["player_id"].nunique())
        fps     = 25
        secs    = frames // fps
        duration_str = f"{secs // 60:02d}:{secs % 60:02d}"

    meta = {
        "id":       match_id,
        "name":     original_name,
        "date":     datetime.now().strftime("%Y-%m-%d"),
        "saved_at": datetime.now().isoformat(timespec="seconds"),
        "duration": duration_str,
        "frames":   frames,
        "players":  players,
    }
    (match_dir / "meta.json").write_text(json.dumps(meta, indent=2))
    # Initialise an empty names file so the frontend can immediately PUT to it
    _write_names(match_dir, {"players": {}, "teams": {}})
    print(f"[MatchIQ] Match saved → {match_dir}")
    return match_id


# ── Non-player ID helper ───────────────────────────────────────────────────────
_EXCLUDE_ROLES = {"referee", "ball"}

def _non_player_ids(csv_dir: Path) -> set:
    """Return player_ids whose role is referee or ball in the tracking CSV."""
    tracking = csv_dir / "1_tracking.csv"
    if not tracking.exists():
        return set()
    df = pd.read_csv(tracking, usecols=["player_id", "role"])
    return set(df.loc[df["role"].str.lower().isin(_EXCLUDE_ROLES), "player_id"].unique())


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
_latest_positions: list = []       # live tracking rows for /stream/positions
_mjpeg_client_count: int = 0       # number of active /stream/frames consumers
_mjpeg_count_lock = threading.Lock()

# ── WebSocket connection manager ───────────────────────────────────────────────
# Each entry is (WebSocket, asyncio.AbstractEventLoop)
_ws_clients: list = []
_ws_lock = threading.Lock()

import asyncio as _asyncio
from contextlib import asynccontextmanager


def _ws_broadcast(message: dict):
    """Push a JSON message to every connected WS client from any thread."""
    text = json.dumps(message)
    with _ws_lock:
        clients = list(_ws_clients)
    for ws, loop in clients:
        try:
            _asyncio.run_coroutine_threadsafe(ws.send_text(text), loop)
        except Exception:
            pass


class _StreamingVideoWriter:
    """Wraps cv2.VideoWriter so every written frame is also pushed to the
    MJPEG queue for live browser preview."""

    def __init__(self, *args, **kwargs):
        self._w = _orig_video_writer(*args, **kwargs)

    def write(self, frame):
        self._w.write(frame)
        with _mjpeg_count_lock:
            has_clients = _mjpeg_client_count > 0
        if has_clients:   # skip JPEG encode when no client is watching
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

    global _latest_positions
    _latest_positions = []

    def _on_frame(rows):
        global _latest_positions
        _latest_positions = rows
        _ws_broadcast({"type": "positions", "rows": rows})

    _set(streaming=True)
    _orig_video_writer = cv2.VideoWriter
    cv2.VideoWriter = _StreamingVideoWriter
    try:
        player_tracking(player_model=_player_model, field_model=_field_model, on_frame=_on_frame, cancel_event=_cancel_event)
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
    "match_id":  None,    # Set after _save_match completes
    "cancelled": False,
}
_lock = threading.Lock()
_cancel_event = threading.Event()


def _set(**kw):
    with _lock:
        _STATUS.update(kw)
        snapshot = dict(_STATUS)
    _ws_broadcast({"type": "status", **snapshot})


# ── Background pipeline runner ─────────────────────────────────────────────────
def _run_pipeline():
    _cancel_event.clear()
    _set(running=True, done=False, error=None, phase=0, streaming=False, cancelled=False, match_id=None)
    try:
        from Movement_Features import features      # noqa
        from Fatigue           import fatigue       # noqa
        from goal_prob         import goal_prob     # noqa
        from Match_Outcome     import Match_Outcome # noqa

        # ── Phase 1: Player tracking ──────────────────────────────────────────
        _set(phase=1)
        _run_tracking_with_stream()

        if _cancel_event.is_set():
            saved_id = _save_match(original_name=_uploaded_filename)
            _set(cancelled=True, running=False, match_id=saved_id)
            return

        # ── Phase 2: Movement features ────────────────────────────────────────
        _set(phase=2)
        features()

        if _cancel_event.is_set():
            saved_id = _save_match(original_name=_uploaded_filename)
            _set(cancelled=True, running=False, match_id=saved_id)
            return

        # ── Phase 3: Fatigue + goal probability ───────────────────────────────
        _set(phase=3)
        fatigue()
        goal_prob()

        if _cancel_event.is_set():
            saved_id = _save_match(original_name=_uploaded_filename)
            _set(cancelled=True, running=False, match_id=saved_id)
            return

        # ── Phase 4: Match outcome ────────────────────────────────────────────
        _set(phase=4)
        Match_Outcome()

        saved_id = _save_match(original_name=_uploaded_filename)
        _set(done=True, running=False, match_id=saved_id)

    except Exception as exc:
        _set(error=str(exc), running=False, streaming=False)


# ── FastAPI app ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def _lifespan(app):
    threading.Thread(target=_load_models, daemon=True, name="model-loader").start()
    yield


app = FastAPI(title="MatchIQ API", version="1.0.0", lifespan=_lifespan)

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
    global _uploaded_filename
    TEST_DATA_DIR.mkdir(exist_ok=True)
    data = await file.read()
    INPUT_VIDEO.write_bytes(data)
    _uploaded_filename = file.filename or "Unknown.mp4"
    _set(phase=0, done=False, error=None, running=False, streaming=False, match_id=None, cancelled=False)
    return {"ok": True, "filename": file.filename, "bytes": len(data)}


# ── POST /run ──────────────────────────────────────────────────────────────────
@app.post("/run")
def run_pipeline():
    if not _models_ready:
        raise HTTPException(status_code=503, detail="Models are still loading, please wait")
    with _lock:
        if _STATUS["running"]:
            raise HTTPException(status_code=409, detail="Pipeline already running")
        if not INPUT_VIDEO.exists():
            raise HTTPException(status_code=400, detail="No video uploaded yet")
    t = threading.Thread(target=_run_pipeline, daemon=True)
    t.start()
    return {"ok": True}


# ── POST /cancel ──────────────────────────────────────────────────────────────
@app.post("/cancel")
def cancel_pipeline():
    with _lock:
        if not _STATUS["running"]:
            raise HTTPException(status_code=409, detail="No pipeline running")
    _cancel_event.set()
    return {"ok": True}


# ── GET /status ────────────────────────────────────────────────────────────────
@app.get("/status")
def get_status():
    with _lock:
        status = dict(_STATUS)
    status["models_ready"] = _models_ready
    return status


# ── Stream URL resolver ────────────────────────────────────────────────────────
# Resolve binaries relative to the running Python so venv tools are always found
_VENV_BIN = Path(sys.executable).parent
_STREAMLINK = str(_VENV_BIN / "streamlink")
_YTDLP      = str(_VENV_BIN / "yt-dlp")


def _resolve_stream_url(url: str) -> str:
    """Return a direct streamable URL using streamlink (live-first), falling back to yt-dlp."""
    # 1. Try streamlink — best for live streams (YouTube Live, Twitch, etc.)
    try:
        result = subprocess.run(
            [_STREAMLINK, "--stream-url", url, "best"],
            capture_output=True, text=True, timeout=20,
        )
        direct = result.stdout.strip()
        if direct and direct.startswith("http"):
            return direct
        if result.stderr:
            print(f"[streamlink stderr] {result.stderr.strip()}")
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        print(f"[streamlink] {e}")

    # 2. Fall back to yt-dlp — better for VODs
    try:
        result = subprocess.run(
            [_YTDLP, "-g", "--no-playlist", "-f", "best[ext=mp4]/best", url],
            capture_output=True, text=True, timeout=30,
        )
        direct = result.stdout.strip().splitlines()[0] if result.stdout.strip() else ""
        if direct and direct.startswith("http"):
            return direct
        if result.stderr:
            print(f"[yt-dlp stderr] {result.stderr.strip()}")
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        print(f"[yt-dlp] {e}")

    raise RuntimeError("Could not resolve stream URL — streamlink and yt-dlp both failed")


# ── Stream capture thread ──────────────────────────────────────────────────────
def _stream_capture_thread(direct_url: str, ws: "WebSocket", loop: "_asyncio.AbstractEventLoop"):
    """Read frames from a direct stream URL, run RealTimeTracker, push results over WS."""
    global _rt_tracker

    def _send(payload: dict):
        text = json.dumps(payload)
        try:
            _asyncio.run_coroutine_threadsafe(ws.send_text(text), loop)
        except Exception:
            pass

    # Reset tracker for a new session
    with _rt_lock:
        from Player_Track import RealTimeTracker  # noqa: PLC0415
        _rt_tracker = RealTimeTracker(_player_model, _field_model)
        tracker = _rt_tracker

    cap = cv2.VideoCapture(direct_url)
    if not cap.isOpened():
        _send({"type": "rt_error", "detail": "cv2.VideoCapture could not open the stream URL"})
        return

    _send({"type": "rt_status", "status": "streaming"})

    skip_count = 0

    try:
        while not _stream_stop.is_set():
            ok, frame = cap.read()
            if not ok:
                # Live streams may stall briefly; VODs end here
                break

            # Skip frames if we're falling behind (keep latency low)
            skip_count += 1
            if skip_count % 2 != 0:   # process every other frame → ~TARGET_FPS/2 effective
                continue

            try:
                jpeg_bytes, live_rows = tracker.process_frame(frame)
            except Exception as exc:
                _send({"type": "rt_error", "detail": str(exc)})
                continue

            if jpeg_bytes:
                _send({"type": "rt_frame", "image": base64.b64encode(jpeg_bytes).decode()})
            if live_rows:
                _send({"type": "positions", "rows": live_rows})

    finally:
        cap.release()
        _send({"type": "rt_status", "status": "stopped"})


# ── Real-time frame processor (runs in thread-pool via asyncio) ────────────────
def _process_rt_frame(jpeg_b64: str) -> tuple[bytes, list]:
    """Decode a base64 JPEG, run RealTimeTracker, return (annotated_jpeg, live_rows)."""
    global _rt_tracker
    img_bytes = base64.b64decode(jpeg_b64)
    arr       = np.frombuffer(img_bytes, dtype=np.uint8)
    frame     = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return b"", []
    with _rt_lock:
        if _rt_tracker is None:
            from Player_Track import RealTimeTracker  # noqa: PLC0415
            _rt_tracker = RealTimeTracker(_player_model, _field_model)
        tracker = _rt_tracker
    # Process outside the lock so other frames aren't held up
    return tracker.process_frame(frame)


# ── WebSocket /ws — push status + live positions ──────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    loop = _asyncio.get_running_loop()
    with _ws_lock:
        _ws_clients.append((ws, loop))
    # Send current status immediately so the client doesn't wait for next event
    with _lock:
        snapshot = dict(_STATUS)
    await ws.send_text(json.dumps({"type": "status", **snapshot}))
    # Also send last known positions if streaming
    if _latest_positions:
        await ws.send_text(json.dumps({"type": "positions", "rows": _latest_positions}))
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if msg.get("type") == "frame":
                b64 = msg.get("image", "")
                if not b64:
                    continue
                if not _models_ready:
                    await ws.send_text(json.dumps({"type": "rt_error", "detail": "Models not ready"}))
                    continue
                try:
                    jpeg_bytes, live_rows = await _asyncio.get_event_loop().run_in_executor(
                        None, _process_rt_frame, b64
                    )
                except Exception as exc:
                    await ws.send_text(json.dumps({"type": "rt_error", "detail": str(exc)}))
                    continue
                if jpeg_bytes:
                    ann_b64 = base64.b64encode(jpeg_bytes).decode()
                    await ws.send_text(json.dumps({"type": "rt_frame", "image": ann_b64}))
                if live_rows:
                    await ws.send_text(json.dumps({"type": "positions", "rows": live_rows}))

            elif msg.get("type") == "yt_start":
                global _stream_stop, _stream_thread
                url = msg.get("url", "").strip()
                if not url:
                    await ws.send_text(json.dumps({"type": "rt_error", "detail": "No URL provided"}))
                    continue
                if not _models_ready:
                    await ws.send_text(json.dumps({"type": "rt_error", "detail": "Models not ready"}))
                    continue

                # Stop any existing stream
                _stream_stop.set()
                if _stream_thread and _stream_thread.is_alive():
                    _stream_thread.join(timeout=5)

                await ws.send_text(json.dumps({"type": "rt_status", "status": "resolving"}))

                try:
                    direct_url = await _asyncio.get_event_loop().run_in_executor(
                        None, _resolve_stream_url, url
                    )
                except Exception as exc:
                    await ws.send_text(json.dumps({"type": "rt_error", "detail": str(exc)}))
                    continue

                _stream_stop.clear()
                _stream_thread = threading.Thread(
                    target=_stream_capture_thread,
                    args=(direct_url, ws, loop),
                    daemon=True,
                    name="stream-capture",
                )
                _stream_thread.start()

            elif msg.get("type") == "yt_stop":
                _stream_stop.set()
                await ws.send_text(json.dumps({"type": "rt_status", "status": "stopped"}))

    except WebSocketDisconnect:
        pass
    finally:
        _stream_stop.set()   # kill capture thread if this client owned it
        with _ws_lock:
            _ws_clients[:] = [(w, l) for w, l in _ws_clients if w is not ws]


# ── POST /realtime/reset — reset the real-time tracker state ──────────────────
@app.post("/realtime/reset")
def reset_realtime():
    """Reset the RealTimeTracker so a new session starts with clean state."""
    global _rt_tracker
    with _rt_lock:
        _rt_tracker = None
    return {"ok": True}


# ── GET /stream/frames — live MJPEG during tracking ───────────────────────────
@app.get("/stream/frames")
def stream_frames():
    """Returns a multipart/x-mixed-replace MJPEG stream.
    Browser <img> tags natively render this as a live video feed."""
    global _mjpeg_client_count

    def generate():
        global _mjpeg_client_count
        with _mjpeg_count_lock:
            _mjpeg_client_count += 1
        try:
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
        finally:
            with _mjpeg_count_lock:
                _mjpeg_client_count -= 1

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /stream/positions — latest player positions during tracking ────────────
@app.get("/stream/positions")
def stream_positions():
    """Returns the most recent frame's tracking rows as JSON.
    Poll this at ~10 Hz during streaming for a live minimap."""
    return _latest_positions


# ── GET /results/fatigue ───────────────────────────────────────────────────────
@app.get("/results/fatigue")
def results_fatigue():
    path = CSV_DIR / "1_fatigue_scores.csv"
    if not path.exists():
        return []
    ref_ids = _non_player_ids(CSV_DIR)
    df = pd.read_csv(path)
    df = df[~df["player_id"].isin(ref_ids)]
    df["fatigue_score"] = (df["fatigue_score"] * 100).round(1)
    df = df.sort_values("player_id")
    records = []
    for _, row in df.iterrows():
        records.append({
            "label": f"P{int(row['player_id'])}",
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
    ref_ids = _non_player_ids(CSV_DIR)
    df     = pd.read_csv(path)
    df     = df[~df["player_id"].isin(ref_ids)]
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


# ── Outcome computation helper (recalculates from raw CSVs) ───────────────────
_PITCH_X_MIN, _PITCH_X_MAX = 1405.4, 11780.6
_SHOT_THRESHOLD = 0.65
_SHOT_COOLDOWN  = 15


def _compute_outcome(csv_dir: Path) -> dict:
    """Recalculate all match outcome stats from raw CSVs, excluding referees/ball."""
    import numpy as _np

    tracking_path = csv_dir / "1_tracking.csv"
    goal_path     = csv_dir / "1_goal_predictions.csv"
    movement_path = csv_dir / "1_Movement_Features.csv"

    if not all(p.exists() for p in [tracking_path, goal_path, movement_path]):
        return {}

    tracking  = pd.read_csv(tracking_path)
    goal_df   = pd.read_csv(goal_path)
    movement  = pd.read_csv(movement_path)

    excl = _non_player_ids(csv_dir)
    gp   = goal_df[~goal_df["player_id"].isin(excl)]

    # ── Shots (deduplicated per player with frame cooldown) ──────────────────
    shots: dict = {0: 0, 1: 0}
    last_shot: dict = {}
    for _, row in gp[gp["goal_probability"] >= _SHOT_THRESHOLD].sort_values("frame").iterrows():
        pid, frame, team = int(row["player_id"]), int(row["frame"]), int(row["team_id"])
        if team not in (0, 1):
            continue
        if frame - last_shot.get(pid, -_SHOT_COOLDOWN) >= _SHOT_COOLDOWN:
            shots[team] += 1
            last_shot[pid] = frame

    # ── Average danger ────────────────────────────────────────────────────────
    avg_danger = {
        0: round(float(gp[gp["team_id"] == 0]["goal_probability"].mean() or 0), 3),
        1: round(float(gp[gp["team_id"] == 1]["goal_probability"].mean() or 0), 3),
    }

    # ── Possession (closest player to ball per frame) ─────────────────────────
    ball_df    = tracking[tracking["role"] == "ball"][["frame", "x", "y"]].rename(
        columns={"x": "ball_x", "y": "ball_y"})
    players_df = tracking[tracking["role"].isin(["player", "goalkeeper"]) &
                          ~tracking["player_id"].isin(excl)].copy()
    merged = players_df.merge(ball_df, on="frame", how="inner")
    if merged.empty:
        possession = {0: 50.0, 1: 50.0}
    else:
        merged["dist"] = _np.sqrt((merged["x"] - merged["ball_x"])**2 +
                                  (merged["y"] - merged["ball_y"])**2)
        closest = merged.loc[merged.groupby("frame")["dist"].idxmin()]
        pc  = closest["team_id"].value_counts()
        tot = pc.sum()
        possession = {
            0: round(pc.get(0, 0) / tot * 100, 1),
            1: round(pc.get(1, 0) / tot * 100, 1),
        }

    # ── Territory (fraction of frames in attacking half) ──────────────────────
    pl = tracking[tracking["role"].isin(["player", "goalkeeper"]) &
                  ~tracking["player_id"].isin(excl)].dropna(subset=["pitch_x"]).copy()
    pl["px_m"] = (pl["pitch_x"] - _PITCH_X_MIN) / (_PITCH_X_MAX - _PITCH_X_MIN) * 105
    t0 = pl[pl["team_id"] == 0]; t1 = pl[pl["team_id"] == 1]
    territory = {
        0: round(float((t0["px_m"] > 52.5).mean() * 100) if len(t0) else 50.0, 1),
        1: round(float((t1["px_m"] < 52.5).mean() * 100) if len(t1) else 50.0, 1),
    }

    # ── Momentum (avg speed in last 20% of match) ─────────────────────────────
    total_frames   = int(movement["frame"].max())
    recent_cutoff  = int(total_frames * 0.8)
    recent = movement[(movement["frame"] >= recent_cutoff) &
                      (movement["team_id"] >= 0) &
                      (~movement["player_id"].isin(excl))].copy()
    rs       = recent.groupby("team_id")["speed"].mean()
    total_rs = rs.sum()
    momentum = {
        0: round(float(rs.get(0, 0) / total_rs * 100) if total_rs > 0 else 50.0, 1),
        1: round(float(rs.get(1, 0) / total_rs * 100) if total_rs > 0 else 50.0, 1),
    }

    # ── Win probability (weighted strength → sigmoid) ─────────────────────────
    ts = shots[0] + shots[1] + 1e-6
    td = avg_danger[0] + avg_danger[1] + 1e-6
    strength = {
        t: (0.25 * shots[t] / ts +
            0.25 * avg_danger[t] / td +
            0.20 * possession[t] / 100 +
            0.15 * territory[t] / 100 +
            0.15 * momentum[t] / 100)
        for t in (0, 1)
    }
    diff = strength[0] - strength[1]
    w0   = 1 / (1 + _np.exp(-10 * diff))
    w1   = 1 - w0
    draw = max(0.0, 0.3 - abs(diff) * 2)
    tp   = w0 + w1 + draw
    w0   = round(w0   / tp * 100, 1)
    w1   = round(w1   / tp * 100, 1)
    draw = round(draw / tp * 100, 1)

    return {
        "winA":       w0,
        "draw":       draw,
        "winB":       w1,
        "possession": {"t0": possession[0], "t1": possession[1]},
        "shots":      {"t0": shots[0],      "t1": shots[1]},
        "territory":  {"t0": territory[0],  "t1": territory[1]},
        "momentum":   {"t0": momentum[0],   "t1": momentum[1]},
    }


# ── GET /results/outcome ───────────────────────────────────────────────────────
@app.get("/results/outcome")
def results_outcome():
    result = _compute_outcome(CSV_DIR)
    if not result:
        return {}
    return result


# ── GET /results/tracking ──────────────────────────────────────────────────────
@app.get("/results/tracking")
def results_tracking():
    path = CSV_DIR / "1_tracking.csv"
    if not path.exists():
        return []
    df         = pd.read_csv(path)
    # Use last frame that has at least one player/goalkeeper with valid pitch coords
    player_df = df[df["role"].isin(["player", "goalkeeper"]) & df["pitch_x"].notna()]
    if player_df.empty:
        last_frame = df["frame"].max()
    else:
        last_frame = player_df["frame"].max()
    records    = []
    vid_w = df["x"].max() if df["x"].notna().any() else 1920
    vid_h = df["y"].max() if df["y"].notna().any() else 1080
    for _, row in df[df["frame"] == last_frame].iterrows():
        px, py = _norm_pct(row.get("pitch_x"), row.get("pitch_y"))
        if px is None:
            raw_x = row.get("x", vid_w / 2)
            raw_y = row.get("y", vid_h / 2)
            px = round(float(raw_x) / vid_w * 100, 2) if pd.notna(raw_x) else 50.0
            py = round(float(raw_y) / vid_h * 100, 2) if pd.notna(raw_y) else 50.0
        records.append({
            "id":   int(row["player_id"]),
            "team": int(row["team_id"]) if pd.notna(row.get("team_id")) else -1,
            "role": str(row["role"]),
            "x":    px,
            "y":    py,
        })
    return records


# ── GET /results/tracking/frames — all frames, sampled ────────────────────────
@app.get("/results/tracking/frames")
def results_tracking_frames():
    """Return per-frame tracking data for all frames, sampled to ≤1500 frames.
    Response: { fps: int, total_frames: int, frames: { [frame: str]: TrackingRow[] } }"""
    path = CSV_DIR / "1_tracking.csv"
    if not path.exists():
        return {"fps": 25, "total_frames": 0, "frames": {}}
    df = pd.read_csv(path)
    if df.empty:
        return {"fps": 25, "total_frames": 0, "frames": {}}

    # Derive actual video resolution from pixel coordinates so the fallback is correct
    vid_w = float(df["x"].max()) if df["x"].notna().any() else 1920.0
    vid_h = float(df["y"].max()) if df["y"].notna().any() else 1080.0

    all_frames = sorted(df["frame"].unique())
    total = len(all_frames)
    # Sample evenly to at most 1500 keyframes
    step = max(1, total // 1500)
    sampled = all_frames[::step]

    out: dict = {}
    for f in sampled:
        rows = df[df["frame"] == f]
        records = []
        for _, row in rows.iterrows():
            px, py = _norm_pct(row.get("pitch_x"), row.get("pitch_y"))
            if px is None:
                raw_x = row.get("x", vid_w / 2)
                raw_y = row.get("y", vid_h / 2)
                px = round(float(raw_x) / vid_w * 100, 2) if pd.notna(raw_x) else 50.0
                py = round(float(raw_y) / vid_h * 100, 2) if pd.notna(raw_y) else 50.0
            records.append({
                "id":   int(row["player_id"]),
                "team": int(row["team_id"]) if pd.notna(row.get("team_id")) else -1,
                "role": str(row["role"]),
                "x":    px,
                "y":    py,
            })
        out[str(f)] = records

    return {"fps": 25, "total_frames": int(all_frames[-1]) + 1 if all_frames else 0, "frames": out}


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


# ── GET /matches — list all saved matches ─────────────────────────────────────
@app.get("/matches")
def list_matches():
    if not SAVED_DIR.exists():
        return []
    matches = []
    for meta_file in sorted(SAVED_DIR.glob("*/meta.json"), reverse=True):
        try:
            matches.append(json.loads(meta_file.read_text()))
        except Exception:
            pass
    return matches


# ── GET /matches/{match_id} — single match meta ───────────────────────────────
@app.get("/matches/{match_id}")
def get_match(match_id: str):
    meta_file = SAVED_DIR / match_id / "meta.json"
    if not meta_file.exists():
        raise HTTPException(status_code=404, detail="Match not found")
    return json.loads(meta_file.read_text())


# ── Helpers for saved-match result endpoints ───────────────────────────────────
def _match_dir(match_id: str) -> Path:
    d = SAVED_DIR / match_id
    if not d.exists():
        raise HTTPException(status_code=404, detail="Match not found")
    return d


# ── GET /matches/{match_id}/results/fatigue ────────────────────────────────────
@app.get("/matches/{match_id}/results/fatigue")
def saved_fatigue(match_id: str):
    d    = _match_dir(match_id)
    path = d / "1_fatigue_scores.csv"
    if not path.exists():
        return []
    ref_ids = _non_player_ids(d)
    df = pd.read_csv(path)
    df = df[~df["player_id"].isin(ref_ids)]
    df["fatigue_score"] = (df["fatigue_score"] * 100).round(1)
    df = df.sort_values("player_id")
    return [
        {
            "label": f"P{int(r['player_id'])}",
            "score": float(r["fatigue_score"]),
            "level": str(r.get("fatigue_level", "LOW")),
            "team":  int(r["team_id"]) if pd.notna(r.get("team_id")) else -1,
        }
        for _, r in df.iterrows()
    ]


# ── GET /matches/{match_id}/results/goal-prob ──────────────────────────────────
@app.get("/matches/{match_id}/results/goal-prob")
def saved_goal_prob(match_id: str):
    d    = _match_dir(match_id)
    path = d / "1_goal_predictions.csv"
    if not path.exists():
        return []
    ref_ids = _non_player_ids(d)
    df     = pd.read_csv(path)
    df     = df[~df["player_id"].isin(ref_ids)]
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


# ── GET /matches/{match_id}/results/outcome ────────────────────────────────────
@app.get("/matches/{match_id}/results/outcome")
def saved_outcome(match_id: str):
    d      = _match_dir(match_id)
    result = _compute_outcome(d)
    if not result:
        return {}
    return result


# ── GET /matches/{match_id}/results/tracking ──────────────────────────────────
@app.get("/matches/{match_id}/results/tracking")
def saved_tracking(match_id: str):
    path = _match_dir(match_id) / "1_tracking.csv"
    if not path.exists():
        return []
    df = pd.read_csv(path)
    player_df = df[df["role"].isin(["player", "goalkeeper"]) & df["pitch_x"].notna()]
    last_frame = player_df["frame"].max() if not player_df.empty else df["frame"].max()
    vid_w = float(df["x"].max()) if df["x"].notna().any() else 1920.0
    vid_h = float(df["y"].max()) if df["y"].notna().any() else 1080.0
    records = []
    for _, row in df[df["frame"] == last_frame].iterrows():
        px, py = _norm_pct(row.get("pitch_x"), row.get("pitch_y"))
        if px is None:
            raw_x = row.get("x", vid_w / 2)
            raw_y = row.get("y", vid_h / 2)
            px = round(float(raw_x) / vid_w * 100, 2) if pd.notna(raw_x) else 50.0
            py = round(float(raw_y) / vid_h * 100, 2) if pd.notna(raw_y) else 50.0
        records.append({
            "id":   int(row["player_id"]),
            "team": int(row["team_id"]) if pd.notna(row.get("team_id")) else -1,
            "role": str(row["role"]),
            "x":    px,
            "y":    py,
        })
    return records


# ── GET /matches/{match_id}/results/tracking/frames ───────────────────────────
@app.get("/matches/{match_id}/results/tracking/frames")
def saved_tracking_frames(match_id: str):
    """Per-frame tracking data for a saved match, sampled to ≤1500 frames."""
    path = _match_dir(match_id) / "1_tracking.csv"
    if not path.exists():
        return {"fps": 25, "total_frames": 0, "frames": {}}
    df = pd.read_csv(path)
    if df.empty:
        return {"fps": 25, "total_frames": 0, "frames": {}}

    all_frames = sorted(df["frame"].unique())
    total = len(all_frames)
    step = max(1, total // 1500)
    sampled = all_frames[::step]

    out: dict = {}
    for f in sampled:
        rows = df[df["frame"] == f]
        records = []
        for _, row in rows.iterrows():
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
        out[str(f)] = records

    return {"fps": 25, "total_frames": int(all_frames[-1]) + 1 if all_frames else 0, "frames": out}


# ── GET /matches/{match_id}/results/movement ──────────────────────────────────
@app.get("/matches/{match_id}/results/movement")
def saved_movement(match_id: str):
    """Per-player aggregated movement stats from 1_Movement_Features.csv.

    Returns one record per player:
      player_id, team_id, avg_speed, max_speed, total_sprints,
      speed_series  – sampled speed over time (up to 60 points)
      accel_series  – matching acceleration values
      sprint_zones  – sprint count in 6 equal frame-range buckets
    """
    d    = _match_dir(match_id)
    path = d / "1_Movement_Features.csv"
    if not path.exists():
        return []
    ref_ids = _non_player_ids(d)
    df = pd.read_csv(path)
    df = df[~df["player_id"].isin(ref_ids)]
    if df.empty:
        return []

    max_frame = int(df["frame"].max()) if not df.empty else 1
    result = []
    for pid, grp in df.groupby("player_id"):
        grp = grp.sort_values("frame")
        team_id = int(grp["team_id"].iloc[0]) if pd.notna(grp["team_id"].iloc[0]) else -1

        # Summary stats
        avg_speed    = round(float(grp["speed"].mean()), 2)
        max_speed    = round(float(grp["speed"].max()), 2)
        total_sprints = int(grp["is_sprint"].sum()) if "is_sprint" in grp.columns else 0

        # Speed / accel series — sample to ≤60 points
        step = max(1, len(grp) // 60)
        sampled = grp.iloc[::step]
        speed_series = [
            {"frame": int(r["frame"]), "speed": round(float(r["speed"]), 2),
             "accel": round(float(r.get("acceleration", 0) or 0), 2)}
            for _, r in sampled.iterrows()
        ]

        # Sprint zones — 6 equal buckets across full match frame range
        zone_size = max(1, max_frame // 6)
        sprint_zones = []
        for z in range(6):
            lo = z * zone_size
            hi = (z + 1) * zone_size if z < 5 else max_frame + 1
            label = f"{lo}–{hi - 1}"
            count = int(grp[(grp["frame"] >= lo) & (grp["frame"] < hi)]["is_sprint"].sum()) \
                if "is_sprint" in grp.columns else 0
            sprint_zones.append({"zone": label, "sprints": count})

        result.append({
            "player_id":    int(pid),
            "team_id":      team_id,
            "avg_speed":    avg_speed,
            "max_speed":    max_speed,
            "total_sprints": total_sprints,
            "speed_series": speed_series,
            "sprint_zones": sprint_zones,
        })

    result.sort(key=lambda r: r["player_id"])
    return result


# ── GET /matches/{match_id}/names ─────────────────────────────────────────────
@app.get("/matches/{match_id}/names")
def get_names(match_id: str):
    return _read_names(_match_dir(match_id))


# ── PUT /matches/{match_id}/names ─────────────────────────────────────────────
@app.put("/matches/{match_id}/names")
def put_names(match_id: str, payload: dict = Body(...)):
    """Save player and team name mappings.

    Expected body:
      { "players": {"1": "Alice", "7": "Bob", ...},
        "teams":   {"0": "Red FC", "1": "Blue FC"} }
    """
    d = _match_dir(match_id)
    existing = _read_names(d)
    if "players" in payload:
        existing["players"].update({str(k): v for k, v in payload["players"].items()})
    if "teams" in payload:
        existing["teams"].update({str(k): v for k, v in payload["teams"].items()})
    _write_names(d, existing)
    return existing


# ── POST /matches/{match_id}/corrections ─────────────────────────────────────
@app.post("/matches/{match_id}/corrections")
def apply_corrections(match_id: str, payload: dict = Body(...)):
    """Rewrite player IDs and team assignments in the saved match CSVs, then
    re-run all downstream pipeline steps so every CSV stays consistent.

    Expected body:
      {
        "id_merges":      [{"from": 31, "to": 24}, ...],  // merge secondary ID into primary
        "team_overrides": {"24": 1, "7": 0, ...},         // force team_id per player_id
        "role_overrides": {"5": "goalkeeper", "9": "player", ...}  // force role per player_id
      }

    Steps:
      1. Apply id_merges to 1_tracking.csv (rename player_id, keep primary team).
      2. Apply team_overrides to 1_tracking.csv.
      3. Apply role_overrides to 1_tracking.csv.
      4. Re-run features(), fatigue(), goal_prob(), Match_Outcome() against the
         saved match directory so all other CSVs are recalculated consistently.
    """
    d = _match_dir(match_id)
    tracking_path = d / "1_tracking.csv"
    if not tracking_path.exists():
        raise HTTPException(status_code=404, detail="tracking CSV not found for this match")

    id_merges: list      = payload.get("id_merges", [])       # [{"from": int, "to": int}]
    team_overrides: dict = payload.get("team_overrides", {})   # {"pid_str": team_int}
    role_overrides: dict = payload.get("role_overrides", {})   # {"pid_str": "goalkeeper"|"player"}

    if not id_merges and not team_overrides and not role_overrides:
        return {"ok": True, "message": "nothing to do"}

    df = pd.read_csv(tracking_path)

    # 1. Merge IDs — replace "from" player_id with "to" everywhere in the CSV.
    #    The "to" player's team_id is kept (it's the canonical one).
    for merge in id_merges:
        src = int(merge["from"])
        dst = int(merge["to"])
        if src == dst:
            continue
        # Rows that belong to the secondary ID get rewritten to the primary ID.
        # team_id for those rows is set to whatever the primary ID uses (mode).
        primary_team = df.loc[df["player_id"] == dst, "team_id"].mode()
        primary_team = int(primary_team.iloc[0]) if not primary_team.empty else None
        mask = df["player_id"] == src
        df.loc[mask, "player_id"] = dst
        if primary_team is not None:
            df.loc[mask, "team_id"] = primary_team

    # 2. Team overrides
    for pid_str, new_team in team_overrides.items():
        pid = int(pid_str)
        df.loc[df["player_id"] == pid, "team_id"] = int(new_team)

    # 3. Role overrides
    for pid_str, new_role in role_overrides.items():
        pid = int(pid_str)
        if new_role in ("goalkeeper", "player", "referee"):
            df.loc[df["player_id"] == pid, "role"] = new_role

    df.to_csv(tracking_path, index=False)

    # 3. Re-run downstream pipeline against this match's directory
    csv_dir_str = str(d)
    try:
        from Movement_Features import features      # noqa: PLC0415
        from Fatigue           import fatigue       # noqa: PLC0415
        from goal_prob         import goal_prob     # noqa: PLC0415
        from Match_Outcome     import Match_Outcome # noqa: PLC0415
        features(csv_dir=csv_dir_str)
        fatigue(csv_dir=csv_dir_str)
        goal_prob(csv_dir=csv_dir_str)
        Match_Outcome(csv_dir=csv_dir_str)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CSV recalculation failed: {exc}")

    return {"ok": True}


# ── POST /matches/{match_id}/rerender ─────────────────────────────────────────
@app.post("/matches/{match_id}/rerender")
def rerender_match_video(match_id: str):
    """Re-annotate the saved source video using the (corrected) tracking CSV.

    Streams Server-Sent Events: { pct: 0-100 } while rendering,
    then { done: true } when the new tracked_output.mp4 is ready.
    """
    d = _match_dir(match_id)
    source  = d / "source_video.mp4"
    csv     = d / "1_tracking.csv"
    output  = d / "tracked_output.mp4"

    if not source.exists():
        raise HTTPException(status_code=404, detail="Source video not found for this match (was it saved before this feature was added?)")
    if not csv.exists():
        raise HTTPException(status_code=404, detail="Tracking CSV not found")

    progress_queue: queue.Queue = queue.Queue()

    def _run():
        try:
            from Player_Track import rerender_video  # noqa: PLC0415
            rerender_video(
                source_video=str(source),
                tracking_csv=str(csv),
                output_video=str(output),
                on_progress=lambda pct: progress_queue.put({"pct": round(pct, 1)}),
            )
        except Exception as exc:
            progress_queue.put({"error": str(exc)})
        finally:
            progress_queue.put(None)  # sentinel

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    def _stream():
        while True:
            msg = progress_queue.get()
            if msg is None:
                yield "data: " + json.dumps({"done": True}) + "\n\n"
                break
            yield "data: " + json.dumps(msg) + "\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── GET /matches/{match_id}/video ──────────────────────────────────────────────
@app.get("/matches/{match_id}/video")
def saved_video(match_id: str):
    video = _match_dir(match_id) / "tracked_output.mp4"
    if not video.exists() or video.stat().st_size == 0:
        raise HTTPException(status_code=404, detail="Video not found for this match")
    return FileResponse(
        str(video),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f"inline; filename={match_id}.mp4",
            "Accept-Ranges": "bytes",
        },
    )


# ── dev entry ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
