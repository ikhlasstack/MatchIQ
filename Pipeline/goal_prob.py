import pandas as pd
import numpy as np

PITCH_X_MIN = 1405.4
PITCH_X_MAX = 11780.6
PITCH_Y_MIN = 46.9
PITCH_Y_MAX = 7082.8
REAL_LENGTH = 105
REAL_WIDTH = 68
GOAL_LEFT = np.array([0, REAL_WIDTH / 2])
GOAL_RIGHT = np.array([REAL_LENGTH, REAL_WIDTH / 2])


def normalize_pitch_coordinates(pitch_x, pitch_y):
    if pitch_x is None or pitch_y is None:
        return None, None

    pitch_x = float(pitch_x)
    pitch_y = float(pitch_y)

    if 0 <= pitch_x <= REAL_LENGTH and 0 <= pitch_y <= REAL_WIDTH:
        return pitch_x, pitch_y

    normalized_x = ((pitch_x - PITCH_X_MIN) / (PITCH_X_MAX - PITCH_X_MIN)) * REAL_LENGTH
    normalized_y = ((pitch_y - PITCH_Y_MIN) / (PITCH_Y_MAX - PITCH_Y_MIN)) * REAL_WIDTH
    normalized_x = float(np.clip(normalized_x, 0, REAL_LENGTH))
    normalized_y = float(np.clip(normalized_y, 0, REAL_WIDTH))
    return normalized_x, normalized_y

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


def get_frame_goal_probabilities(detections, movement_by_player):
    players = []
    for det in detections:
        if det.get('role') != 'player':
            continue

        pitch_x_m, pitch_y_m = normalize_pitch_coordinates(det.get('pitch_x'), det.get('pitch_y'))
        if pitch_x_m is None or pitch_y_m is None:
            continue

        enriched = dict(det)
        enriched['pitch_x_m'] = pitch_x_m
        enriched['pitch_y_m'] = pitch_y_m
        players.append(enriched)

    goal_probabilities = {}
    for player in players:
        player_id = player['player_id']
        movement = movement_by_player.get(player_id, {})
        speed = float(movement.get('speed', 0.0))

        opponent_distances = []
        for opponent in players:
            if opponent['player_id'] == player_id:
                continue
            if opponent.get('team_id') == player.get('team_id'):
                continue
            opponent_distances.append(
                float(np.hypot(
                    opponent['pitch_x_m'] - player['pitch_x_m'],
                    opponent['pitch_y_m'] - player['pitch_y_m'],
                ))
            )

        defender_distance = min(opponent_distances) if opponent_distances else 999.0
        distance_to_goal = distance_to_nearest_goal(player['pitch_x_m'], player['pitch_y_m'], GOAL_LEFT, GOAL_RIGHT)
        angle = angle_to_goal(player['pitch_x_m'], player['pitch_y_m'])
        probability = calculate_goal_probability(distance_to_goal, angle, speed, defender_distance)

        goal_probabilities[player_id] = {
            'player_id': player_id,
            'team_id': player.get('team_id'),
            'distance_to_goal': round(float(distance_to_goal), 3),
            'angle_to_goal': round(float(angle), 3),
            'speed': round(speed, 3),
            'defender_distance': round(float(defender_distance), 3),
            'goal_probability': probability,
        }

    return goal_probabilities



def goal_prob(csv_dir='Match_Data_CSV'):
    tracking_df = pd.read_csv(f'{csv_dir}/1_tracking.csv')
    movement_df = pd.read_csv(f'{csv_dir}/1_Movement_Features.csv')


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

    goal_prob_df.to_csv(f'{csv_dir}/1_goal_predictions.csv', index=False)
    
    return 
