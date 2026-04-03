import pandas as pd
import numpy as np


def features():
    df = pd.read_csv('tracking.csv')

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
    movement_df.to_csv('movement_features.csv', index=False)

    return 
