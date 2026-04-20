# MatchIQ — Complete System Documentation

## 1. Project Overview

**MatchIQ** is an AI-powered football (soccer) match analytics platform. Its goal is to provide lower-league clubs, academies, and grassroots teams with the same high-level insights that professional clubs use, but at a fraction of the cost.

Instead of manual tracking or expensive hardware, MatchIQ takes a single raw match video and uses AI (Computer Vision) to track players and the ball. It automatically calculates advanced metrics such as:
- Player speeds, distances, and fatigue levels
- Real-time goal scoring probabilities
- Match outcome predictions (win, loss, draw chances)

The system is split into two halves:
1. **The Backend Engine (FastAPI in Python):** Does the heavy lifting, running AI models and performing the calculations.
2. **The Web Dashboard (Next.js in React):** A browser interface where the user uploads the video and views beautiful, easy-to-read charts.

---

## 2. Overall System Flow (End-to-End)

Here is a step-by-step look at what happens when a user touches the system:

1. **Video Upload:** The user opens the web dashboard and uploads a raw MP4 or AVI video of a match.
2. **Transfer safely to Backend:** The frontend sends the video to the backend API Server, which saves it as `Testing.mp4`.
3. **Pipeline Activation:** The backend triggers the AI "Pipeline" in a background thread to start crunching the video clip.
4. **Live Preview:** While the AI processes the video frame by frame, it streams a live "preview video" back to the frontend. This lets the user watch the AI draw tracking circles around players in real time.
5. **Result Generation:** The pipeline finishes tracking, calculates all the football stats, and saves them safely into CSV files.
6. **Final Display:** The frontend asks the server if it's done. Once finished, the frontend accesses the data and displays the final tracked video, Pitch Radar, Goal Probabilities, and Fatigue Charts!

---

## 3. Pipeline Breakdown

The "Pipeline" is the brain of MatchIQ. Let's break it down into simple, chronological steps.

### Step 1: Player Tracking Module (`Player_Track.py`)
This is the hardest phase where AI tries to "see" the game.
* **Input:** The raw `Testing.mp4` video.
* **Processing:** 
  1. The code feeds the video into a YOLOv8 AI model which detects where the Goalkeepers, Players, Referees, and Ball are.
  2. Another AI model scans the pitch (grass) lines to understand the "real world" scale (meters) rather than just screen pixels. 
  3. A tracker called `ByteTrack` assigns each player an ID (e.g., Player 1) and follows them frame by frame across the screen.
  4. It crops out player's shirts and assigns them into "Team 0" or "Team 1" based on jersey colors.
* **Output:** 
  1. An intermediate MP4 video where players have colorful rings around them, which is finalized into a browser-friendly `tracked_output.mp4`.
  2. A massive spreadsheet text file called `1_tracking.csv` that logs exactly where every player and the ball is sitting on the field, for every single frame.

### Step 2: Movement Features Module (`Movement_Features.py`)
* **How it works:** It reads `1_tracking.csv`. By comparing a player's position in Frame #1 to Frame #2, it calculates how far they moved. It translates this into **Speed**, **Acceleration**, and triggers a **"Is Sprinting?" flag** if their speed crosses a specific limit. 
* **Output:** Saves a new file called `1_Movement_Features.csv` containing speed and sprint data.

### Step 3: Fatigue Detection Module (`Fatigue.py`)
* **How it calculates fatigue:** For each player, the system looks at their baseline speed and acceleration during the very first portion of the clip (when they are fresh). 
* As the match progresses, the module tracks their "speed drop" and "acceleration drop".
* **Metrics Used:** It weighs Speed Drop (40%), Acceleration Drop (30%), and Sprint Drop (30%).
* **Output:** Generates `1_fatigue_scores.csv` that gives every player a Fatigue Score from 0.0 to 1.0, and flags them as LOW, MEDIUM, or HIGH fatigue.

### Step 4: Goal Probability (`goal_prob.py`) & Match Outcome (`Match_Outcome.py`)
* **Goal Probability:** Uses player coordinates to calculate angle and distance to the goal net. If a player is close, moving fast, and far away from a defender, their "Goal Probability" percentage rises. Output: `1_goal_predictions.csv`.
* **Match Outcome:** It checks which team spends the most time in enemy territory (Territory), who shoots more often (Shots), momentum (late-game speed), and who dominates the ball (Possession). From all this, it predicts the final Win/Loss/Draw percentages. Output: `1_match_predictions.csv`.


### Data Flow Inside the Pipeline
As seen above, the data flows like a waterfall. 
1. The **Video** turns into **Tracking Coordinates (CSV)**.
2. **Coordinates** turn into **Speeds (CSV)**.
3. Both **Coordinates + Speeds** mix together to generate **Fatigue and Goal chances (CSVs)**.

---

## 4. API Server (Backend)

The backend is built in **Python** using the **FastAPI framework**, which makes accepting video clips and returning data very fast and neat. It runs continuously and acts like a bridge between the Frontend and the Pipeline.

### Request Flow
1. **Video Upload:** The Dashboard sends the video file via a `POST /upload` request. The API saves it.
2. **Trigger:** The Dashboard makes a `POST /run` request. The backend spawns a worker thread to start the sequence outlined in Section 3.
3. **Checking Status:** The Dashboard keeps knocking via `GET /status` to ask "Are you done yet?"
4. **Fetching Results:** Finally, once the API finishes, the frontend begins fetching data via endpoints like `GET /results/fatigue`.

### Important Endpoints
* `/upload`: Accepts the video file.
* `/run`: Starts the heavy AI tracking pipeline.
* `/status`: Reports if the pipeline is running, finished, or errored out.
* `/stream/frames`: Delivers the Live Preview video (using MJPEG streaming format) to the user's screen during Phase 1.
* `/results/fatigue` / `/results/goal-prob` / `/results/outcome`: Gives the dashboard arrays of JSON data to plot charts.
* `/video/tracked`: Delivers the finalized tracking video down to the frontend's video player.
* `/download/csv`: Easily downloads all CSV data wrapped cleanly into a ZIP file.

---

## 5. Frontend Integration

The frontend (Web Dashboard) uses **React and Next.js**, meaning it's highly dynamic and changes shapes beautifully without reloading the page.

* **Connection:** The React code connects directly to the backend API via standard web HTTP requests (`fetch` commands inside `DemoClient.tsx`).
* **Triggering Actions:** When you drag a file into the upload box on `/demo`, it immediately sends it to the API and triggers the `run` command.
* **The "Live Preview":** While tracking is happening, the dashboard literally creates an `<img>` tag connected directly to the backend's `/stream/frames`. The backend overrides standard video behavior to inject jpeg images here 25 times a second, mimicking a live video stream.
* **Tab Displays:** Once the API replies "Done!", the frontend unlocks different tabs (Player Fatigue, Goal Probability). It takes the JSON endpoints and renders visuals like bar charts, radar lines, and graphs.

---

## 6. End-to-End Data Flow Map

**START ➜** User drags Match Video (`mp4`) into the Website
**➜** Backend API receives video and saves it to a `Test_Data` Folder
**➜** Pipeline AI reads Video `mp4` frames
**➜** Generates Base Files: `1_tracking.csv` & `tracked_output.mp4`
**➜** Calculations read `1_tracking.csv` and generate `1_Movement_Features.csv`
**➜** Advanced math modules read both CSVs to generate `1_fatigue_scores.csv`, `1_goal_predictions.csv`, and `1_match_predictions.csv`.
**➜** Backend packages all outputs and saves them permanently in a `Saved_Matches` folder.
**➜** Frontend requests JSON interpretations of the CSVs.
**➜** React renders beautiful UI charts for the User. **⬅ END**

---

## 7. Errors, Issues, and Improvements

### Potential Bugs / Weak Points
* **Single Video Bottleneck (Threading Issue):** Currently, the API uses Global Variables to track if the system is running (`_STATUS["running"]`). This means if User A and User B concurrently upload videos, the server will block User B or silently overwrite User A's data because paths are hard-coded (`Test_Data/Testing.mp4`).
* **Live Stream Dropped Frames:** The MJPEG video stream handles 60 frames max in its memory queue. If the browser gets a bit laggy or stuck, these frames are dropped and the user's live preview might stutter.
* **Video Encoding Reliability:** The AI writes raw `mp4v` video, but browsers don't like playing `mp4v`. The system relies on a library called `PyAV` to re-encode it at the end to `H.264`. This is resource-intensive and if it hits a snag, the user's video playback might fail on the web.
* **Memory & Performance:** All these CSV data transformations make use of memory-heavy Pandas dataframes. As videos get longer, doing all of this on a single machine or dropping huge arrays all at once could crash memory.

### Suggestions for Improvement
1. **Dynamic Task IDs:** Whenever a user uploads a video, assign a `Task_ID` (like "job-1042"). Place all videos and CSV outputs strictly inside an ID-based folder instead of `Test_Data/Testing`. This instantly fixes the Single-Video bottleneck.
2. **Real Databases:** Migrate tracking and statistical data outputs away from CSV sheets into an actual database like PostgreSQL or SQLite to make retrieval faster for the website.
3. **Use FFmpeg Process directly:** Instead of doing complex memory PyAV encoding for the H.264 video conversion, just run a quick backend terminal command: `ffmpeg -i mp4v -vcodec libx264 h264.mp4`, which is safer, fails less, and consumes fewer resources.

---

## 8. Summary

**MatchIQ takes extremely complex computer vision tracking logic and distills it into an easy, single-click web application.** 

The user interacts gently with an elegant Next.js frontend, safely separated from the heavy math. Behind the scenes, a powerful FastAPI server orchestrates five complex Python modules (Tracking, Movement, Fatigue, Probability, Match Outcome), running them step-by-step and safely caching the results to disks. It provides incredible pro-level insights while keeping everything streamlined, manageable, and easy to present.
