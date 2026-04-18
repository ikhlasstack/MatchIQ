
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
SOURCE_VIDEO_PATH  = "../Test_Data/Testing.mp4"
OUTPUT_VIDEO_PATH  = "../Test_Data/tracked_output.mp4"
OUTPUT_CSV_PATH    = "../Match_Data_CSV/1_tracking.csv"

# === YOUR MODEL'S CLASS IDs (confirmed from Cell 7 output) ===
BALL_ID       = 1
GOALKEEPER_ID = 2
PLAYER_ID     = 3
REFEREE_ID    = 4
CONFIDENCE    = 0.3

load_dotenv()  # loads variables from .env into os.environ

HF_TOKEN = os.getenv("HF_TOKEN")
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")


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
        self.tracker = sv.ByteTrack(
            track_activation_threshold=0.25,
            lost_track_buffer=100,
            minimum_matching_threshold=0.8,
            frame_rate=25,
        )
        self.tracker.reset()
        self.team_classifier = None
        self.team_crops = []
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
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

    def _resolve_transformer(self, frame):
        try:
            field_result = self.field_model.infer(frame, confidence=0.3)[0]
            key_points = sv.KeyPoints.from_inference(field_result)
            kp_filter = key_points.confidence[0] > 0.5
            frame_ref = key_points.xy[0][kp_filter]
            pitch_ref = np.array(self.config.vertices)[kp_filter]
            if len(frame_ref) >= 4:
                return ViewTransformer(source=frame_ref, target=pitch_ref)
        except Exception:
            return None
        return None

    def process_frame(self, frame, frame_id):
        result = self.player_model.infer(frame, confidence=self.confidence)[0]
        detections = sv.Detections.from_inference(result)

        ball_detections = detections[detections.class_id == BALL_ID]
        if len(ball_detections) > 0:
            ball_detections.xyxy = sv.pad_boxes(xyxy=ball_detections.xyxy, px=10)

        non_ball = detections[detections.class_id != BALL_ID]
        non_ball = non_ball.with_nms(threshold=0.5, class_agnostic=False)
        non_ball = self.tracker.update_with_detections(detections=non_ball)

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
        transformer = self._resolve_transformer(frame)
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



def process_all_frames(PLAYER_DETECTION_MODEL, FIELD_DETECTION_MODEL, CONFIG, team_classifier):
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

    tracker = sv.ByteTrack(
        track_activation_threshold=0.5,
        lost_track_buffer=30,
        minimum_matching_threshold=0.7,
        frame_rate=25
    )
    tracker.reset()

    video_info = sv.VideoInfo.from_video_path(SOURCE_VIDEO_PATH)
    out = cv2.VideoWriter(
        OUTPUT_VIDEO_PATH,
        cv2.VideoWriter_fourcc(*"mp4v"),
        video_info.fps,
        (video_info.width, video_info.height)
    )

    tracking_records = []
    frame_number = 0

    for frame in tqdm(
        sv.get_video_frames_generator(SOURCE_VIDEO_PATH),
        total=video_info.total_frames,
        desc='Processing'
    ):
        # 1. Detect
        result = PLAYER_DETECTION_MODEL.infer(frame, confidence=CONFIDENCE)[0]
        detections = sv.Detections.from_inference(result)

        # 2. Separate ball
        ball_detections = detections[detections.class_id == BALL_ID]
        ball_detections.xyxy = sv.pad_boxes(xyxy=ball_detections.xyxy, px=10)

        # 3. Track players
        player_detections = detections[detections.class_id != BALL_ID]
        player_detections = player_detections.with_nms(threshold=0.5, class_agnostic=False)
        player_detections = tracker.update_with_detections(detections=player_detections)

        # 4. Split by role BEFORE class_ids get changed
        goalkeepers = player_detections[player_detections.class_id == GOALKEEPER_ID]
        players     = player_detections[player_detections.class_id == PLAYER_ID]
        referees    = player_detections[player_detections.class_id == REFEREE_ID]

        # remember tracker_ids per role for CSV saving later
        gk_ids  = set(goalkeepers.tracker_id.tolist()) if goalkeepers.tracker_id is not None else set()
        ref_ids = set(referees.tracker_id.tolist()) if referees.tracker_id is not None else set()

        # 5. Classify teams
        if len(players) > 0:
            player_crops = [sv.crop_image(frame, xyxy) for xyxy in players.xyxy]
            players.class_id = team_classifier.predict(player_crops)

        if len(goalkeepers) > 0 and len(players) > 0:
            goalkeepers.class_id = resolve_goalkeepers_team_id(players, goalkeepers)

        if len(referees) > 0:
            referees.class_id = np.full(len(referees), -1, dtype=int)

        player_detections = sv.Detections.merge([players, goalkeepers, referees])

        # 6. Get pitch transformer
        has_transform = False
        try:
            result_field = FIELD_DETECTION_MODEL.infer(frame, confidence=0.3)[0]
            key_points   = sv.KeyPoints.from_inference(result_field)
            kp_filter    = key_points.confidence[0] > 0.5
            frame_ref    = key_points.xy[0][kp_filter]
            pitch_ref    = np.array(CONFIG.vertices)[kp_filter]
            if len(frame_ref) >= 4:
                transformer   = ViewTransformer(source=frame_ref, target=pitch_ref)
                has_transform = True
        except:
            pass

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

            MAX_TRACKER_ID = 25
            for i, tracker_id in enumerate(player_detections.tracker_id):
                tid = int(tracker_id)
                if tid > MAX_TRACKER_ID:
                    # Mark as invalid or skip
                    continue  # Optionally, you could append with a special flag instead of skipping
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

        # 9. Annotate and write frame
        if player_detections.class_id is not None:
            player_detections.class_id = np.where( player_detections.class_id == -1, 2, player_detections.class_id ).astype(int)

        labels = [f"#{tid}" for tid in player_detections.tracker_id] if player_detections.tracker_id is not None else []

        annotated_frame = frame.copy()
        annotated_frame = ellipse_annotator.annotate(annotated_frame, player_detections)
        annotated_frame = label_annotator.annotate(annotated_frame, player_detections, labels)
        annotated_frame = triangle_annotator.annotate(annotated_frame, ball_detections)
        out.write(annotated_frame)

        frame_number += 1

    out.release()

    # 10. Save CSV
    df = pd.DataFrame(tracking_records)
    df.to_csv(OUTPUT_CSV_PATH, index=False)

    print(f'\n=== DONE ===')
    print(f'Frames processed: {frame_number}')
    print(f'Total records: {len(df)}')
    print(f'Roles: {df["role"].value_counts().to_dict()}')
    print(f'Teams (players only): {df[df["role"].isin(["player","goalkeeper"])]["team_id"].value_counts().to_dict()}')
    print(f'\nSample rows:')
    print(df[df['role'] == 'player'][['frame','player_id','x','y','pitch_x','pitch_y','team_id']].head(8))


def player_tracking():
    # 1 Load model
    PLAYER_DETECTION_MODEL = get_model(
    model_id="football-vgiqa-3njno/2",
    api_key=ROBOFLOW_API_KEY
)
    FIELD_DETECTION_MODEL = get_model(
    model_id="football-field-detection-f07vi/14",
    api_key=ROBOFLOW_API_KEY
)
    # 2 pitchconfig
    CONFIG = SoccerPitchConfiguration()

    # 3 Player detect in frame
    frame_generator = sv.get_video_frames_generator(SOURCE_VIDEO_PATH)
    frame = next(frame_generator)

    result = PLAYER_DETECTION_MODEL.infer(frame, confidence=CONFIDENCE)[0]
    detections = sv.Detections.from_inference(result)

    # 4 crops
    DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using: {DEVICE}")
    STRIDE = 30

    crops=[]
    for frame in tqdm(
    sv.get_video_frames_generator(SOURCE_VIDEO_PATH, stride=STRIDE),
    desc='Collecting crops'
    ):
        result = PLAYER_DETECTION_MODEL.infer(frame, confidence=CONFIDENCE)[0]
        detections = sv.Detections.from_inference(result)

        # only collect actual players for fitting
        player_only = detections[detections.class_id == PLAYER_ID]
        player_crops = [sv.crop_image(frame, xyxy) for xyxy in player_only.xyxy]
        crops += player_crops
    
    # 5 team classifier
    team_classifier = TeamClassifier(device=DEVICE)
    team_classifier.fit(crops)

    # 6 DETECTION ON ALL FRAMES
    process_all_frames(PLAYER_DETECTION_MODEL, FIELD_DETECTION_MODEL, CONFIG, team_classifier)

    return 
