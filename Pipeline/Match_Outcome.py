import pandas as pd
import numpy as np

def calculate_match_outcome(possession, shots, territory, momentum, avg_danger):
    """
    Combine all statistics into win/draw/loss probabilities.

    Each stat contributes a score for each team.
    Higher score = more likely to win.
    """

    # Normalize each stat to 0-1 scale
    total_shots    = shots[0] + shots[1] + 1e-6
    total_danger   = avg_danger[0] + avg_danger[1] + 1e-6

    poss_score  = {0: possession[0] / 100,    1: possession[1] / 100}
    shot_score  = {0: shots[0] / total_shots,  1: shots[1] / total_shots}
    terr_score  = {0: territory[0] / 100,      1: territory[1] / 100}
    mom_score   = {0: momentum[0] / 100,       1: momentum[1] / 100}
    danger_score= {0: avg_danger[0] / total_danger, 1: avg_danger[1] / total_danger}

    # Weighted team strength score
    # Shots and danger matter most for predicting outcome
    strength = {}
    for team in [0, 1]:
        strength[team] = (
            0.25 * shot_score[team]   +
            0.25 * danger_score[team] +
            0.20 * poss_score[team]   +
            0.15 * terr_score[team]   +
            0.15 * mom_score[team]
        )

    # Convert strength difference to win probability
    # Using a sigmoid-like function
    diff = strength[0] - strength[1]

    # Base probabilities
    win0  = 1 / (1 + np.exp(-10 * diff))  # sigmoid
    win1  = 1 - win0

    # Draw probability — higher when teams are close
    draw  = max(0, 0.3 - abs(diff) * 2)

    # Normalize so all three sum to 1
    total = win0 + win1 + draw
    win0  = round(win0 / total * 100, 1)
    win1  = round(win1 / total * 100, 1)
    draw  = round(draw / total * 100, 1)

    return win0, draw, win1, strength



def Match_Outcome():
    tracking_df    = pd.read_csv('Math_Data_CSV/1_tracking.csv')
    goal_prob_df   = pd.read_csv('Math_Data_CSV/4_goal_predictions.csv')
    movement_df    = pd.read_csv('Math_Data_CSV/2_Movement_Features.csv')

    #Possession
    ball_df    = tracking_df[tracking_df['role'] == 'ball'][['frame','x','y']].rename(columns={'x':'ball_x','y':'ball_y'})
    players_df = tracking_df[tracking_df['role'].isin(['player','goalkeeper'])].copy()

    # Merge ball position into player data
    merged = players_df.merge(ball_df, on='frame', how='inner')

    # Calculate each player's distance to ball
    merged['dist_to_ball'] = np.sqrt(
        (merged['x'] - merged['ball_x'])**2 +
        (merged['y'] - merged['ball_y'])**2
    )

    # For each frame find the player closest to ball
    closest = merged.loc[merged.groupby('frame')['dist_to_ball'].idxmin()]

    # Count frames each team was closest to ball
    possession_counts = closest['team_id'].value_counts()
    total             = possession_counts.sum()

    possession = {
        0: round(possession_counts.get(0, 0) / total * 100, 1),
        1: round(possession_counts.get(1, 0) / total * 100, 1)
    }


    #Shots
    SHOT_THRESHOLD = 0.65

    shots_df = goal_prob_df[goal_prob_df['goal_probability'] >= SHOT_THRESHOLD].copy()

    # Count shots per team
    shots = {
        0: len(shots_df[shots_df['team_id'] == 0]),
        1: len(shots_df[shots_df['team_id'] == 1])
    }

    # Also get average danger level per team
    avg_danger = {
        0: round(goal_prob_df[goal_prob_df['team_id'] == 0]['goal_probability'].mean(), 3),
        1: round(goal_prob_df[goal_prob_df['team_id'] == 1]['goal_probability'].mean(), 3)
    }


    #Territory Control
    PITCH_X_MIN = 1405.4
    PITCH_X_MAX = 11780.6
    REAL_LENGTH  = 105

    players_pitch = tracking_df[
        tracking_df['role'].isin(['player','goalkeeper'])
    ].dropna(subset=['pitch_x']).copy()

    # Normalize pitch_x to meters
    players_pitch['pitch_x_m'] = (
        (players_pitch['pitch_x'] - PITCH_X_MIN) /
        (PITCH_X_MAX - PITCH_X_MIN)
    ) * REAL_LENGTH

    # Territory = fraction of frames spent in attacking half
    # Team 0 attacks right half (>52.5m)
    # Team 1 attacks left half (<52.5m)
    # Note: if teams are reversed just swap, it still shows dominance

    team0 = players_pitch[players_pitch['team_id'] == 0]
    team1 = players_pitch[players_pitch['team_id'] == 1]

    territory = {
        0: round((team0['pitch_x_m'] > 52.5).mean() * 100, 1),
        1: round((team1['pitch_x_m'] < 52.5).mean() * 100, 1)
    }

    #Momentum
    total_frames  = movement_df['frame'].max()
    recent_cutoff = int(total_frames * 0.8)

    # movement_df already has team_id — no merge needed
    recent_movement = movement_df[
        (movement_df['frame'] >= recent_cutoff) &
        (movement_df['team_id'] >= 0)
    ].copy()

    recent_speed = recent_movement.groupby('team_id')['speed'].mean()
    total_recent = recent_speed.sum()

    momentum = {
        0: round(recent_speed.get(0, 0) / total_recent * 100, 1) if total_recent > 0 else 50,
        1: round(recent_speed.get(1, 0) / total_recent * 100, 1) if total_recent > 0 else 50
    }

    #Match Outcome Prob
    win0, draw, win1, strength = calculate_match_outcome(
    possession, shots, territory, momentum, avg_danger
    )

    #Save
    match_outcome = {
        'possession_team0':  possession[0],
        'possession_team1':  possession[1],
        'shots_team0':       shots[0],
        'shots_team1':       shots[1],
        'avg_danger_team0':  avg_danger[0],
        'avg_danger_team1':  avg_danger[1],
        'territory_team0':   territory[0],
        'territory_team1':   territory[1],
        'momentum_team0':    momentum[0],
        'momentum_team1':    momentum[1],
        'win_prob_team0':    win0,
        'draw_prob':         draw,
        'win_prob_team1':    win1
    }

    outcome_df = pd.DataFrame([match_outcome])
    outcome_df.to_csv('Math_Data_CSV/1_match_predictions.csv', index=False)









    
    return 
