# import cv2

# try:
#     from .Player_Track import RealTimePlayerTracker
#     from .Movement_Features import MovementFeatureTracker
#     from .Fatigue import FatigueTracker
#     from .goal_prob import get_frame_goal_probabilities
#     from .Match_Outcome import MatchOutcomeTracker
# except ImportError:
#     from Player_Track import RealTimePlayerTracker
#     from Movement_Features import MovementFeatureTracker
#     from Fatigue import FatigueTracker
#     from goal_prob import get_frame_goal_probabilities
#     from Match_Outcome import MatchOutcomeTracker


# class FramePipeline:
#     def __init__(self, source_video_path='../Test_Data/Testing.mp4'):
#         self.tracker = RealTimePlayerTracker(source_video_path=source_video_path)
#         self.movement_tracker = MovementFeatureTracker()
#         self.fatigue_tracker = FatigueTracker()
#         self.match_outcome_tracker = MatchOutcomeTracker()

#     def process_frame(self, frame, frame_id):
#         detections = self.tracker.process_frame(frame, frame_id)
#         movement_by_player, movement_summary = self.movement_tracker.process_detections(frame_id, detections)
#         fatigue_by_player = self.fatigue_tracker.process_movement(movement_by_player)
#         goal_probability_by_player = get_frame_goal_probabilities(detections, movement_by_player)

#         for detection in detections:
#             player_id = detection.get('player_id')
#             movement = movement_by_player.get(player_id)
#             if movement is not None:
#                 detection['movement'] = movement
#             fatigue = fatigue_by_player.get(player_id)
#             if fatigue is not None:
#                 detection['fatigue'] = fatigue
#             goal_probability = goal_probability_by_player.get(player_id)
#             if goal_probability is not None:
#                 detection['goal_probability'] = goal_probability

#         match_outcome = self.match_outcome_tracker.process_frame(
#             frame_id,
#             detections,
#             movement_by_player,
#             goal_probability_by_player,
#         )

#         return {
#             'frame_id': frame_id,
#             'detections': detections,
#             'movement_features': movement_summary,
#             'fatigue': list(fatigue_by_player.values()),
#             'goal_probability': list(goal_probability_by_player.values()),
#             'match_outcome': match_outcome,
#             'events': [],
#         }


# def process_frame(frame, frame_id, pipeline=None):
#     active_pipeline = pipeline or FramePipeline()
#     return active_pipeline.process_frame(frame, frame_id)


# if __name__ == '__main__':
#     cap = cv2.VideoCapture('../Test_Data/Testing.mp4')
#     pipeline = FramePipeline('../Test_Data/Testing.mp4')
#     frame_id = 0
#     while cap.isOpened():
#         ret, frame = cap.read()
#         if not ret:
#             break
#         results = pipeline.process_frame(frame, frame_id)
#         print(f"Frame {frame_id}: {len(results['detections'])} detections")
#         frame_id += 1
#     cap.release()
