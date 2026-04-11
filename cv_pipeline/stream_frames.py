import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Pipeline')))

# Disable unused optional inference backends before importing the realtime pipeline.
os.environ["CORE_MODEL_SAM_ENABLED"] = "False"
os.environ["CORE_MODEL_SAM2_ENABLED"] = "False"
os.environ["CORE_MODEL_SAM3_ENABLED"] = "False"
os.environ["CORE_MODEL_GAZE_ENABLED"] = "False"
os.environ["CORE_MODEL_YOLO_WORLD_ENABLED"] = "False"
os.environ["PALIGEMMA_ENABLED"] = "False"
os.environ["FLORENCE2_ENABLED"] = "False"
os.environ["QWEN_2_5_ENABLED"] = "False"
os.environ["QWEN_3_ENABLED"] = "False"
os.environ["CORE_MODEL_CLIP_ENABLED"] = "False"
os.environ["SMOLVLM2_ENABLED"] = "False"
os.environ["DEPTH_ESTIMATION_ENABLED"] = "False"
os.environ["MOONDREAM2_ENABLED"] = "False"
os.environ["CORE_MODEL_TROCR_ENABLED"] = "False"
os.environ["CORE_MODEL_GROUNDINGDINO_ENABLED"] = "False"
os.environ["CORE_MODEL_PE_ENABLED"] = "False"

# Suppress noisy model loading output (SigLIP load report, transformers warnings, safetensors tqdm)
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["SAFETENSORS_FAST_GPU"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
import logging
logging.getLogger("transformers").setLevel(logging.ERROR)
logging.getLogger("safetensors").setLevel(logging.ERROR)
import warnings
warnings.filterwarnings("ignore", message=".*SiglipImageProcessor.*")
warnings.filterwarnings("ignore", message=".*UNEXPECTED.*")

import cv2
import base64
import json
import time
import websocket
from tqdm import tqdm

import pandas as pd
import numpy as np
from frame_pipeline import FramePipeline

VIDEO_PATH = "../Test_Data/Testing.mp4"  # Update with your video path
WS_URL = "ws://localhost:8765"
COMPLETED_DIR = "../Completed_Videos"

class FrameSender:
    def __init__(self, video_path, ws_url):
        self.cap = cv2.VideoCapture(video_path)
        self.ws = websocket.WebSocket()
        self.ws.connect(ws_url)
        self.frame_id = 0
        self.running = True
        # Suppress model load reports (SigLIP prints directly to stdout/stderr)
        import io
        _stdout, _stderr = sys.stdout, sys.stderr
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
        try:
            self.pipeline = FramePipeline(video_path)
        finally:
            sys.stdout = _stdout
            sys.stderr = _stderr
        self.video_path = video_path

        # Set up video writer for saving completed video
        os.makedirs(COMPLETED_DIR, exist_ok=True)
        fps = self.cap.get(cv2.CAP_PROP_FPS) or 25
        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        video_name = os.path.splitext(os.path.basename(video_path))[0]
        self.output_filename = f"{video_name}_{time.strftime('%Y%m%d_%H%M%S')}.mp4"
        self.output_path = os.path.join(COMPLETED_DIR, self.output_filename)
        self.writer = cv2.VideoWriter(
            self.output_path,
            cv2.VideoWriter_fourcc(*'mp4v'),
            fps,
            (w, h),
        )

        # Accumulators for CSV export
        self.all_detections = []
        self.all_movement = []
        self.all_fatigue = []
        self.all_goal_prob = []
        self.all_match_outcome = []

    def process_frame(self, frame, frame_id):
        analytics = self.pipeline.process_frame(frame, frame_id)
        _, jpeg = cv2.imencode('.jpg', frame)
        b64 = base64.b64encode(jpeg.tobytes()).decode('utf-8')

        # Accumulate per-frame data for CSV export
        self._accumulate(frame_id, analytics)

        return {
            'type': 'frame',
            'frame_id': frame_id,
            'timestamp': time.time(),
            'image': b64,
            'frame_width': int(frame.shape[1]),
            'frame_height': int(frame.shape[0]),
            'detections': analytics['detections'],
            'events': analytics['events'],
            'fatigue': analytics['fatigue'],
            'goal_probability': analytics['goal_probability'],
            'match_outcome': analytics['match_outcome'],
            'movement_features': analytics['movement_features'],
        }

    def _accumulate(self, frame_id, analytics):
        # Detections
        for det in (analytics.get('detections') or []):
            row = {'frame': frame_id}
            row.update({k: v for k, v in det.items() if k != 'bbox'})
            if 'bbox' in det and det['bbox']:
                row['bbox_x1'], row['bbox_y1'], row['bbox_x2'], row['bbox_y2'] = det['bbox']
            self.all_detections.append(row)

        # Movement features (per-player)
        mv = analytics.get('movement_features') or {}
        if isinstance(mv, dict):
            for pid, mdata in mv.items():
                if pid in ('avg_speed', 'sprint_count', 'total_players'):
                    continue  # skip summary keys
                if isinstance(mdata, dict):
                    row = {'frame': frame_id, 'player_id': pid}
                    row.update(mdata)
                    self.all_movement.append(row)

        # Fatigue (per-player)
        fat = analytics.get('fatigue') or {}
        if isinstance(fat, dict):
            for pid, fdata in fat.items():
                if isinstance(fdata, dict):
                    row = {'frame': frame_id, 'player_id': pid}
                    row.update(fdata)
                    self.all_fatigue.append(row)

        # Goal probability (per-player from detections)
        for det in (analytics.get('detections') or []):
            gp = det.get('goal_probability')
            if isinstance(gp, dict) and gp.get('goal_probability') is not None:
                row = {'frame': frame_id, 'player_id': det.get('player_id'), 'team_id': det.get('team_id')}
                row.update(gp)
                self.all_goal_prob.append(row)

        # Match outcome (one row per frame)
        mo = analytics.get('match_outcome') or {}
        if isinstance(mo, dict) and mo:
            row = {'frame': frame_id}
            row.update(mo)
            self.all_match_outcome.append(row)
    

    def make_json_safe(self, obj):
        import numpy as np
        import math
        
        if isinstance(obj, dict):
            return {k: self.make_json_safe(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self.make_json_safe(v) for v in obj]
        elif isinstance(obj, float) and math.isnan(obj):
            return None
        elif isinstance(obj, (np.integer, np.floating)):
            return obj.item()
        elif obj is np.nan:
            return None
        else:
            return obj

    def send_frames(self):
        if not self.cap.isOpened():
            print(f"Error: Could not open video file {VIDEO_PATH}")
            return
        print(f"Video opened: {VIDEO_PATH}")
        total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        with tqdm(total=total_frames, desc="Sending frames", unit="frame") as pbar:
            while self.cap.isOpened() and self.running:
                ret, frame = self.cap.read()
                if not ret:
                    print("No more frames to read or error reading frame.")
                    break
                self.writer.write(frame)
                msg = self.process_frame(frame, self.frame_id)
                msg = self.make_json_safe(msg)
                self.ws.send(json.dumps(msg))
                pbar.update(1)
                self.frame_id += 1
                time.sleep(1/10)  # ~10 FPS
        self.cap.release()
        self.writer.release()
        print(f"Video saved to {self.output_path}")

        # Save CSV data alongside the video
        self._save_csvs()

        # Notify dashboard that the video is complete
        complete_msg = self.make_json_safe({
            'type': 'video_complete',
            'filename': self.output_filename,
            'total_frames': self.frame_id,
            'timestamp': time.time(),
        })
        try:
            self.ws.send(json.dumps(complete_msg))
        except Exception:
            pass
        self.ws.close()
        print("Finished sending frames.")

    def _save_csvs(self):
        base = os.path.splitext(self.output_path)[0]
        saved = []
        for name, data in [
            ('detections', self.all_detections),
            ('movement_features', self.all_movement),
            ('fatigue', self.all_fatigue),
            ('goal_probability', self.all_goal_prob),
            ('match_outcome', self.all_match_outcome),
        ]:
            if data:
                path = f"{base}_{name}.csv"
                df = pd.DataFrame(data)
                df = df.where(pd.notnull(df), None)
                df.to_csv(path, index=False)
                saved.append(path)
                print(f"  Saved {name}: {path} ({len(df)} rows)")
        if not saved:
            print("  No analytics data to save.")

if __name__ == '__main__':
    sender = FrameSender(VIDEO_PATH, WS_URL)
    sender.send_frames()
