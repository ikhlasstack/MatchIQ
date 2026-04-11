
import pandas as pd
import numpy as np
from scipy import stats
from scipy import stats


class FatigueTracker:
    def __init__(self, warmup_frames=30, baseline_alpha=0.05, ema_alpha=0.2):
        self.warmup_frames = warmup_frames
        self.baseline_alpha = baseline_alpha
        self.ema_alpha = ema_alpha
        self.player_state = {}

    def _get_state(self, player_id, team_id):
        if player_id not in self.player_state:
            self.player_state[player_id] = {
                'team_id': team_id,
                'samples': 0,
                'baseline_speed': 0.0,
                'baseline_accel': 0.0,
                'baseline_sprint': 0.0,
                'ema_speed': 0.0,
                'ema_accel': 0.0,
                'ema_sprint': 0.0,
            }
        return self.player_state[player_id]

    def process_movement(self, movement_by_player):
        fatigue_by_player = {}

        for player_id, movement in movement_by_player.items():
            state = self._get_state(player_id, movement.get('team_id'))
            speed = float(movement.get('speed', 0.0))
            acceleration = max(float(movement.get('acceleration', 0.0)), 0.0)
            sprint = float(movement.get('is_sprint', 0.0))

            if state['samples'] == 0:
                state['baseline_speed'] = speed
                state['baseline_accel'] = acceleration
                state['baseline_sprint'] = sprint
                state['ema_speed'] = speed
                state['ema_accel'] = acceleration
                state['ema_sprint'] = sprint
            else:
                state['ema_speed'] = ((1 - self.ema_alpha) * state['ema_speed']) + (self.ema_alpha * speed)
                state['ema_accel'] = ((1 - self.ema_alpha) * state['ema_accel']) + (self.ema_alpha * acceleration)
                state['ema_sprint'] = ((1 - self.ema_alpha) * state['ema_sprint']) + (self.ema_alpha * sprint)

                if state['samples'] < self.warmup_frames:
                    alpha = self.baseline_alpha
                    state['baseline_speed'] = ((1 - alpha) * state['baseline_speed']) + (alpha * speed)
                    state['baseline_accel'] = ((1 - alpha) * state['baseline_accel']) + (alpha * acceleration)
                    state['baseline_sprint'] = ((1 - alpha) * state['baseline_sprint']) + (alpha * sprint)

            state['samples'] += 1

            speed_drop = np.clip(
                (state['baseline_speed'] - state['ema_speed']) / max(state['baseline_speed'], 1.0),
                0,
                1,
            )
            accel_drop = np.clip(
                (state['baseline_accel'] - state['ema_accel']) / max(state['baseline_accel'], 1.0),
                0,
                1,
            )
            sprint_drop = np.clip(
                (state['baseline_sprint'] - state['ema_sprint']) / max(state['baseline_sprint'], 1.0),
                0,
                1,
            )

            fatigue_score = round(float((0.4 * speed_drop) + (0.3 * accel_drop) + (0.3 * sprint_drop)), 3)
            fatigue_by_player[player_id] = {
                'player_id': player_id,
                'team_id': state['team_id'],
                'fatigue_score': fatigue_score,
                'speed_drop': round(float(speed_drop), 3),
                'accel_drop': round(float(accel_drop), 3),
                'sprint_drop': round(float(sprint_drop), 3),
                'fatigue_level': fatigue_label(fatigue_score),
                'samples': state['samples'],
            }

        return fatigue_by_player

def half_stats(half_df):
    return half_df.groupby('player_id').agg(
        avg_speed    = ('speed',     'mean'),
        avg_accel    = ('acceleration', lambda x: x[x > 0].mean()),  # only positive acceleration
        sprint_rate  = ('is_sprint', 'mean')   # fraction of frames that were sprints
    ).fillna(0)

def fatigue_label(score):
    if score >= 0.7:
        return 'HIGH'
    elif score >= 0.4:
        return 'MEDIUM'
    else:
        return 'LOW'

def fatigue():
    df = pd.read_csv('movement_features.csv')

    #Split in 1st and 2nd half
    total_frames = df['frame'].max()
    midpoint     = total_frames // 2
    first_half  = df[df['frame'] <= midpoint]
    second_half = df[df['frame'] >  midpoint]

    #per player stats
    first_stats  = half_stats(first_half)
    second_stats = half_stats(second_half)

    #combine both halves
    stats = first_stats.join(second_stats, lsuffix='_first', rsuffix='_second')
    stats['speed_drop']  = ((stats['avg_speed_first']   - stats['avg_speed_second'])   / stats['avg_speed_first'].replace(0, 1)).clip(0, 1)
    stats['accel_drop']  = ((stats['avg_accel_first']   - stats['avg_accel_second'])   / stats['avg_accel_first'].replace(0, 1)).clip(0, 1)
    stats['sprint_drop'] = ((stats['sprint_rate_first'] - stats['sprint_rate_second']) / stats['sprint_rate_first'].replace(0, 1)).clip(0, 1)

    #Final Fatigue Scores
    stats['fatigue_score'] = (
    0.4 * stats['speed_drop'] +
    0.3 * stats['accel_drop'] +
    0.3 * stats['sprint_drop']
    ).round(3)

    # Add team info
    team_info = df.groupby('player_id')['team_id'].first()
    stats['team_id'] = team_info

    # Sort by fatigue score
    stats['fatigue_score'] = stats['fatigue_score'].fillna(0)

    fatigue_df = stats[['team_id', 'fatigue_score', 'speed_drop', 'accel_drop', 'sprint_drop']].sort_values('fatigue_score', ascending=False)

    #Fatigue Label
    fatigue_df['fatigue_level'] = fatigue_df['fatigue_score'].apply(fatigue_label)

    #Save to csv
    fatigue_df.to_csv('Math_Data_CSV/1_fatigue_scores.csv')

    return 
