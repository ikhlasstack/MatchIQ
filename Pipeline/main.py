from Player_Track import player_tracking
from Movement_Features import features
from Fatigue import fatigue
from goal_prob import goal_prob
from Match_Outcome import Match_Outcome


def main():
    #Run Pipeline
    
    player_tracking() 
    features()
    fatigue()
    goal_prob()
    Match_Outcome()
    print("Pipeline Completed")


if __name__ == "__main__":
    main()
