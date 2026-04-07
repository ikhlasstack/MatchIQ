import pandas as pd
import numpy as np

def distance_to_nearest_goal(pitch_x, pitch_y,GOAL_LEFT,GOAL_RIGHT):
    """
    Calculate distance from player to the nearest goal center.
    We use nearest goal because we don't know which direction
    each team is attacking without more context.
    """
    pos = np.array([pitch_x, pitch_y])
    dist_left  = np.linalg.norm(pos - GOAL_LEFT)
    dist_right = np.linalg.norm(pos - GOAL_RIGHT)
    return min(dist_left, dist_right)

def angle_to_goal(pitch_x, pitch_y):
    """
    Calculate shooting angle to nearest goal.
    Better angle = more central position = higher probability.
    Angle of 90 degrees = directly in front of goal (best).
    Angle near 0 = very tight angle from the side (worst).
    """
    pos = np.array([pitch_x, pitch_y])

    # Goal posts positions
    # Each goal is 7.32m wide, centered on pitch width (34m)
    goal_post_1_left  = np.array([0,   34 - 3.66])
    goal_post_2_left  = np.array([0,   34 + 3.66])
    goal_post_1_right = np.array([105, 34 - 3.66])
    goal_post_2_right = np.array([105, 34 + 3.66])

    def calc_angle(post1, post2, position):
        vec1 = post1 - position
        vec2 = post2 - position
        cos_angle = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2) + 1e-6)
        cos_angle = np.clip(cos_angle, -1, 1)
        return np.degrees(np.arccos(cos_angle))

    angle_left  = calc_angle(goal_post_1_left,  goal_post_2_left,  pos)
    angle_right = calc_angle(goal_post_1_right, goal_post_2_right, pos)

    #return max(angle_left, angle_right)
    return min(max(angle_left, angle_right), 90)

def get_defender_distances(df):
    """
    For each player in each frame, find the distance
    to the nearest opponent (different team).
    """
    results = []

    for frame_num, frame_data in df.groupby('frame'):
        player_rows = frame_data[frame_data['role'] == 'player']

        for _, player in player_rows.iterrows():
            # opponents = players on different team
            opponents = player_rows[player_rows['team_id'] != player['team_id']]

            if len(opponents) == 0:
                defender_dist = 999  # no opponents visible
            else:
                player_pos    = np.array([player['pitch_x_m'], player['pitch_y_m']])
                opponent_pos  = opponents[['pitch_x_m', 'pitch_y_m']].values
                distances     = np.linalg.norm(opponent_pos - player_pos, axis=1)
                defender_dist = distances.min()

            results.append({
                'frame':            frame_num,
                'player_id':        player['player_id'],
                'defender_distance': defender_dist
            })

    return pd.DataFrame(results)

def calculate_goal_probability(distance, angle, speed, defender_dist):
    """
    Formula based goal probability.

    Logic:
    - Closer to goal = higher probability
    - Better angle (larger angle value) = higher probability
    - Faster speed = higher probability
    - Further from defender = higher probability

    Each factor is normalized to 0-1 then combined.
    """

    # 1. Distance factor — closer = higher prob
    # Beyond 35m almost no chance, at 0m max chance
    distance_factor = max(0, 1 - (distance / 35))

    # 2. Angle factor — normalize to 0-1
    # Max realistic angle ~45 degrees from good position
    angle_factor = min(angle / 45, 1.0)

    # 3. Speed factor — faster = higher prob, cap at 150 px/sec
    speed_factor = min(speed / 150, 1.0)

    # 4. Defender factor — further from defender = higher prob
    # Beyond 5m defender has little impact
    defender_factor = min(defender_dist / 5, 1.0)

    # Weighted combination
    # Distance and angle matter most
    probability = (
        0.40 * distance_factor  +
        0.30 * angle_factor     +
        0.15 * speed_factor     +
        0.15 * defender_factor
    )

    return round(probability, 3)



def goal_prob():
    tracking_df = pd.read_csv('Math_Data_CSV/1_tracking.csv')
    movement_df = pd.read_csv('Math_Data_CSV/2_Movement_Features.csv')


    # Merge speed into tracking data

    df = tracking_df.merge(
    movement_df[['frame', 'player_id', 'speed']],
    on=['frame', 'player_id'],
    how='left'
    )
    df['speed'] = df['speed'].fillna(0)

    #Define Goal Positions
    PITCH_LENGTH = 105  # meters
    PITCH_WIDTH  = 68   # meters

    GOAL_LEFT  = np.array([0,   PITCH_WIDTH / 2])
    GOAL_RIGHT = np.array([105, PITCH_WIDTH / 2])

    # We only calculate goal probability for actual players
    # not referees, ball, or goalkeepers
    players_df = df[df['role'] == 'player'].copy()
    players_df = players_df.dropna(subset=['pitch_x', 'pitch_y'])

    #Normalize
    # Your pitch coordinate ranges (from debug output)
    PITCH_X_MIN = 1405.4
    PITCH_X_MAX = 11780.6
    PITCH_Y_MIN = 46.9
    PITCH_Y_MAX = 7082.8

    # Real pitch dimensions in meters
    REAL_LENGTH = 105  # meters
    REAL_WIDTH  = 68   # meters

    # Normalize pitch_x and pitch_y to real meters
    players_df['pitch_x_m'] = (
        (players_df['pitch_x'] - PITCH_X_MIN) /
        (PITCH_X_MAX - PITCH_X_MIN)
    ) * REAL_LENGTH

    players_df['pitch_y_m'] = (
        (players_df['pitch_y'] - PITCH_Y_MIN) /
        (PITCH_Y_MAX - PITCH_Y_MIN)
    ) * REAL_WIDTH

    #Distance to Goal
    players_df['distance_to_goal'] = players_df.apply(
    lambda row: distance_to_nearest_goal(row['pitch_x_m'], row['pitch_y_m'], GOAL_LEFT,GOAL_RIGHT),
    axis=1
    )

    #Angle to goal
    players_df['angle_to_goal'] = players_df.apply(
    lambda row: angle_to_goal(row['pitch_x_m'], row['pitch_y_m']),
    axis=1
    )

    #Nearest Defender
    defender_df = get_defender_distances(players_df)
    players_df = players_df.merge(defender_df, on=['frame', 'player_id'], how='left')
    players_df['defender_distance'] = players_df['defender_distance'].fillna(999)

    #Goal Probability
    players_df['goal_probability'] = players_df.apply(
    lambda row: calculate_goal_probability(
            row['distance_to_goal'],
            row['angle_to_goal'],
            row['speed'],
            row['defender_distance']
        ),
        axis=1
    )

    #Top 10 Goal Prob Moments
    top_moments = players_df.nlargest(10, 'goal_probability')[
        ['frame', 'player_id', 'team_id',
        'distance_to_goal', 'angle_to_goal',
        'goal_probability']
    ].round(3)

    #Save
    goal_prob_df = players_df[[
        'frame', 'player_id', 'team_id',
        'distance_to_goal', 'angle_to_goal',
        'speed', 'defender_distance',
        'goal_probability'
    ]].copy()

    goal_prob_df.to_csv('Math_Data_CSV/1_goal_predictions.csv', index=False)
    
    return 
