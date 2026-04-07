
import cv2
import base64
import json
import time
import websocket
from tqdm import tqdm

VIDEO_PATH = '../Test_Data/Testing.mp4'  # Update with your video path
WS_URL = 'ws://localhost:8765'

class FrameSender:
    def __init__(self, video_path, ws_url):
        self.cap = cv2.VideoCapture(video_path)
        self.ws = websocket.WebSocket()
        self.ws.connect(ws_url)
        self.frame_id = 0
        self.running = True

    def process_frame(self, frame):
        # Dummy detection and pipeline data for demo
        detections = []
        events = []
        # Example pipeline outputs (replace with real model outputs)
        fatigue = 0.5  # float
        goal_prob = 0.2  # float
        match_outcome = "draw"  # str
        movement_features = "running"  # str or dict
        # Encode frame as JPEG
        _, jpeg = cv2.imencode('.jpg', frame)
        b64 = base64.b64encode(jpeg.tobytes()).decode('utf-8')
        return b64, detections, events, fatigue, goal_prob, match_outcome, movement_features

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
                b64, detections, events, fatigue, goal_prob, match_outcome, movement_features = self.process_frame(frame)
                msg = {
                    'type': 'frame',
                    'frame_id': self.frame_id,
                    'timestamp': time.time(),
                    'image': b64,
                    'detections': detections,
                    'events': events,
                    'fatigue': fatigue,
                    'goal_prob': goal_prob,
                    'match_outcome': match_outcome,
                    'movement_features': movement_features
                }
                self.ws.send(json.dumps(msg))
                pbar.update(1)
                self.frame_id += 1
                time.sleep(1/10)  # ~10 FPS
        self.cap.release()
        self.ws.close()
        print("Finished sending frames.")

if __name__ == '__main__':
    sender = FrameSender(VIDEO_PATH, WS_URL)
    sender.send_frames()
