import os
import sys
import cv2

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from Player_Track import player_tracking
from Movement_Features import features
from Fatigue import fatigue
from goal_prob import goal_prob
from Match_Outcome import Match_Outcome
from frame_pipeline import FramePipeline


def main():
    #Run Pipeline
    
    player_tracking() 
    features()
    fatigue()
    goal_prob()
    Match_Outcome()
    print("Pipeline Completed")


def create_frame_pipeline(source_video_path='Test_Data/Testing.mp4'):
    return FramePipeline(source_video_path=source_video_path)


def run_frame_pipeline(source_video_path='Test_Data/Testing.mp4'):
    pipeline = create_frame_pipeline(source_video_path)
    cap = cv2.VideoCapture(source_video_path)
    frame_id = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        pipeline.process_frame(frame, frame_id)
        frame_id += 1

    cap.release()


if __name__ == "__main__":
    main()
