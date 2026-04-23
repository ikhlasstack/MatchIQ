#REQUIRED PACKAGES
#nvidia-smi
#pip install -q inference-gpu
#pip install -q git+https://github.com/roboflow/sports.git
#pip list | grep supervision

import os

# Persist model weights so they aren't re-downloaded on every run.
os.environ["MODEL_CACHE_DIR"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".model_cache")

# Disable unused optional inference backends so import-time dependency warnings stay quiet.
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

from dotenv import load_dotenv
from inference import get_model
import supervision as sv
from pathlib import Path
from boxmot.trackers.hybridsort.hybridsort import HybridSort
import numpy as np
from sports.annotators.soccer import draw_pitch, draw_points_on_pitch
from sports.configs.soccer import SoccerPitchConfiguration
from sports.common.view import ViewTransformer

from tqdm import tqdm
from sports.common.team import TeamClassifier
import torch

import cv2
import pandas as pd


# === YOUR VIDEO === SET ACCORDINGLY TO YOUR LOCAL SETUP
SOURCE_VIDEO_PATH   = "Test_Data/Testing.mp4"
OUTPUT_VIDEO_PATH   = "Test_Data/tracked_output.mp4"       # final H.264 faststart (browser-ready)
_RAW_VIDEO_PATH     = "Test_Data/tracked_output_raw.mp4"   # intermediate mp4v (deleted after remux)
OUTPUT_CSV_PATH     = "Match_Data_CSV/1_tracking.csv"

# === YOUR MODEL'S CLASS IDs (confirmed from Cell 7 output) ===
BALL_ID       = 1
GOALKEEPER_ID = 2
PLAYER_ID     = 3
REFEREE_ID    = 4
CONFIDENCE    = 0.3

load_dotenv()  # loads variables from .env into os.environ

HF_TOKEN = os.getenv("HF_TOKEN")
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
CONFIG = SoccerPitchConfiguration()

_REID_WEIGHTS = Path(__file__).parent.parent / ".model_cache" / "osnet_x0_25_msmt17.pt"




def _sv_to_boxmot(detections: sv.Detections) -> np.ndarray:
    if len(detections) == 0:
        return np.empty((0, 6), dtype=np.float32)
    return np.column_stack([
        detections.xyxy,
        detections.confidence,
        detections.class_id.astype(np.float32),
    ]).astype(np.float32)


def _boxmot_to_sv(tracks: np.ndarray) -> sv.Detections:
    if tracks.shape[0] == 0:
        empty = sv.Detections.empty()
        empty.tracker_id = np.array([], dtype=int)
        return empty
    result = sv.Detections(
        xyxy=tracks[:, 0:4],
        confidence=tracks[:, 5],
        class_id=tracks[:, 6].astype(int),
    )
    result.tracker_id = tracks[:, 4].astype(int)
    return result


class RealTimePlayerTracker:
    def __init__(self, source_video_path=SOURCE_VIDEO_PATH, confidence=CONFIDENCE, stride=30, min_crops=100):
        self.source_video_path = source_video_path
        self.confidence = confidence
        self.stride = stride
        self.min_crops = min_crops
        self.player_model = get_model(
            model_id="football-vgiqa-3njno/2",
            api_key=ROBOFLOW_API_KEY,
        )
        self.field_model = get_model(
            model_id="football-field-detection-f07vi/14",
            api_key=ROBOFLOW_API_KEY,
        )
        self.config = SoccerPitchConfiguration()
        self.tracker = HybridSort(
            reid_weights=_REID_WEIGHTS,
            device=torch.device(self.device),
            half=False,
            track_thresh=0.3,
            low_thresh=0.1,
            max_age=100,
            min_hits=3,
            iou_threshold=0.3,
            delta_t=3,
            use_byte=True,
            with_reid=True,
            with_longterm_reid=True,
        )
        self.team_classifier = None
        self.team_crops = []
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self._cached_transformer = None
        self._bootstrap_team_classifier()

    def _bootstrap_team_classifier(self):
        try:
            for frame in sv.get_video_frames_generator(self.source_video_path, stride=self.stride):
                result = self.player_model.infer(frame, confidence=self.confidence)[0]
                detections = sv.Detections.from_inference(result)
                players = detections[detections.class_id == PLAYER_ID]
                self.team_crops.extend([sv.crop_image(frame, xyxy) for xyxy in players.xyxy])
                if len(self.team_crops) >= self.min_crops:
                    break
        except Exception:
            self.team_crops = []

        if self.team_crops:
            self.team_classifier = TeamClassifier(device=self.device)
            self.team_classifier.fit(self.team_crops)

    def _resolve_transformer(self, frame, frame_id, interval=10):
        if frame_id % interval != 0 and self._cached_transformer is not None:
            return self._cached_transformer
        try:
            field_result = self.field_model.infer(frame, confidence=0.3)[0]
            key_points = sv.KeyPoints.from_inference(field_result)
            kp_filter = key_points.confidence[0] > 0.5
            frame_ref = key_points.xy[0][kp_filter]
            pitch_ref = np.array(self.config.vertices)[kp_filter]
            if len(frame_ref) >= 4:
                self._cached_transformer = ViewTransformer(source=frame_ref, target=pitch_ref)
        except Exception:
            pass
        return self._cached_transformer

    def process_frame(self, frame, frame_id):
        result = self.player_model.infer(frame, confidence=self.confidence)[0]
        detections = sv.Detections.from_inference(result)

        ball_detections = detections[detections.class_id == BALL_ID]
        if len(ball_detections) > 0:
            ball_detections.xyxy = sv.pad_boxes(xyxy=ball_detections.xyxy, px=10)

        non_ball = detections[detections.class_id != BALL_ID]
        non_ball = non_ball.with_nms(threshold=0.5, class_agnostic=False)
        non_ball = _boxmot_to_sv(self.tracker.update(_sv_to_boxmot(non_ball), frame))

        goalkeepers = non_ball[non_ball.class_id == GOALKEEPER_ID]
        players = non_ball[non_ball.class_id == PLAYER_ID]
        referees = non_ball[non_ball.class_id == REFEREE_ID]

        if len(players) > 0:
            player_crops = [sv.crop_image(frame, xyxy) for xyxy in players.xyxy]
            if self.team_classifier is None:
                self.team_crops.extend(player_crops)
                if len(self.team_crops) >= self.min_crops:
                    self.team_classifier = TeamClassifier(device=self.device)
                    self.team_classifier.fit(self.team_crops)
            if self.team_classifier is not None:
                players.class_id = self.team_classifier.predict(player_crops)
            else:
                players.class_id = np.full(len(players), -1, dtype=int)

        if len(goalkeepers) > 0 and len(players) > 0 and np.any(players.class_id >= 0):
            goalkeepers.class_id = resolve_goalkeepers_team_id(players, goalkeepers)
        elif len(goalkeepers) > 0:
            goalkeepers.class_id = np.full(len(goalkeepers), -1, dtype=int)

        if len(referees) > 0:
            referees.class_id = np.full(len(referees), -1, dtype=int)

        tracked = sv.Detections.merge([players, goalkeepers, referees])
        transformer = self._resolve_transformer(frame, frame_id)
        has_transform = transformer is not None

        frame_detections = []
        if tracked.tracker_id is not None and len(tracked) > 0:
            positions = tracked.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            pitch_positions = transformer.transform_points(positions) if has_transform else [[None, None]] * len(positions)
            goalkeeper_ids = set(goalkeepers.tracker_id.tolist()) if goalkeepers.tracker_id is not None else set()
            referee_ids = set(referees.tracker_id.tolist()) if referees.tracker_id is not None else set()

            for index, tracker_id in enumerate(tracked.tracker_id):
                if tracker_id is None:
                    continue
                role = 'player'
                if int(tracker_id) in goalkeeper_ids:
                    role = 'goalkeeper'
                elif int(tracker_id) in referee_ids:
                    role = 'referee'

                bbox = tracked.xyxy[index].tolist()
                frame_detections.append({
                    'frame': frame_id,
                    'player_id': int(tracker_id),
                    'bbox': [float(coord) for coord in bbox],
                    'x': float(positions[index][0]),
                    'y': float(positions[index][1]),
                    'pitch_x': float(pitch_positions[index][0]) if has_transform else None,
                    'pitch_y': float(pitch_positions[index][1]) if has_transform else None,
                    'role': role,
                    'team_id': int(tracked.class_id[index]) if tracked.class_id is not None else -1,
                    'confidence': float(tracked.confidence[index]),
                })

        if len(ball_detections) > 0:
            for index, xyxy in enumerate(ball_detections.xyxy):
                bx = float((xyxy[0] + xyxy[2]) / 2)
                by = float((xyxy[1] + xyxy[3]) / 2)
                pitch_x = None
                pitch_y = None
                if has_transform:
                    transformed = transformer.transform_points(np.array([[bx, by]]))
                    pitch_x = float(transformed[0][0])
                    pitch_y = float(transformed[0][1])
                frame_detections.append({
                    'frame': frame_id,
                    'player_id': -1,
                    'bbox': [float(coord) for coord in xyxy.tolist()],
                    'x': bx,
                    'y': by,
                    'pitch_x': pitch_x,
                    'pitch_y': pitch_y,
                    'role': 'ball',
                    'team_id': -1,
                    'confidence': float(ball_detections.confidence[index]),
                })

        return frame_detections


def resolve_goalkeepers_team_id(players, goalkeepers):
    goalkeepers_xy  = goalkeepers.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
    players_xy      = players.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
    team_0_centroid = players_xy[players.class_id == 0].mean(axis=0)
    team_1_centroid = players_xy[players.class_id == 1].mean(axis=0)

    goalkeepers_team_id = []
    for gk_xy in goalkeepers_xy:
        dist_0 = np.linalg.norm(gk_xy - team_0_centroid)
        dist_1 = np.linalg.norm(gk_xy - team_1_centroid)
        goalkeepers_team_id.append(0 if dist_0 < dist_1 else 1)

    return np.array(goalkeepers_team_id)


def process_all_frames(PLAYER_DETECTION_MODEL, FIELD_DETECTION_MODEL, CONFIG, team_classifier, on_frame=None, cancel_event=None):
    ellipse_annotator = sv.EllipseAnnotator(
        color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
        thickness=2
    )
    label_annotator = sv.LabelAnnotator(
        color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
        text_color=sv.Color.from_hex('#000000'),
        text_position=sv.Position.BOTTOM_CENTER
    )
    triangle_annotator = sv.TriangleAnnotator(
        color=sv.Color.from_hex('#FFD700'),
        base=25, height=21, outline_thickness=1
    )

    tracker = HybridSort(
        reid_weights=_REID_WEIGHTS,
        device=torch.device(DEVICE),
        half=False,
        track_thresh=0.3,
        low_thresh=0.1,
        max_age=5000,           # Keep long-term memory for 90‑minute matches
        min_hits=3,
        iou_threshold=0.3,
        delta_t=3,
        use_byte=True,
        with_reid=True,
        with_longterm_reid=True,
    )

    video_info = sv.VideoInfo.from_video_path(SOURCE_VIDEO_PATH)
    out = cv2.VideoWriter(
        _RAW_VIDEO_PATH,
        cv2.VideoWriter_fourcc(*"mp4v"),
        video_info.fps,
        (video_info.width, video_info.height)
    )
    if not out.isOpened():
        raise RuntimeError(
            f"cv2.VideoWriter failed to open '{_RAW_VIDEO_PATH}' — "
            "check that the output directory exists and the mp4v codec is available."
        )

    tracking_records = []
    frame_number = 0

    # Field detection cache — re-run every N frames instead of every frame
    FIELD_REFRESH_INTERVAL = 10
    cached_transformer: ViewTransformer | None = None

    # Team classifier cache — keyed by tracker_id, refreshed every M frames
    TEAM_CLASSIFY_INTERVAL = 5
    team_id_cache: dict[int, int] = {}

    # ========== Track history for preventing ID misuse ==========
    track_last_pitch = {}      # track_id -> np.array([pitch_x, pitch_y])
    track_team_history = {}    # track_id -> last assigned team (0 or 1)
    MAX_PITCH_JUMP = 15.0      # metres – maximum plausible movement between frames
    # =================================================================

    INFER_SIZE = 640
    orig_h, orig_w = None, None

    for frame in tqdm(
        sv.get_video_frames_generator(SOURCE_VIDEO_PATH),
        total=video_info.total_frames,
        desc='Processing'
    ):
        if orig_h is None:
            orig_h, orig_w = frame.shape[:2]
            scale_x, scale_y = orig_w / INFER_SIZE, orig_h / INFER_SIZE
        small_frame = cv2.resize(frame, (INFER_SIZE, INFER_SIZE), interpolation=cv2.INTER_LINEAR)

        # 1. Detect
        result = PLAYER_DETECTION_MODEL.infer(small_frame, confidence=CONFIDENCE)[0]
        detections = sv.Detections.from_inference(result)
        if len(detections) > 0:
            detections.xyxy[:, [0, 2]] *= scale_x
            detections.xyxy[:, [1, 3]] *= scale_y

        # 2. Separate ball
        ball_detections = detections[detections.class_id == BALL_ID]
        ball_detections.xyxy = sv.pad_boxes(xyxy=ball_detections.xyxy, px=10)

        # 3. Track players
        player_detections = detections[detections.class_id != BALL_ID]
        player_detections = player_detections.with_nms(threshold=0.5, class_agnostic=False)
        player_detections = _boxmot_to_sv(tracker.update(_sv_to_boxmot(player_detections), frame))

        # 4. Split by role BEFORE class_ids get changed
        goalkeepers = player_detections[player_detections.class_id == GOALKEEPER_ID]
        players     = player_detections[player_detections.class_id == PLAYER_ID]
        referees    = player_detections[player_detections.class_id == REFEREE_ID]

        gk_ids  = set(goalkeepers.tracker_id.tolist()) if goalkeepers.tracker_id is not None else set()
        ref_ids = set(referees.tracker_id.tolist()) if referees.tracker_id is not None else set()

        # 5. Get pitch transformer (cached)
        if frame_number % FIELD_REFRESH_INTERVAL == 0:
            try:
                result_field = FIELD_DETECTION_MODEL.infer(small_frame, confidence=0.3)[0]
                key_points   = sv.KeyPoints.from_inference(result_field)
                key_points.xy[0][:, 0] *= scale_x
                key_points.xy[0][:, 1] *= scale_y
                kp_filter    = key_points.confidence[0] > 0.5
                frame_ref    = key_points.xy[0][kp_filter]
                pitch_ref    = np.array(CONFIG.vertices)[kp_filter]
                if len(frame_ref) >= 4:
                    cached_transformer = ViewTransformer(source=frame_ref, target=pitch_ref)
            except:
                pass
        transformer = cached_transformer
        has_transform = transformer is not None

        # ---------- Prevent teleporting IDs (goalkeeper ID sharing fix) ----------
        if has_transform and player_detections.tracker_id is not None:
            positions = player_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            pitch_positions = transformer.transform_points(positions)

            new_ids = player_detections.tracker_id.copy()
            for i, tid in enumerate(new_ids):
                current_pos = pitch_positions[i]
                if tid in track_last_pitch:
                    dist = np.linalg.norm(current_pos - track_last_pitch[tid])
                    if dist > MAX_PITCH_JUMP:
                        # Teleport detected – assign a fresh ID
                        new_id = max(player_detections.tracker_id.max() + 1, tid + 10000)
                        new_ids[i] = new_id
                track_last_pitch[new_ids[i]] = current_pos
            player_detections.tracker_id = new_ids
        # -------------------------------------------------------------------------

        # 6. Classify teams (throttled)
        if len(players) > 0:
            if frame_number % TEAM_CLASSIFY_INTERVAL == 0:
                player_crops = [sv.crop_image(frame, xyxy) for xyxy in players.xyxy]
                new_ids = team_classifier.predict(player_crops)
                for tid, cls in zip(players.tracker_id, new_ids):
                    team_id_cache[int(tid)] = int(cls)
            players.class_id = np.array(
                [team_id_cache.get(int(tid), 0) for tid in players.tracker_id]
            )

        if len(goalkeepers) > 0 and len(players) > 0:
            goalkeepers.class_id = resolve_goalkeepers_team_id(players, goalkeepers)

        if len(referees) > 0:
            referees.class_id = np.full(len(referees), -1, dtype=int)

        player_detections = sv.Detections.merge([players, goalkeepers, referees])

        # ---------- Prevent team flips (additional safeguard) ----------
        if player_detections.tracker_id is not None:
            new_ids = player_detections.tracker_id.copy()
            for i, tid in enumerate(new_ids):
                team = player_detections.class_id[i]
                if tid in track_team_history:
                    if track_team_history[tid] != team and team != -1:
                        # Team flip – split ID
                        new_id = max(player_detections.tracker_id.max() + 1, tid + 20000)
                        new_ids[i] = new_id
                if team != -1:
                    track_team_history[new_ids[i]] = team
            player_detections.tracker_id = new_ids
        # -----------------------------------------------------------------

        # 7. Save ball to CSV
        if len(ball_detections) > 0:
            for xyxy in ball_detections.xyxy:
                bx = float((xyxy[0] + xyxy[2]) / 2)
                by = float((xyxy[1] + xyxy[3]) / 2)
                px, py = (None, None)
                if has_transform:
                    pt = transformer.transform_points(np.array([[bx, by]]))
                    px, py = float(pt[0][0]), float(pt[0][1])
                tracking_records.append({
                    'frame': frame_number,
                    'player_id': -1,
                    'x': bx, 'y': by,
                    'pitch_x': px, 'pitch_y': py,
                    'role': 'ball',
                    'team_id': -1,
                    'confidence': float(ball_detections.confidence[0])
                })

        # 8. Save players to CSV
        if player_detections.tracker_id is not None:
            positions      = player_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            pitch_positions = transformer.transform_points(positions) if has_transform else [[None, None]] * len(positions)

            for i, tracker_id in enumerate(player_detections.tracker_id):
                tid = int(tracker_id)
                if tid in gk_ids:
                    role = 'goalkeeper'
                elif tid in ref_ids:
                    role = 'referee'
                else:
                    role = 'player'

                tracking_records.append({
                    'frame':      frame_number,
                    'player_id':  tid,
                    'x':          float(positions[i][0]),
                    'y':          float(positions[i][1]),
                    'pitch_x':    float(pitch_positions[i][0]) if has_transform else None,
                    'pitch_y':    float(pitch_positions[i][1]) if has_transform else None,
                    'role':       role,
                    'team_id':    int(player_detections.class_id[i]),
                    'confidence': float(player_detections.confidence[i])
                })

        # Fire live positions callback for minimap streaming
        if on_frame is not None:
            live_rows = []
            if player_detections.tracker_id is not None:
                pp = player_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
                pp_pitch = transformer.transform_points(pp) if has_transform else None
                for i, tid in enumerate(player_detections.tracker_id):
                    role = 'goalkeeper' if int(tid) in gk_ids else ('referee' if int(tid) in ref_ids else 'player')
                    if pp_pitch is not None:
                        try:
                            nx = round(float(pp_pitch[i][0]) / 105 * 100, 2)
                            ny = round(float(pp_pitch[i][1]) / 68  * 100, 2)
                        except (TypeError, ValueError):
                            nx = round(float(pp[i][0]) / orig_w * 100, 2)
                            ny = round(float(pp[i][1]) / orig_h * 100, 2)
                    else:
                        nx = round(float(pp[i][0]) / orig_w * 100, 2)
                        ny = round(float(pp[i][1]) / orig_h * 100, 2)
                    live_rows.append({
                        'id':   int(tid),
                        'team': int(player_detections.class_id[i]) if player_detections.class_id is not None else -1,
                        'role': role,
                        'x':    max(0.0, min(100.0, nx)),
                        'y':    max(0.0, min(100.0, ny)),
                    })

            if len(ball_detections) > 0:
                for xyxy in ball_detections.xyxy:
                    bx = float((xyxy[0] + xyxy[2]) / 2)
                    by = float((xyxy[1] + xyxy[3]) / 2)
                    if has_transform:
                        try:
                            bpt = transformer.transform_points(np.array([[bx, by]]))
                            bnx = round(float(bpt[0][0]) / 105 * 100, 2)
                            bny = round(float(bpt[0][1]) / 68  * 100, 2)
                        except Exception:
                            bnx = round(bx / orig_w * 100, 2)
                            bny = round(by / orig_h * 100, 2)
                    else:
                        bnx = round(bx / orig_w * 100, 2)
                        bny = round(by / orig_h * 100, 2)
                    live_rows.append({
                        'id':   -1,
                        'team': -1,
                        'role': 'ball',
                        'x':    max(0.0, min(100.0, bnx)),
                        'y':    max(0.0, min(100.0, bny)),
                    })
                    break

            on_frame(live_rows)

        # 9. Annotate and write frame
        if player_detections.class_id is not None:
            player_detections.class_id = np.where( player_detections.class_id == -1, 2, player_detections.class_id ).astype(int)

        labels = [f"#{tid}" for tid in player_detections.tracker_id] if player_detections.tracker_id is not None else []

        annotated_frame = ellipse_annotator.annotate(frame, player_detections)
        annotated_frame = label_annotator.annotate(annotated_frame, player_detections, labels)
        annotated_frame = triangle_annotator.annotate(annotated_frame, ball_detections)
        out.write(annotated_frame)

        frame_number += 1

        if cancel_event is not None and cancel_event.is_set():
            break

    out.release()
    out = None

    # 10. Transcode raw mp4v → H.264 faststart
    import av as _av, os as _os
    from fractions import Fraction as _Fraction
    try:
        _inp = _av.open(_RAW_VIDEO_PATH)
        _in_stream = _inp.streams.video[0]
        _int_fps = round(float(_in_stream.average_rate))
        _frame_tb = _Fraction(1, _int_fps)
        _out = _av.open(OUTPUT_VIDEO_PATH, mode='w', options={'movflags': 'faststart'})
        _out_stream = _out.add_stream('h264', rate=_int_fps)
        _out_stream.width   = _in_stream.width
        _out_stream.height  = _in_stream.height
        _out_stream.pix_fmt = 'yuv420p'
        _out_stream.options = {'crf': '23', 'preset': 'fast'}
        _pts = 0
        for _frame in _inp.decode(_in_stream):
            _frame.pts = _pts
            _frame.time_base = _frame_tb
            _pts += 1
            for _pkt in _out_stream.encode(_frame):
                _out.mux(_pkt)
        for _pkt in _out_stream.encode():
            _out.mux(_pkt)
        _inp.close()
        _out.close()
        _os.remove(_RAW_VIDEO_PATH)
        print(f"[INFO] H.264 transcode complete → {OUTPUT_VIDEO_PATH}")
    except Exception as _e:
        print(f"[WARN] H.264 transcode failed ({_e}), keeping raw mp4v as output")
        if _os.path.exists(_RAW_VIDEO_PATH):
            _os.replace(_RAW_VIDEO_PATH, OUTPUT_VIDEO_PATH)

    # 11. Save CSV
    df = pd.DataFrame(tracking_records)

    # Smooth team_id per player over a rolling window
    SWAP_WINDOW = 50
    players_mask = df['role'].isin(['player', 'goalkeeper']) & (df['team_id'] >= 0)
    if players_mask.any():
        def _smooth_team(group):
            if len(group) < 2:
                return group
            ids = group['team_id'].values.copy()
            smoothed = ids.copy()
            half = SWAP_WINDOW // 2
            for idx in range(len(ids)):
                lo = max(0, idx - half)
                hi = min(len(ids), idx + half + 1)
                window = ids[lo:hi]
                counts = np.bincount(window[window >= 0].astype(int), minlength=2)
                if counts.sum() > 0:
                    smoothed[idx] = int(np.argmax(counts))
            group = group.copy()
            group['team_id'] = smoothed
            return group

        smoothed_parts = df[players_mask].groupby('player_id', group_keys=False).apply(_smooth_team)
        df.loc[players_mask, 'team_id'] = smoothed_parts['team_id'].values

    df.to_csv(OUTPUT_CSV_PATH, index=False)

    print(f'\n=== DONE ===')
    print(f'Frames processed: {frame_number}')
    print(f'Total records: {len(df)}')
    print(f'Roles: {df["role"].value_counts().to_dict()}')
    print(f'Teams (players only): {df[df["role"].isin(["player","goalkeeper"])]["team_id"].value_counts().to_dict()}')
    print(f'\nSample rows:')
    print(df[df['role'] == 'player'][['frame','player_id','x','y','pitch_x','pitch_y','team_id']].head(8))


def player_tracking(player_model=None, field_model=None, on_frame=None, cancel_event=None):
    if player_model is None:
        player_model = get_model(model_id="football-vgiqa-3njno/2", api_key=ROBOFLOW_API_KEY)
    if field_model is None:
        field_model = get_model(model_id="football-field-detection-f07vi/14", api_key=ROBOFLOW_API_KEY)

    print(f"Using: {DEVICE}")
    STRIDE = 30

    crops = []
    _bs_size = 640
    _bs_first = True
    _bs_sx = _bs_sy = 1.0
    for frame in tqdm(
        sv.get_video_frames_generator(SOURCE_VIDEO_PATH, stride=STRIDE),
        desc='Collecting crops'
    ):
        if _bs_first:
            _bh, _bw = frame.shape[:2]
            _bs_sx, _bs_sy = _bw / _bs_size, _bh / _bs_size
            _bs_first = False
        small = cv2.resize(frame, (_bs_size, _bs_size), interpolation=cv2.INTER_LINEAR)
        result = player_model.infer(small, confidence=CONFIDENCE)[0]
        detections = sv.Detections.from_inference(result)
        if len(detections) > 0:
            detections.xyxy[:, [0, 2]] *= _bs_sx
            detections.xyxy[:, [1, 3]] *= _bs_sy
        player_only = detections[detections.class_id == PLAYER_ID]
        player_crops = [sv.crop_image(frame, xyxy) for xyxy in player_only.xyxy]
        crops += player_crops
        if len(crops) >= 200:
            break

    team_classifier = TeamClassifier(device=DEVICE)
    team_classifier.fit(crops)

    process_all_frames(player_model, field_model, CONFIG, team_classifier, on_frame=on_frame, cancel_event=cancel_event)

    return