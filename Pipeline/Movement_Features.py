import pandas as pd
import numpy as np


class MovementFeatureTracker:
    def __init__(self, fps=25, speed_cap=200, sprint_quantile=0.75, history_size=500):
        self.fps = fps
        self.speed_cap = speed_cap
        self.sprint_quantile = sprint_quantile
        self.history_size = history_size
        self.previous_positions = {}
        self.previous_speeds = {}
        self.speed_history = []

    def _current_sprint_threshold(self):
        if not self.speed_history:
            return 0.0
        history = self.speed_history[-self.history_size:]
        return float(np.quantile(history, self.sprint_quantile))

    def process_detections(self, frame_id, detections):
        movement_rows = []

        for det in detections:
            if det.get('role') not in {'player', 'goalkeeper'}:
                continue

            player_id = det.get('player_id')
            x = float(det.get('x', 0.0))
            y = float(det.get('y', 0.0))
            previous_position = self.previous_positions.get(player_id)

            if previous_position is None:
                distance = 0.0
            else:
                distance = float(np.hypot(x - previous_position[0], y - previous_position[1]))

            speed = min(distance * self.fps, self.speed_cap)
            previous_speed = self.previous_speeds.get(player_id, speed)
            acceleration = 0.0 if previous_position is None else speed - previous_speed

            self.previous_positions[player_id] = (x, y)
            self.previous_speeds[player_id] = speed
            self.speed_history.append(speed)

            movement_rows.append({
                'frame': frame_id,
                'player_id': player_id,
                'team_id': det.get('team_id'),
                'distance': round(distance, 3),
                'speed': round(speed, 3),
                'acceleration': round(acceleration, 3),
            })

        sprint_threshold = self._current_sprint_threshold()
        movement_by_player = {}
        for row in movement_rows:
            row['is_sprint'] = int(row['speed'] > sprint_threshold and sprint_threshold > 0)
            movement_by_player[row['player_id']] = row

        frame_summary = {
            'frame': frame_id,
            'player_count': len(movement_rows),
            'avg_speed': round(float(np.mean([row['speed'] for row in movement_rows])), 3) if movement_rows else 0.0,
            'max_speed': round(float(np.max([row['speed'] for row in movement_rows])), 3) if movement_rows else 0.0,
            'avg_acceleration': round(float(np.mean([row['acceleration'] for row in movement_rows])), 3) if movement_rows else 0.0,
            'sprint_count': int(sum(row['is_sprint'] for row in movement_rows)),
            'sprint_threshold': round(float(sprint_threshold), 3),
            'players': movement_rows,
        }

        return movement_by_player, frame_summary


def features():
    df = pd.read_csv('Test_Data/tracking.csv')

    #filter players/keepers
    movement_df = df[df['role'].isin(['player', 'goalkeeper'])].copy()
    movement_df = movement_df.sort_values(['player_id', 'frame']).reset_index(drop=True)

    #distance moved per frame
    FPS = 25

    # For each player, calculate distance moved from previous frame
    # .groupby ensures we never calculate distance between two different players
    movement_df['x_prev'] = movement_df.groupby('player_id')['x'].shift(1)
    movement_df['y_prev'] = movement_df.groupby('player_id')['y'].shift(1)

    # distance = sqrt((x2-x1)^2 + (y2-y1)^2)
    movement_df['distance'] = np.sqrt(
        (movement_df['x'] - movement_df['x_prev'])**2 +
        (movement_df['y'] - movement_df['y_prev'])**2
    )

    # First frame of each player has no previous frame so distance = 0
    movement_df['distance'] = movement_df['distance'].fillna(0)


    #Speed
    movement_df['speed'] = movement_df['distance'] * FPS

    #Acceleration
    movement_df['speed_prev'] = movement_df.groupby('player_id')['speed'].shift(1)
    movement_df['acceleration'] = movement_df['speed'] - movement_df['speed_prev']
    movement_df['acceleration'] = movement_df['acceleration'].fillna(0)

    #Speed Cap
    SPEED_CAP = 200

    before = len(movement_df[movement_df['speed'] > SPEED_CAP])

    # Cap the speed and recalculate acceleration
    movement_df['speed'] = movement_df['speed'].clip(upper=SPEED_CAP)
    movement_df['distance'] = movement_df['speed'] / FPS

    # Recalculate acceleration after capping
    movement_df['speed_prev'] = movement_df.groupby('player_id')['speed'].shift(1)
    movement_df['acceleration'] = movement_df['speed'] - movement_df['speed_prev']
    movement_df['acceleration'] = movement_df['acceleration'].fillna(0)
    movement_df = movement_df.drop(columns=['speed_prev'])

    #Sprint
    SPRINT_THRESHOLD = movement_df['speed'].quantile(0.75)
    movement_df['is_sprint'] = (movement_df['speed'] > SPRINT_THRESHOLD).astype(int)

    #Save
    movement_df.to_csv('Math_Data_CSV/1_Movement_Features.csv', index=False)

    return 
