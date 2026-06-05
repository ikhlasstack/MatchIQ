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


# class RealTimePlayerTracker:
#     def __init__(self, source_video_path=SOURCE_VIDEO_PATH, confidence=CONFIDENCE, stride=30, min_crops=100):
#         self.source_video_path = source_video_path
#         self.confidence = confidence
#         self.stride = stride
#         self.min_crops = min_crops
#         self.player_model = get_model(
#             model_id="football-vgiqa-3njno/2",
#             api_key=ROBOFLOW_API_KEY,
#         )
#         self.field_model = get_model(
#             model_id="football-field-detection-f07vi/14",
#             api_key=ROBOFLOW_API_KEY,
#         )
#         self.config = SoccerPitchConfiguration()
#         self.tracker = HybridSort(
#             reid_weights=_REID_WEIGHTS,
#             device=torch.device(self.device),
#             half=False,
#             track_thresh=0.3,
#             low_thresh=0.1,
#             max_age=100,
#             min_hits=3,
#             iou_threshold=0.3,
#             delta_t=3,
#             use_byte=True,
#             with_reid=True,
#             with_longterm_reid=True,
#         )
#         self.team_classifier = None
#         self.team_crops = []
#         self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
#         self._cached_transformer = None
#         self._bootstrap_team_classifier()

#     def _bootstrap_team_classifier(self):
#         try:
#             for frame in sv.get_video_frames_generator(self.source_video_path, stride=self.stride):
#                 result = self.player_model.infer(frame, confidence=self.confidence)[0]
#                 detections = sv.Detections.from_inference(result)
#                 players = detections[detections.class_id == PLAYER_ID]
#                 self.team_crops.extend([sv.crop_image(frame, xyxy) for xyxy in players.xyxy])
#                 if len(self.team_crops) >= self.min_crops:
#                     break
#         except Exception:
#             self.team_crops = []

#         if self.team_crops:
#             self.team_classifier = TeamClassifier(device=self.device)
#             self.team_classifier.fit(self.team_crops)

#     def _resolve_transformer(self, frame, frame_id, interval=10):
#         if frame_id % interval != 0 and self._cached_transformer is not None:
#             return self._cached_transformer
#         try:
#             field_result = self.field_model.infer(frame, confidence=0.3)[0]
#             key_points = sv.KeyPoints.from_inference(field_result)
#             kp_filter = key_points.confidence[0] > 0.5
#             frame_ref = key_points.xy[0][kp_filter]
#             pitch_ref = np.array(self.config.vertices)[kp_filter]
#             if len(frame_ref) >= 4:
#                 self._cached_transformer = ViewTransformer(source=frame_ref, target=pitch_ref)
#         except Exception:
#             pass
#         return self._cached_transformer

#     def process_frame(self, frame, frame_id):
#         result = self.player_model.infer(frame, confidence=self.confidence)[0]
#         detections = sv.Detections.from_inference(result)

#         ball_detections = detections[detections.class_id == BALL_ID]
#         if len(ball_detections) > 0:
#             ball_detections.xyxy = sv.pad_boxes(xyxy=ball_detections.xyxy, px=10)

#         non_ball = detections[detections.class_id != BALL_ID]
#         non_ball = non_ball.with_nms(threshold=0.5, class_agnostic=False)
#         non_ball = _boxmot_to_sv(self.tracker.update(_sv_to_boxmot(non_ball), frame))

#         goalkeepers = non_ball[non_ball.class_id == GOALKEEPER_ID]
#         players = non_ball[non_ball.class_id == PLAYER_ID]
#         referees = non_ball[non_ball.class_id == REFEREE_ID]

#         if len(players) > 0:
#             player_crops = [sv.crop_image(frame, xyxy) for xyxy in players.xyxy]
#             if self.team_classifier is None:
#                 self.team_crops.extend(player_crops)
#                 if len(self.team_crops) >= self.min_crops:
#                     self.team_classifier = TeamClassifier(device=self.device)
#                     self.team_classifier.fit(self.team_crops)
#             if self.team_classifier is not None:
#                 players.class_id = self.team_classifier.predict(player_crops)
#             else:
#                 players.class_id = np.full(len(players), -1, dtype=int)

#         if len(goalkeepers) > 0 and len(players) > 0 and np.any(players.class_id >= 0):
#             goalkeepers.class_id = resolve_goalkeepers_team_id(players, goalkeepers)
#         elif len(goalkeepers) > 0:
#             goalkeepers.class_id = np.full(len(goalkeepers), -1, dtype=int)

#         if len(referees) > 0:
#             referees.class_id = np.full(len(referees), -1, dtype=int)

#         tracked = sv.Detections.merge([players, goalkeepers, referees])
#         transformer = self._resolve_transformer(frame, frame_id)
#         has_transform = transformer is not None

#         frame_detections = []
#         if tracked.tracker_id is not None and len(tracked) > 0:
#             positions = tracked.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
#             pitch_positions = transformer.transform_points(positions) if has_transform else [[None, None]] * len(positions)
#             goalkeeper_ids = set(goalkeepers.tracker_id.tolist()) if goalkeepers.tracker_id is not None else set()
#             referee_ids = set(referees.tracker_id.tolist()) if referees.tracker_id is not None else set()

#             for index, tracker_id in enumerate(tracked.tracker_id):
#                 if tracker_id is None:
#                     continue
#                 role = 'player'
#                 if int(tracker_id) in goalkeeper_ids:
#                     role = 'goalkeeper'
#                 elif int(tracker_id) in referee_ids:
#                     role = 'referee'

#                 bbox = tracked.xyxy[index].tolist()
#                 frame_detections.append({
#                     'frame': frame_id,
#                     'player_id': int(tracker_id),
#                     'bbox': [float(coord) for coord in bbox],
#                     'x': float(positions[index][0]),
#                     'y': float(positions[index][1]),
#                     'pitch_x': float(pitch_positions[index][0]) if has_transform else None,
#                     'pitch_y': float(pitch_positions[index][1]) if has_transform else None,
#                     'role': role,
#                     'team_id': int(tracked.class_id[index]) if tracked.class_id is not None else -1,
#                     'confidence': float(tracked.confidence[index]),
#                 })

#         if len(ball_detections) > 0:
#             for index, xyxy in enumerate(ball_detections.xyxy):
#                 bx = float((xyxy[0] + xyxy[2]) / 2)
#                 by = float((xyxy[1] + xyxy[3]) / 2)
#                 pitch_x = None
#                 pitch_y = None
#                 if has_transform:
#                     transformed = transformer.transform_points(np.array([[bx, by]]))
#                     pitch_x = float(transformed[0][0])
#                     pitch_y = float(transformed[0][1])
#                 frame_detections.append({
#                     'frame': frame_id,
#                     'player_id': -1,
#                     'bbox': [float(coord) for coord in xyxy.tolist()],
#                     'x': bx,
#                     'y': by,
#                     'pitch_x': pitch_x,
#                     'pitch_y': pitch_y,
#                     'role': 'ball',
#                     'team_id': -1,
#                     'confidence': float(ball_detections.confidence[index]),
#                 })

#         return frame_detections


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


GK_PITCH_MIDLINE = 52.5  # metres — halfway line on a 105m pitch
GK_SIDE_LO       = 25.0  # pitch-X below this → left GK (pink/red)
GK_SIDE_HI       = 80.0  # pitch-X above this → right GK (blue)


def _assign_gk_team_color(goalkeepers, gk_side_locked, positions, orig_w):
    """Assign team color (class_id) to goalkeepers based purely on pitch-X position.

    Left GK  (pitch-X < midline) → class_id=1 (pink/red)
    Right GK (pitch-X > midline) → class_id=0 (blue)

    Boxmot tracker IDs are left untouched — only class_id is written.
    gk_side_locked: {'left': bool, 'right': bool} — once a side is locked it stays
    locked forever, immune to boxmot re-IDs on re-entry.

    Goalkeepers are identified by the player detection model (GOALKEEPER_ID class).
    Pitch-X comes from the field-homography produced by the field detection model.
    """
    if len(goalkeepers) == 0 or goalkeepers.tracker_id is None:
        return

    gk_feet = goalkeepers.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
    n = len(goalkeepers)

    if positions is not None and len(positions) == n:
        xs = [float(positions[i][0]) for i in range(n)]
    else:
        xs = [float(gk_feet[i][0]) / orig_w * 105.0 for i in range(n)]

    def _commit(det_i, side):
        gk_side_locked[side]        = True
        goalkeepers.class_id[det_i] = 1 if side == 'left' else 0

    if n >= 2:
        # Both GKs visible — unambiguous: smallest pitch-X is left, largest is right.
        order = sorted(range(n), key=lambda k: xs[k])
        _commit(order[0], 'left')
        _commit(order[-1], 'right')
        return

    # Single GK — assign based on pitch-X relative to goal-zone thresholds.
    for i in range(n):
        x = xs[i]
        left_locked  = gk_side_locked.get('left',  False)
        right_locked = gk_side_locked.get('right', False)

        if x < GK_SIDE_LO:
            _commit(i, 'left')
        elif x > GK_SIDE_HI:
            _commit(i, 'right')
        elif left_locked and not right_locked:
            _commit(i, 'right')
        elif right_locked and not left_locked:
            _commit(i, 'left')
        else:
            # Ambiguous midfield — assign by midline proximity without locking.
            goalkeepers.class_id[i] = 1 if x < GK_PITCH_MIDLINE else 0


def draw_direction_chevrons(frame: np.ndarray, player_detections: sv.Detections,
                            pixel_history: dict, min_speed_px: float = 2.0) -> np.ndarray:
    """Draw a filled direction chevron at each player's foot ellipse.

    Uses smoothed positional delta over the last N frames to determine direction —
    immune to the sign-flip bug that happens with velocity-based approaches on deceleration.
    """
    if len(player_detections) == 0 or player_detections.tracker_id is None:
        return frame

    _TEAM_BGR = {
        0: (0xFF, 0xBF, 0x00),
        1: (0x93, 0x14, 0xFF),
        2: (0x00, 0xD7, 0xFF),
    }
    MIN_SPEED = min_speed_px
    out = frame.copy()

    for i, tid in enumerate(player_detections.tracker_id):
        tid_int = int(tid)
        xyxy = player_detections.xyxy[i]
        cx   = float((xyxy[0] + xyxy[2]) / 2)
        cy   = float(xyxy[3])               # foot y
        box_w = float(xyxy[2] - xyxy[0])
        box_h = float(xyxy[3] - xyxy[1])

        hist = pixel_history.setdefault(tid_int, [])
        hist.append((cx, cy))
        if len(hist) > 8:
            hist.pop(0)

        # Direction from oldest to newest position in the history window
        if len(hist) < 3:
            continue
        dx = hist[-1][0] - hist[0][0]
        dy = hist[-1][1] - hist[0][1]
        dist = np.sqrt(dx * dx + dy * dy)
        if dist < MIN_SPEED:
            continue

        ux, uy = dx / dist, dy / dist

        team  = int(player_detections.class_id[i]) if player_detections.class_id is not None else 2
        color = _TEAM_BGR.get(team, _TEAM_BGR[2])

        rx = box_w / 2.0
        ry = box_h * 0.175

        OFFSET = rx * 0.4
        SIZE   = rx * 0.52

        tip_x = cx + ux * (rx + OFFSET + SIZE * 1.2)
        tip_y = cy + uy * (ry + OFFSET + SIZE * 1.2)
        px_, py_ = -uy, ux
        base_cx = cx + ux * (rx + OFFSET)
        base_cy = cy + uy * (ry + OFFSET)
        p1  = (int(base_cx + px_ * SIZE), int(base_cy + py_ * SIZE))
        p2  = (int(base_cx - px_ * SIZE), int(base_cy - py_ * SIZE))
        tip = (int(tip_x), int(tip_y))

        YELLOW = (0x00, 0xD4, 0xFF)  # BGR: #FFD400
        pts = np.array([p1, tip, p2], dtype=np.int32)
        cv2.fillPoly(out, [pts], (0, 0, 0))
        shrunk = np.array([
            (int(p1[0] * 0.85 + tip[0] * 0.15), int(p1[1] * 0.85 + tip[1] * 0.15)),
            tip,
            (int(p2[0] * 0.85 + tip[0] * 0.15), int(p2[1] * 0.85 + tip[1] * 0.15)),
        ], dtype=np.int32)
        cv2.fillPoly(out, [shrunk], YELLOW)

    return out


def process_all_frames(PLAYER_DETECTION_MODEL, FIELD_DETECTION_MODEL, CONFIG, team_classifier, on_frame=None, cancel_event=None):
    ellipse_annotator = sv.EllipseAnnotator(
        color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
        thickness=2
    )
    label_annotator = sv.LabelAnnotator(
        color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
        text_color=sv.Color.from_hex('#000000'),
        text_position=sv.Position.BOTTOM_CENTER,
        text_scale=0.5,
        text_thickness=1,
        text_padding=6,
    )
    triangle_annotator = sv.TriangleAnnotator(
        color=sv.Color.from_hex('#FFD700'),
        base=25, height=21, outline_thickness=1
    )

    tracker = HybridSort(
        reid_weights=_REID_WEIGHTS,
        device=torch.device(DEVICE),
        half=False,
        cmc_method='sof',       # sparse optical flow — much cheaper than ECC for near-static cameras
        track_thresh=0.3,
        low_thresh=0.1,
        max_age=5000,
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
    FIELD_REFRESH_INTERVAL = 30
    cached_transformer: ViewTransformer | None = None
    _best_kp_span = 0.0

    # Team classifier cache — keyed by tracker_id, refreshed every M frames
    TEAM_CLASSIFY_INTERVAL = 5
    team_id_cache: dict[int, int] = {}

    # ========== Track history for preventing ID misuse ==========
    track_last_pitch = {}      # track_id -> np.array([pitch_x, pitch_y])
    track_team_history = {}    # track_id -> last assigned team (0 or 1)
    pixel_history = {}         # track_id -> list of (cx, cy) pixel positions for direction
    MAX_PITCH_JUMP = 15.0      # metres – maximum plausible movement between frames
    gk_side_locked     = {}   # 'left'/'right' -> True once that side is permanently assigned
    gk_last_seen       = {}   # tracker_id -> last frame seen as goalkeeper
    GK_MAX_AGE         = 300  # ~10s at 30fps — evict stale GK IDs after this gap
    # Permanent tracker-ID registry for each GK side.
    # Once a side is first confirmed, its tracker ID is reserved forever.
    # team_id 1 = left GK, team_id 0 = right GK (matches _assign_gk_team_color).
    gk_side_id: dict[str, int] = {}   # 'left'/'right' -> reserved tracker ID
    team_label_flipped: bool | None = None  # True = KMeans labels flipped vs GK colors

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
        small_frame = cv2.resize(frame, (INFER_SIZE, INFER_SIZE), interpolation=cv2.INTER_NEAREST)

        # 1. Detect
        result = PLAYER_DETECTION_MODEL.infer(small_frame, confidence=CONFIDENCE)[0]
        detections = sv.Detections.from_inference(result)
        if len(detections) > 0:
            detections.xyxy[:, [0, 2]] *= scale_x
            detections.xyxy[:, [1, 3]] *= scale_y

        # 2. Separate ball
        ball_detections = detections[detections.class_id == BALL_ID]
        ball_detections.xyxy = sv.pad_boxes(xyxy=ball_detections.xyxy, px=10)

        # 3. Track players/GKs only — referees are excluded from the tracker
        #    so they never get assigned persistent IDs.
        non_ball = detections[detections.class_id != BALL_ID]
        non_ball = non_ball.with_nms(threshold=0.5, class_agnostic=False)
        referee_dets_raw = non_ball[non_ball.class_id == REFEREE_ID]
        trackable        = non_ball[non_ball.class_id != REFEREE_ID]

        # Drop detections whose foot position lands outside the pitch (uses cached homography)
        if cached_transformer is not None and len(trackable) > 0:
            feet = trackable.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            pitch_pts = cached_transformer.transform_points(feet)
            on_pitch = (
                (pitch_pts[:, 0] >= -5) & (pitch_pts[:, 0] <= 110) &
                (pitch_pts[:, 1] >= -5) & (pitch_pts[:, 1] <= 73)
            )
            trackable = trackable[on_pitch]

        player_detections = _boxmot_to_sv(tracker.update(_sv_to_boxmot(trackable), frame))

        ref_ids: set = set()  # referees are never tracked; kept as empty set for role labelling

        # 4. Get pitch transformer (cached, refresh every N frames)
        if frame_number % FIELD_REFRESH_INTERVAL == 0:
            try:
                result_field = FIELD_DETECTION_MODEL.infer(small_frame, confidence=0.3)[0]
                key_points   = sv.KeyPoints.from_inference(result_field)
                key_points.xy[0][:, 0] *= scale_x
                key_points.xy[0][:, 1] *= scale_y
                kp_filter    = key_points.confidence[0] > 0.75
                frame_ref    = key_points.xy[0][kp_filter]
                pitch_ref    = np.array(CONFIG.vertices)[kp_filter]
                print(f"[FIELD frm={frame_number}] kp>0.75={int(kp_filter.sum())}/{len(kp_filter)}  top8={np.sort(key_points.confidence[0])[::-1][:8].round(2).tolist()}", flush=True)
                if len(frame_ref) >= 6:
                    candidate = ViewTransformer(source=frame_ref, target=pitch_ref)
                    if len(non_ball) > 0:
                        all_feet  = non_ball.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
                        proj_feet = candidate.transform_points(all_feet)
                        on_pitch  = (
                            (proj_feet[:, 0] >= -20) & (proj_feet[:, 0] <= 125) &
                            (proj_feet[:, 1] >= -20) & (proj_feet[:, 1] <= 88)
                        )
                        pct_on = float(on_pitch.sum()) / len(all_feet)
                    else:
                        pct_on = 1.0
                    kp_span = float(pitch_ref[:, 0].max() - pitch_ref[:, 0].min())
                    print(f"[FIELD frm={frame_number}] pct_on_pitch={pct_on:.2f}  kp_span={kp_span:.0f}  best_span={_best_kp_span:.0f}", flush=True)
                    if pct_on >= 0.4 and kp_span >= _best_kp_span:
                        cached_transformer = candidate
                        _best_kp_span      = kp_span
            except Exception as _fe:
                print(f"[FIELD frm={frame_number}] error: {_fe}", flush=True)
        transformer = cached_transformer
        has_transform = transformer is not None

        # 5. Teleport guard — update position history for all tracked detections
        if has_transform and player_detections.tracker_id is not None:
            _all_feet   = player_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            _all_pitch  = transformer.transform_points(_all_feet)
            for _i, _tid in enumerate(player_detections.tracker_id):
                _tid_int = int(_tid)
                _cur     = _all_pitch[_i]
                if _tid_int not in track_last_pitch or \
                        np.linalg.norm(_cur - track_last_pitch[_tid_int]) <= MAX_PITCH_JUMP:
                    track_last_pitch[_tid_int] = _cur

        # 6. Assign GK team color — fresh slice, pitch-X based, boxmot IDs untouched
        goalkeepers = player_detections[player_detections.class_id == GOALKEEPER_ID]
        if len(goalkeepers) > 0:
            # Evict any GK tracker ID that was absent for > GK_MAX_AGE frames.
            # This prevents a returning player from re-using a stale GK ID.
            for _gi in range(len(goalkeepers)):
                _tid = int(goalkeepers.tracker_id[_gi])
                last = gk_last_seen.get(_tid)
                if last is not None and (frame_number - last) > GK_MAX_AGE:
                    _all_frame_ids = set(int(t) for t in player_detections.tracker_id) if player_detections.tracker_id is not None else set()
                    _next = max(_all_frame_ids) + 1 if _all_frame_ids else frame_number + 90000
                    goalkeepers.tracker_id[_gi] = _next
                    _tid = _next
                gk_last_seen[_tid] = frame_number

            gk_feet_raw  = goalkeepers.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            gk_pitch_pos = transformer.transform_points(gk_feet_raw) if has_transform else None
            print(f"[GK frm={frame_number}] n={len(goalkeepers)} "
                  f"pitch_xs={[round(float(gk_pitch_pos[i][0]),1) for i in range(len(goalkeepers))] if gk_pitch_pos is not None else 'no_transform'} "
                  f"locked={gk_side_locked}", flush=True)
            _assign_gk_team_color(goalkeepers, gk_side_locked, gk_pitch_pos, orig_w)

            # Enforce permanent per-side tracker IDs so the two GKs always have
            # distinct, stable IDs regardless of when they enter/leave frame.
            # class_id 1 = left GK, class_id 0 = right GK.
            _all_frame_ids = set(int(t) for t in player_detections.tracker_id) if player_detections.tracker_id is not None else set()
            _side_map = {1: 'left', 0: 'right'}
            for _gi in range(len(goalkeepers)):
                _team = int(goalkeepers.class_id[_gi])
                _side = _side_map.get(_team)
                if _side is None:
                    continue
                _cur_tid = int(goalkeepers.tracker_id[_gi])
                if _side not in gk_side_id:
                    # First confirmed sighting of this side — reserve this tracker ID.
                    gk_side_id[_side] = _cur_tid
                elif gk_side_id[_side] != _cur_tid:
                    # Tracker gave a different ID — remap back to the reserved one.
                    goalkeepers.tracker_id[_gi] = gk_side_id[_side]

            # Deduplicate: if two GKs still share an ID after remapping,
            # give the second a new free ID (should be very rare).
            seen_gk_ids: set = set()
            for _gi in range(len(goalkeepers)):
                _gid = int(goalkeepers.tracker_id[_gi])
                if _gid in seen_gk_ids:
                    _next = max(_all_frame_ids) + 1
                    goalkeepers.tracker_id[_gi] = _next
                    _all_frame_ids.add(_next)
                seen_gk_ids.add(int(goalkeepers.tracker_id[_gi]))
            print(f"[GK frm={frame_number}] after → ids={goalkeepers.tracker_id.tolist()} class_ids={goalkeepers.class_id.tolist()} registry={gk_side_id}", flush=True)
        gk_ids = set(goalkeepers.tracker_id.tolist()) if goalkeepers.tracker_id is not None else set()

        # 7. Classify player teams (throttled) — fresh slice after GK IDs are settled
        players = player_detections[player_detections.class_id == PLAYER_ID]
        if len(players) > 0:
            if frame_number % TEAM_CLASSIFY_INTERVAL == 0:
                player_crops = [sv.crop_image(frame, xyxy) for xyxy in players.xyxy]
                new_team_ids = team_classifier.predict(player_crops)
                _reserved_gk_ids = set(gk_side_id.values())
                for tid, cls in zip(players.tracker_id, new_team_ids):
                    if int(tid) not in _reserved_gk_ids:
                        team_id_cache[int(tid)] = int(cls)

            # Resolve KMeans label orientation using outfield players near GKs with known
            # pitch-side team assignments.  GK jerseys are a third colour (FIFA rule) so
            # predicting GK crops with the outfield KMeans classifier is unreliable.
            if team_label_flipped is None and len(goalkeepers) >= 2 and len(players) >= 4:
                # Both GKs have pitch-side class_ids (0/1) set by _assign_gk_team_color.
                # Sample a few outfield players closest to each GK and check which KMeans
                # label the classifier assigns them against the GK's known team.
                gk_positions = goalkeepers.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
                pl_positions = players.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
                votes_match = 0
                votes_total = 0
                for gi in range(len(goalkeepers)):
                    gk_team = int(goalkeepers.class_id[gi])
                    if gk_team < 0:
                        continue
                    dists = np.linalg.norm(pl_positions - gk_positions[gi], axis=1)
                    nearest = np.argsort(dists)[:3]
                    near_crops = [sv.crop_image(frame, players.xyxy[pi]) for pi in nearest]
                    near_preds = team_classifier.predict(near_crops)
                    votes_match += int(np.sum(near_preds == gk_team))
                    votes_total += len(near_preds)
                if votes_total > 0:
                    team_label_flipped = (votes_match / votes_total) < 0.5
                    print(f"[TEAM frm={frame_number}] flip={team_label_flipped} match={votes_match}/{votes_total}", flush=True)

            players.class_id = np.array([
                (1 - team_id_cache.get(int(tid), 0)) if team_label_flipped
                else team_id_cache.get(int(tid), 0)
                for tid in players.tracker_id
            ])

        # Rebuild final merged detections from fresh, correctly-labelled slices
        player_detections = sv.Detections.merge([players, goalkeepers])

        # Team flip guard
        if player_detections.tracker_id is not None:
            for i, tid in enumerate(player_detections.tracker_id):
                if int(tid) in gk_ids:
                    continue
                team = int(player_detections.class_id[i])
                if team == -1:
                    continue
                prev = track_team_history.get(int(tid))
                if prev is None:
                    track_team_history[int(tid)] = team
                elif prev != team:
                    track_team_history[int(tid)] = team
                    player_detections.class_id[i] = team

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

        # 8. Save players to CSV + build live rows (single pass, shared positions)
        positions = None
        pitch_positions = None
        if player_detections.tracker_id is not None:
            positions       = player_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            pitch_positions = transformer.transform_points(positions) if has_transform else None

            for i, tracker_id in enumerate(player_detections.tracker_id):
                tid = int(tracker_id)
                role = 'goalkeeper' if tid in gk_ids else ('referee' if tid in ref_ids else 'player')
                tracking_records.append({
                    'frame':      frame_number,
                    'player_id':  tid,
                    'x':          float(positions[i][0]),
                    'y':          float(positions[i][1]),
                    'pitch_x':    float(pitch_positions[i][0]) if pitch_positions is not None else None,
                    'pitch_y':    float(pitch_positions[i][1]) if pitch_positions is not None else None,
                    'role':       role,
                    'team_id':    int(player_detections.class_id[i]),
                    'confidence': float(player_detections.confidence[i])
                })

        # Fire live positions callback for minimap streaming (throttled to every 3 frames)
        if on_frame is not None and frame_number % 3 == 0:
            live_rows = []
            seen_ids: set = set()
            if positions is not None:
                for i, tid in enumerate(player_detections.tracker_id):
                    tid_int = int(tid)
                    if tid_int in seen_ids:
                        continue
                    seen_ids.add(tid_int)
                    role = 'goalkeeper' if tid_int in gk_ids else ('referee' if tid_int in ref_ids else 'player')
                    if pitch_positions is not None:
                        nx = round(float(pitch_positions[i][0]) / 105 * 100, 2)
                        ny = round(float(pitch_positions[i][1]) / 68  * 100, 2)
                        if not (0.0 <= nx <= 100.0 and 0.0 <= ny <= 100.0):
                            continue
                    else:
                        nx = round(float(positions[i][0]) / orig_w * 100, 2)
                        ny = round(float(positions[i][1]) / orig_h * 100, 2)
                    live_rows.append({
                        'id':   tid_int,
                        'team': int(player_detections.class_id[i]) if player_detections.class_id is not None else -1,
                        'role': role,
                        'x':    nx,
                        'y':    ny,
                    })

            if len(ball_detections) > 0:
                bxyxy = ball_detections.xyxy[0]
                bx = float((bxyxy[0] + bxyxy[2]) / 2)
                by = float((bxyxy[1] + bxyxy[3]) / 2)
                if has_transform:
                    bpt = transformer.transform_points(np.array([[bx, by]]))
                    bnx = round(float(bpt[0][0]) / 105 * 100, 2)
                    bny = round(float(bpt[0][1]) / 68  * 100, 2)
                    if 0.0 <= bnx <= 100.0 and 0.0 <= bny <= 100.0:
                        live_rows.append({'id': -1, 'team': -1, 'role': 'ball', 'x': bnx, 'y': bny})
                else:
                    bnx = round(bx / orig_w * 100, 2)
                    bny = round(by / orig_h * 100, 2)
                    live_rows.append({'id': -1, 'team': -1, 'role': 'ball', 'x': bnx, 'y': bny})

            on_frame(live_rows)

        # 9. Annotate and write frame
        if player_detections.class_id is not None:
            player_detections.class_id = np.where( player_detections.class_id == -1, 2, player_detections.class_id ).astype(int)

        labels = [f"#{tid}" for tid in player_detections.tracker_id] if player_detections.tracker_id is not None else []

        annotated_frame = ellipse_annotator.annotate(frame, player_detections)
        annotated_frame = label_annotator.annotate(annotated_frame, player_detections, labels)
        annotated_frame = draw_direction_chevrons(annotated_frame, player_detections, pixel_history)
        # Annotate referees without labels (no tracker ID)
        if len(referee_dets_raw) > 0:
            ref_vis = referee_dets_raw[np.ones(len(referee_dets_raw), dtype=bool)]
            ref_vis.class_id = np.full(len(ref_vis), 2, dtype=int)
            annotated_frame = ellipse_annotator.annotate(annotated_frame, ref_vis)
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


def rerender_video(source_video: str, tracking_csv: str, output_video: str,
                   on_progress=None, cancel_event=None):
    """Re-annotate source_video using corrected tracking_csv data.

    Reads team_id and role from the CSV per frame and draws ellipses + labels.
    on_progress(pct: float) is called with 0–100 as each frame is written.
    """
    df = pd.read_csv(tracking_csv)
    # Build a fast lookup: frame -> list of rows
    frame_data: dict[int, list] = {}
    for row in df.itertuples(index=False):
        f = int(row.frame)
        frame_data.setdefault(f, []).append(row)

    ellipse_annotator = sv.EllipseAnnotator(
        color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
        thickness=2,
    )
    label_annotator = sv.LabelAnnotator(
        color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
        text_color=sv.Color.from_hex('#000000'),
        text_position=sv.Position.BOTTOM_CENTER,
        text_scale=0.5,
        text_thickness=1,
        text_padding=6,
    )
    triangle_annotator = sv.TriangleAnnotator(
        color=sv.Color.from_hex('#FFD700'),
        base=25, height=21, outline_thickness=1,
    )

    video_info = sv.VideoInfo.from_video_path(source_video)
    total = video_info.total_frames or 1

    _raw = output_video.replace(".mp4", "_raw.mp4")
    out = cv2.VideoWriter(
        _raw,
        cv2.VideoWriter_fourcc(*"mp4v"),
        video_info.fps,
        (video_info.width, video_info.height),
    )

    for i, frame in enumerate(sv.get_video_frames_generator(source_video)):
        rows = frame_data.get(i, [])

        # Split into players/gks, referees, ball
        player_rows = [r for r in rows if r.role in ("player", "goalkeeper")]
        ref_rows    = [r for r in rows if r.role == "referee"]
        ball_rows   = [r for r in rows if r.role == "ball"]

        annotated = frame.copy()

        if player_rows:
            xyxy_list, class_ids, tracker_ids, labels = [], [], [], []
            for r in player_rows:
                # bbox not stored in CSV — reconstruct a small box around (x, y)
                bx, by = float(r.x), float(r.y)
                half = 20
                xyxy_list.append([bx - half, by - half * 2, bx + half, by])
                tid  = int(r.player_id)
                team = int(r.team_id) if int(r.team_id) >= 0 else 2
                class_ids.append(team)
                tracker_ids.append(tid)
                labels.append(f"#{tid}")

            det = sv.Detections(
                xyxy=np.array(xyxy_list, dtype=np.float32),
                class_id=np.array(class_ids, dtype=int),
                confidence=np.ones(len(player_rows), dtype=np.float32),
            )
            det.tracker_id = np.array(tracker_ids, dtype=int)
            annotated = ellipse_annotator.annotate(annotated, det)
            annotated = label_annotator.annotate(annotated, det, labels)

        if ref_rows:
            ref_xyxy, ref_cls = [], []
            for r in ref_rows:
                bx, by = float(r.x), float(r.y)
                half = 20
                ref_xyxy.append([bx - half, by - half * 2, bx + half, by])
                ref_cls.append(2)
            ref_det = sv.Detections(
                xyxy=np.array(ref_xyxy, dtype=np.float32),
                class_id=np.array(ref_cls, dtype=int),
                confidence=np.ones(len(ref_rows), dtype=np.float32),
            )
            annotated = ellipse_annotator.annotate(annotated, ref_det)

        if ball_rows:
            r = ball_rows[0]
            bx, by = float(r.x), float(r.y)
            ball_det = sv.Detections(
                xyxy=np.array([[bx - 15, by - 15, bx + 15, by + 15]], dtype=np.float32),
                class_id=np.array([2], dtype=int),
                confidence=np.array([1.0], dtype=np.float32),
            )
            annotated = triangle_annotator.annotate(annotated, ball_det)

        out.write(annotated)

        if on_progress and i % 30 == 0:
            on_progress(min(99.0, i / total * 100))

        if cancel_event and cancel_event.is_set():
            break

    out.release()

    # Transcode to H.264 faststart
    import av as _av
    from fractions import Fraction as _Fraction
    try:
        _inp = _av.open(_raw)
        _in_stream = _inp.streams.video[0]
        _int_fps = round(float(_in_stream.average_rate))
        _frame_tb = _Fraction(1, _int_fps)
        _out = _av.open(output_video, mode='w', options={'movflags': 'faststart'})
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
        import os as _os
        _os.remove(_raw)
    except Exception as _e:
        import os as _os
        print(f"[rerender] transcode failed ({_e}), keeping raw")
        if _os.path.exists(_raw):
            _os.replace(_raw, output_video)

    if on_progress:
        on_progress(100.0)


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
        if len(crops) >= 260:
            break

    team_classifier = TeamClassifier(device=DEVICE)
    team_classifier.fit(crops)

    process_all_frames(player_model, field_model, CONFIG, team_classifier, on_frame=on_frame, cancel_event=cancel_event)

    return


class RealTimeTracker:
    """Stateful single-frame processor for the real-time streaming mode.

    Usage:
        tracker = RealTimeTracker(player_model, field_model)
        # feed frames one by one from the WebSocket handler:
        annotated_jpg, live_rows = tracker.process_frame(frame_bgr)
    """

    INFER_SIZE = 640
    FIELD_REFRESH_INTERVAL = 10
    TEAM_CLASSIFY_INTERVAL = 5
    MIN_CROPS_BEFORE_FIT   = 100  # fit team classifier after accumulating this many crops
    MAX_PITCH_JUMP         = 15.0

    def __init__(self, player_model, field_model):
        self.player_model = player_model
        self.field_model  = field_model
        self.config       = CONFIG

        self.tracker = HybridSort(
            reid_weights=_REID_WEIGHTS,
            device=torch.device(DEVICE),
            half=True,
            cmc_method='sof',
            track_thresh=0.3,
            low_thresh=0.1,
            max_age=5000,
            min_hits=1,
            iou_threshold=0.3,
            delta_t=3,
            use_byte=True,
            with_reid=True,
            with_longterm_reid=True,
        )

        self.team_classifier: TeamClassifier | None = None
        self._team_crops: list = []
        self._team_id_cache: dict[int, int] = {}

        self._cached_transformer: ViewTransformer | None = None
        self._best_kp_span = 0.0

        self._track_last_pitch: dict = {}
        self._track_team_history: dict = {}
        self._gk_side_locked: dict = {}
        self._gk_last_seen: dict = {}
        self._gk_side_id: dict[str, int] = {}   # 'left'/'right' -> reserved tracker ID
        self._team_label_flipped: bool | None = None
        self._pixel_history: dict = {}

        self._frame_number = 0
        self._orig_h: int | None = None
        self._orig_w: int | None = None

        self._ellipse_ann = sv.EllipseAnnotator(
            color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
            thickness=2,
        )
        self._label_ann = sv.LabelAnnotator(
            color=sv.ColorPalette.from_hex(['#00BFFF', '#FF1493', '#FFD700']),
            text_color=sv.Color.from_hex('#000000'),
            text_position=sv.Position.BOTTOM_CENTER,
            text_scale=0.35,
            text_thickness=1,
            text_padding=3,
        )
        self._triangle_ann = sv.TriangleAnnotator(
            color=sv.Color.from_hex('#FFD700'),
            base=25, height=21, outline_thickness=1,
        )

    def process_frame(self, frame: np.ndarray) -> tuple[bytes, list]:
        """Process one BGR frame.

        Returns:
            annotated_jpeg: JPEG bytes of the annotated frame.
            live_rows:      list of dicts suitable for the PitchRadar WebSocket payload.
        """
        fn = self._frame_number
        if self._orig_h is None:
            self._orig_h, self._orig_w = frame.shape[:2]

        orig_h, orig_w = self._orig_h, self._orig_w
        small = cv2.resize(frame, (self.INFER_SIZE, self.INFER_SIZE), interpolation=cv2.INTER_LINEAR)
        scale_x = orig_w / self.INFER_SIZE
        scale_y = orig_h / self.INFER_SIZE

        # 1. Detect
        result = self.player_model.infer(small, confidence=CONFIDENCE)[0]
        detections = sv.Detections.from_inference(result)
        if len(detections) > 0:
            detections.xyxy[:, [0, 2]] *= scale_x
            detections.xyxy[:, [1, 3]] *= scale_y

        # 2. Separate ball
        ball_detections = detections[detections.class_id == BALL_ID]
        ball_detections.xyxy = sv.pad_boxes(xyxy=ball_detections.xyxy, px=10)

        # 3. Track players/GKs only — referees excluded from tracker (no persistent IDs)
        non_ball = detections[detections.class_id != BALL_ID]
        non_ball = non_ball.with_nms(threshold=0.5, class_agnostic=False)
        referee_dets_raw = non_ball[non_ball.class_id == REFEREE_ID]
        trackable        = non_ball[non_ball.class_id != REFEREE_ID]

        if self._cached_transformer is not None and len(trackable) > 0:
            feet = trackable.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            pitch_pts = self._cached_transformer.transform_points(feet)
            on_pitch = (
                (pitch_pts[:, 0] >= -5) & (pitch_pts[:, 0] <= 110) &
                (pitch_pts[:, 1] >= -5) & (pitch_pts[:, 1] <= 73)
            )
            trackable = trackable[on_pitch]

        player_detections = _boxmot_to_sv(self.tracker.update(_sv_to_boxmot(trackable), frame))

        ref_ids: set = set()

        # 4. Field homography (cached, refresh every N frames)
        if fn % self.FIELD_REFRESH_INTERVAL == 0:
            try:
                r_field    = self.field_model.infer(small, confidence=0.3)[0]
                key_points = sv.KeyPoints.from_inference(r_field)
                key_points.xy[0][:, 0] *= scale_x
                key_points.xy[0][:, 1] *= scale_y
                kp_filter  = key_points.confidence[0] > 0.75
                frame_ref  = key_points.xy[0][kp_filter]
                pitch_ref  = np.array(self.config.vertices)[kp_filter]
                if len(frame_ref) >= 6:
                    candidate = ViewTransformer(source=frame_ref, target=pitch_ref)
                    if len(non_ball) > 0:
                        all_feet  = non_ball.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
                        proj_feet = candidate.transform_points(all_feet)
                        on_pitch  = (
                            (proj_feet[:, 0] >= -20) & (proj_feet[:, 0] <= 125) &
                            (proj_feet[:, 1] >= -20) & (proj_feet[:, 1] <= 88)
                        )
                        pct_on = float(on_pitch.sum()) / len(all_feet)
                    else:
                        pct_on = 1.0
                    kp_span = float(pitch_ref[:, 0].max() - pitch_ref[:, 0].min())
                    if pct_on >= 0.4 and kp_span >= self._best_kp_span:
                        self._cached_transformer = candidate
                        self._best_kp_span       = kp_span
            except Exception:
                pass

        transformer   = self._cached_transformer
        has_transform = transformer is not None

        # 5. Teleport guard — update position history for all tracked detections
        if has_transform and player_detections.tracker_id is not None:
            _all_feet  = player_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            _all_pitch = transformer.transform_points(_all_feet)
            for _i, _tid in enumerate(player_detections.tracker_id):
                _tid_int = int(_tid)
                _cur     = _all_pitch[_i]
                if _tid_int not in self._track_last_pitch or \
                        np.linalg.norm(_cur - self._track_last_pitch[_tid_int]) <= self.MAX_PITCH_JUMP:
                    self._track_last_pitch[_tid_int] = _cur

        # 6. Assign GK team color — fresh slice, pitch-X based, boxmot IDs untouched
        GK_MAX_AGE  = 300  # ~10s at 30fps
        goalkeepers = player_detections[player_detections.class_id == GOALKEEPER_ID]
        if len(goalkeepers) > 0:
            # Evict stale GK IDs absent for > GK_MAX_AGE frames.
            for _gi in range(len(goalkeepers)):
                _tid = int(goalkeepers.tracker_id[_gi])
                last = self._gk_last_seen.get(_tid)
                if last is not None and (fn - last) > GK_MAX_AGE:
                    _all_frame_ids = set(int(t) for t in player_detections.tracker_id) if player_detections.tracker_id is not None else set()
                    _next = max(_all_frame_ids) + 1 if _all_frame_ids else fn + 90000
                    goalkeepers.tracker_id[_gi] = _next
                    _tid = _next
                self._gk_last_seen[_tid] = fn

            gk_pitch_pos = (transformer.transform_points(
                goalkeepers.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            ) if has_transform else None)
            _assign_gk_team_color(goalkeepers, self._gk_side_locked, gk_pitch_pos, orig_w)

            # Enforce permanent per-side tracker IDs.
            # class_id 1 = left GK, class_id 0 = right GK.
            _all_frame_ids = set(int(t) for t in player_detections.tracker_id) if player_detections.tracker_id is not None else set()
            _side_map = {1: 'left', 0: 'right'}
            for _gi in range(len(goalkeepers)):
                _team = int(goalkeepers.class_id[_gi])
                _side = _side_map.get(_team)
                if _side is None:
                    continue
                _cur_tid = int(goalkeepers.tracker_id[_gi])
                if _side not in self._gk_side_id:
                    self._gk_side_id[_side] = _cur_tid
                elif self._gk_side_id[_side] != _cur_tid:
                    goalkeepers.tracker_id[_gi] = self._gk_side_id[_side]

            # Deduplicate: if two GKs still share an ID after remapping (very rare).
            seen_gk_ids: set = set()
            for _gi in range(len(goalkeepers)):
                _gid = int(goalkeepers.tracker_id[_gi])
                if _gid in seen_gk_ids:
                    _next = max(_all_frame_ids) + 1
                    goalkeepers.tracker_id[_gi] = _next
                    _all_frame_ids.add(_next)
                seen_gk_ids.add(int(goalkeepers.tracker_id[_gi]))
        gk_ids = set(goalkeepers.tracker_id.tolist()) if goalkeepers.tracker_id is not None else set()

        # 7. Team classification — fresh slice after GK IDs are settled
        players = player_detections[player_detections.class_id == PLAYER_ID]
        if len(players) > 0:
            crops = [sv.crop_image(frame, xyxy) for xyxy in players.xyxy]
            if self.team_classifier is None:
                self._team_crops.extend(crops)
                print(f"[TEAM rt fn={fn}] crops={len(self._team_crops)}/{self.MIN_CROPS_BEFORE_FIT}", flush=True)
                if len(self._team_crops) >= self.MIN_CROPS_BEFORE_FIT:
                    self.team_classifier = TeamClassifier(device=DEVICE)
                    self.team_classifier.fit(self._team_crops)
                    print(f"[TEAM rt fn={fn}] classifier fit!", flush=True)
                    new_cls = self.team_classifier.predict(crops)
                    _reserved = set(self._gk_side_id.values())
                    for tid, cls in zip(players.tracker_id, new_cls):
                        if int(tid) not in _reserved:
                            self._team_id_cache[int(tid)] = int(cls)
            elif fn % self.TEAM_CLASSIFY_INTERVAL == 0:
                new_cls = self.team_classifier.predict(crops)
                _reserved = set(self._gk_side_id.values())
                for tid, cls in zip(players.tracker_id, new_cls):
                    if int(tid) not in _reserved:
                        self._team_id_cache[int(tid)] = int(cls)

            # Resolve KMeans label orientation once, using outfield players near GKs.
            # GK jerseys are a third colour (FIFA rule) so predicting GK crops is unreliable.
            if self._team_label_flipped is None and len(goalkeepers) >= 2 and len(players) >= 4:
                gk_positions = goalkeepers.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
                pl_positions = players.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
                votes_match = 0
                votes_total = 0
                for gi in range(len(goalkeepers)):
                    gk_team = int(goalkeepers.class_id[gi])
                    if gk_team < 0:
                        continue
                    dists = np.linalg.norm(pl_positions - gk_positions[gi], axis=1)
                    nearest = np.argsort(dists)[:3]
                    near_crops = [sv.crop_image(frame, players.xyxy[pi]) for pi in nearest]
                    near_preds = self.team_classifier.predict(near_crops)
                    votes_match += int(np.sum(near_preds == gk_team))
                    votes_total += len(near_preds)
                if votes_total > 0:
                    self._team_label_flipped = (votes_match / votes_total) < 0.5
                    print(f"[TEAM rt fn={fn}] flip={self._team_label_flipped} match={votes_match}/{votes_total}", flush=True)

            players.class_id = np.array([
                (1 - self._team_id_cache.get(int(tid), 0)) if self._team_label_flipped
                else self._team_id_cache.get(int(tid), 0)
                for tid in players.tracker_id
            ])

        # Rebuild merged detections from correctly-labelled, fresh slices
        player_detections = sv.Detections.merge([players, goalkeepers])

        # Team flip guard
        if player_detections.tracker_id is not None:
            for i, tid in enumerate(player_detections.tracker_id):
                if int(tid) in gk_ids:
                    continue
                team = int(player_detections.class_id[i])
                if team == -1:
                    continue
                prev = self._track_team_history.get(int(tid))
                if prev is None:
                    self._track_team_history[int(tid)] = team
                elif prev != team:
                    self._track_team_history[int(tid)] = team
                    player_detections.class_id[i] = team

        # 7. Build live_rows for minimap
        live_rows: list = []
        seen_ids: set   = set()
        positions       = None
        pitch_positions = None
        if player_detections.tracker_id is not None and len(player_detections) > 0:
            positions       = player_detections.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)
            pitch_positions = transformer.transform_points(positions) if has_transform else None

            for i, tid in enumerate(player_detections.tracker_id):
                tid_int = int(tid)
                if tid_int in seen_ids:
                    continue
                seen_ids.add(tid_int)
                role = ('goalkeeper' if tid_int in gk_ids else
                        'referee'   if tid_int in ref_ids else 'player')
                if pitch_positions is not None:
                    nx = round(float(pitch_positions[i][0]) / 105 * 100, 2)
                    ny = round(float(pitch_positions[i][1]) / 68  * 100, 2)
                    if not (0.0 <= nx <= 100.0 and 0.0 <= ny <= 100.0):
                        continue
                else:
                    nx = round(float(positions[i][0]) / orig_w * 100, 2)
                    ny = round(float(positions[i][1]) / orig_h * 100, 2)
                live_rows.append({
                    'id':   tid_int,
                    'team': int(player_detections.class_id[i]) if player_detections.class_id is not None else -1,
                    'role': role,
                    'x':    nx,
                    'y':    ny,
                })

        if len(ball_detections) > 0:
            bxyxy = ball_detections.xyxy[0]
            bx = float((bxyxy[0] + bxyxy[2]) / 2)
            by = float((bxyxy[1] + bxyxy[3]) / 2)
            if has_transform:
                bpt = transformer.transform_points(np.array([[bx, by]]))
                bnx = round(float(bpt[0][0]) / 105 * 100, 2)
                bny = round(float(bpt[0][1]) / 68  * 100, 2)
                if 0.0 <= bnx <= 100.0 and 0.0 <= bny <= 100.0:
                    live_rows.append({'id': -1, 'team': -1, 'role': 'ball', 'x': bnx, 'y': bny})
            else:
                live_rows.append({
                    'id': -1, 'team': -1, 'role': 'ball',
                    'x': round(bx / orig_w * 100, 2),
                    'y': round(by / orig_h * 100, 2),
                })

        # 8. Annotate
        if player_detections.class_id is not None:
            player_detections.class_id = np.where(
                player_detections.class_id == -1, 2, player_detections.class_id
            ).astype(int)

        labels = ([f"#{tid}" for tid in player_detections.tracker_id]
                  if player_detections.tracker_id is not None else [])

        annotated = self._ellipse_ann.annotate(frame.copy(), player_detections)
        annotated = self._label_ann.annotate(annotated, player_detections, labels)
        annotated = draw_direction_chevrons(annotated, player_detections, self._pixel_history)
        if len(referee_dets_raw) > 0:
            ref_vis = referee_dets_raw[np.ones(len(referee_dets_raw), dtype=bool)]
            ref_vis.class_id = np.full(len(ref_vis), 2, dtype=int)
            annotated = self._ellipse_ann.annotate(annotated, ref_vis)
        annotated = self._triangle_ann.annotate(annotated, ball_detections)

        ok, jpg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 92])
        jpeg_bytes = jpg.tobytes() if ok else b""

        self._frame_number += 1
        return jpeg_bytes, live_rows