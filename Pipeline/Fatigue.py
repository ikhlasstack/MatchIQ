
import pandas as pd
import numpy as np
from scipy import stats
from scipy import stats

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
