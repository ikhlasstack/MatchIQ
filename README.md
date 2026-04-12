# ⚽ MatchIQ — Football AI Analytics Pipeline

Real-time football match analytics using computer vision, player tracking, fatigue detection, goal probability estimation, and match outcome prediction.

---

## 🗂️ Project Structure

```
MatchIQ/
├── Pipeline/               # Core Python analytics pipeline
│   ├── main.py             # Batch mode entry point (full video → CSVs)
│   ├── Player_Track.py     # Player/ball detection & team classification
│   ├── Movement_Features.py# Speed, acceleration, sprint detection
│   ├── Fatigue.py          # Fatigue scoring per player
│   ├── goal_prob.py        # Goal probability calculation
│   ├── Match_Outcome.py    # Win/draw/loss probability
│   ├── frame_pipeline.py   # Real-time frame-by-frame orchestrator
│   └── .env                # API keys (not committed to git)
├── cv_pipeline/
│   └── stream_frames.py    # Reads video → runs pipeline → streams via WebSocket
├── node_server/
│   └── server.js           # WebSocket relay server (Node.js)
├── react_dashboard/        # React frontend dashboard
├── Match_Data_CSV/         # Output CSVs land here
├── Completed_Videos/       # Annotated output videos land here
└── requirements3.txt       # Minimal Python dependencies
```

---

## ⚙️ Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.10 or 3.11 | Pipeline |
| CUDA-capable GPU | CUDA 12.1 | Model inference |
| Node.js | 18 + | WebSocket relay server |
| npm | 8 + | React dashboard |

---

## 🔐 Environment Variables

The pipeline reads API keys from `Pipeline/.env`. Create or edit it:

```env
ROBOFLOW_API_KEY=your_roboflow_api_key_here
HF_TOKEN=your_huggingface_token_here
```

> ⚠️ **Never commit `.env` to git.** It is already listed in `.gitignore`.

---

## 📦 Python Setup

### 1. Create & activate a virtual environment

```bash
# Create
python -m venv venv

# Activate — Windows
venv\Scripts\activate

# Activate — Linux / macOS
source venv/bin/activate
```

### 2. Install Python dependencies

```bash
pip install -r requirements3.txt
```

> `requirements3.txt` already pins the `sports` git package, so no separate install step is needed.

---

## 🏃 How to Run

The pipeline has **two modes**. Choose the one that fits your use case.

---

### Mode 1 — Batch Mode (video file → CSVs)

Processes the entire video offline and saves results as CSV files. No dashboard needed.

**Step 1 — Place your video**

Put your match video at:
```
Test_Data/Testing.mp4
```
*(Create the `Test_Data/` folder in the repo root if it does not exist.)*

**Step 2 — Run the pipeline**

```bash
cd Pipeline
python main.py
```

The pipeline runs these stages in order:

| Stage | Script | Output CSV |
|---|---|---|
| 1 | `Player_Track.py` | `Match_Data_CSV/1_tracking.csv` |
| 2 | `Movement_Features.py` | `Match_Data_CSV/1_Movement_Features.csv` |
| 3 | `Fatigue.py` | `Match_Data_CSV/1_fatigue_scores.csv` |
| 4 | `goal_prob.py` | `Match_Data_CSV/1_goal_predictions.csv` |
| 5 | `Match_Outcome.py` | `Match_Data_CSV/1_match_predictions.csv` |

When done you will see:
```
Pipeline Completed
```

---

### Mode 2 — Real-Time Streaming Mode (video → WebSocket → React Dashboard)

Streams analytics frame-by-frame to a live React dashboard via WebSocket.

This mode requires **three terminals running simultaneously**.

---

#### Terminal 1 — Start the Node.js WebSocket relay server

```bash
cd node_server
npm install        # first time only
npm start
```

Expected output:
```
WebSocket relay server running on ws://localhost:8765
```

---

#### Terminal 2 — Start the React dashboard

```bash
cd react_dashboard
npm install        # first time only
npm start
```

The dashboard opens automatically at **http://localhost:3000**

---

#### Terminal 3 — Start the Python frame streamer

Make sure your virtual environment is activated, then:

```bash
cd cv_pipeline
python stream_frames.py
```

What this does:
- Opens `../Test_Data/Testing.mp4`
- Runs every frame through the full analytics pipeline
- Encodes each frame as a base64 JPEG and sends it to the WebSocket server at `ws://localhost:8765`
- The Node.js relay broadcasts it to all connected React clients
- Saves an annotated copy of the video to `Completed_Videos/`
- Saves per-session CSVs alongside the video when finished

---

## 📊 Output Files

| File | Description |
|---|---|
| `Match_Data_CSV/1_tracking.csv` | Per-frame player/ball positions, pitch coords, team & role |
| `Match_Data_CSV/1_Movement_Features.csv` | Speed, acceleration, distance, sprint flag per player per frame |
| `Match_Data_CSV/1_fatigue_scores.csv` | Fatigue score and level per player |
| `Match_Data_CSV/1_goal_predictions.csv` | Goal probability, distance & angle to goal per player per frame |
| `Match_Data_CSV/1_match_predictions.csv` | Final win/draw/loss probabilities + possession, territory, momentum |
| `Completed_Videos/*.mp4` | Annotated video (real-time mode only) |
| `Completed_Videos/*_detections.csv` | Detections per frame (real-time mode only) |
| `Completed_Videos/*_movement_features.csv` | Movement per frame (real-time mode only) |
| `Completed_Videos/*_fatigue.csv` | Fatigue per frame (real-time mode only) |
| `Completed_Videos/*_goal_probability.csv` | Goal probability per frame (real-time mode only) |
| `Completed_Videos/*_match_outcome.csv` | Match outcome per frame (real-time mode only) |

---

## 🧠 Notes

- The first run downloads Roboflow model weights into `.model_cache/` — this can take a few minutes.
- Only install **one** of `opencv-python`, `opencv-contrib-python`, or `opencv-python-headless`. This project uses `opencv-contrib-python`. Installing multiple variants will cause import conflicts.
- The `sports` package pin in `requirements3.txt` points to a specific commit for reproducibility.
- Always activate your virtual environment before running any Python script.
