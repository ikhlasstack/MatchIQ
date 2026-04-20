/* ─────────────────────────────────────────────────────────────
   MatchIQ Mock Data  –  lib/mockData.ts
   ───────────────────────────────────────────────────────────── */

/* ── Fatigue ── */
export const FATIGUE_DATA = [
  { id: 4,  team: 0, label: "#4  · T0",  score: 85, level: "CRITICAL" },
  { id: 9,  team: 1, label: "#9  · T1",  score: 78, level: "HIGH"     },
  { id: 7,  team: 0, label: "#7  · T0",  score: 72, level: "HIGH"     },
  { id: 11, team: 1, label: "#11 · T1",  score: 68, level: "HIGH"     },
  { id: 3,  team: 0, label: "#3  · T0",  score: 61, level: "HIGH"     },
  { id: 6,  team: 1, label: "#6  · T1",  score: 54, level: "MODERATE" },
  { id: 10, team: 0, label: "#10 · T0",  score: 49, level: "MODERATE" },
  { id: 2,  team: 1, label: "#2  · T1",  score: 43, level: "MODERATE" },
  { id: 5,  team: 0, label: "#5  · T0",  score: 34, level: "LOW"      },
  { id: 8,  team: 1, label: "#8  · T1",  score: 27, level: "LOW"      },
  { id: 1,  team: 0, label: "#1  · T0",  score: 19, level: "LOW"      },
];

export function fatigueColor(level: string) {
  if (level === "CRITICAL") return "#ef4444";
  if (level === "HIGH")     return "#f97316";
  if (level === "MODERATE") return "#eab308";
  return "#22c55e";
}

/* ── Goal Probability (per frame) ── */
export const GOAL_PROB_DATA = [
  { frame: 0,   t0: 0.10, t1: 0.08 }, { frame: 10,  t0: 0.22, t1: 0.09 },
  { frame: 20,  t0: 0.31, t1: 0.07 }, { frame: 30,  t0: 0.18, t1: 0.25 },
  { frame: 40,  t0: 0.12, t1: 0.41 }, { frame: 50,  t0: 0.09, t1: 0.28 },
  { frame: 60,  t0: 0.35, t1: 0.13 }, { frame: 70,  t0: 0.58, t1: 0.11 },
  { frame: 80,  t0: 0.73, t1: 0.09 }, { frame: 90,  t0: 0.44, t1: 0.18 },
  { frame: 100, t0: 0.26, t1: 0.33 }, { frame: 110, t0: 0.15, t1: 0.52 },
  { frame: 120, t0: 0.19, t1: 0.67 }, { frame: 130, t0: 0.28, t1: 0.44 },
  { frame: 140, t0: 0.48, t1: 0.22 }, { frame: 150, t0: 0.62, t1: 0.17 },
  { frame: 160, t0: 0.39, t1: 0.31 }, { frame: 170, t0: 0.21, t1: 0.48 },
  { frame: 180, t0: 0.14, t1: 0.61 }, { frame: 190, t0: 0.17, t1: 0.38 },
  { frame: 200, t0: 0.33, t1: 0.20 },
];

/* ── Match Outcome ── */
export const MATCH_OUTCOME = {
  winA: 62, draw: 23, winB: 15,
  possession: { t0: 58, t1: 42 },
  shots:      { t0: 9,  t1: 5  },
  territory:  { t0: 55, t1: 45 },
  momentum:   { t0: 63, t1: 37 },
};

/* ── Pitch Players ── */
export const PITCH_PLAYERS = [
  { id: 1,  team: 0, role: "goalkeeper", x: 7,  y: 50 },
  { id: 2,  team: 0, role: "defender",   x: 22, y: 25 },
  { id: 3,  team: 0, role: "defender",   x: 25, y: 42 },
  { id: 4,  team: 0, role: "defender",   x: 25, y: 58 },
  { id: 5,  team: 0, role: "defender",   x: 22, y: 75 },
  { id: 6,  team: 0, role: "midfielder", x: 42, y: 20 },
  { id: 7,  team: 0, role: "midfielder", x: 44, y: 40 },
  { id: 8,  team: 0, role: "midfielder", x: 44, y: 60 },
  { id: 9,  team: 0, role: "midfielder", x: 42, y: 78 },
  { id: 10, team: 0, role: "forward",    x: 62, y: 35 },
  { id: 11, team: 0, role: "forward",    x: 65, y: 62 },
  { id: 12, team: 1, role: "goalkeeper", x: 93, y: 50 },
  { id: 13, team: 1, role: "defender",   x: 78, y: 25 },
  { id: 14, team: 1, role: "defender",   x: 75, y: 42 },
  { id: 15, team: 1, role: "defender",   x: 75, y: 58 },
  { id: 16, team: 1, role: "defender",   x: 78, y: 75 },
  { id: 17, team: 1, role: "midfielder", x: 60, y: 20 },
  { id: 18, team: 1, role: "midfielder", x: 57, y: 48 },
  { id: 19, team: 1, role: "midfielder", x: 60, y: 78 },
  { id: 20, team: 1, role: "forward",    x: 45, y: 30 },
  { id: 21, team: 1, role: "forward",    x: 42, y: 52 },
  { id: 22, team: 1, role: "forward",    x: 45, y: 70 },
  { id: 99, team: -1, role: "ball",      x: 55, y: 43 },
];

/* ── Gallery Matches ── */
export const GALLERY_MATCHES = [
  { id: 1, name: "Match_001.mp4", date: "2026-04-01", duration: "92:14", players: 22, frames: 138210 },
  { id: 2, name: "Match_002.mp4", date: "2026-04-02", duration: "88:47", players: 22, frames: 133050 },
  { id: 3, name: "Match_003.mp4", date: "2026-04-04", duration: "95:30", players: 20, frames: 143250 },
  { id: 4, name: "Match_004.mp4", date: "2026-04-05", duration: "90:00", players: 22, frames: 135000 },
  { id: 5, name: "Match_005.mp4", date: "2026-04-06", duration: "91:22", players: 21, frames: 137130 },
  { id: 6, name: "Match_006.mp4", date: "2026-04-07", duration: "89:55", players: 22, frames: 134925 },
  { id: 7, name: "Match_007.mp4", date: "2026-04-08", duration: "93:10", players: 22, frames: 139750 },
  { id: 8, name: "Match_008.mp4", date: "2026-04-09", duration: "87:44", players: 20, frames: 131600 },
  { id: 9, name: "Match_009.mp4", date: "2026-04-10", duration: "94:05", players: 22, frames: 141125 },
];

/* ── Player Dashboard ── */
export const PLAYERS_DASHBOARD = [
  { id: 4,  team: 0, avgSpeed: 6.8, maxSpeed: 10.4, sprints: 14, fatigue: 85, fatigueLevel: "CRITICAL" },
  { id: 7,  team: 0, avgSpeed: 6.1, maxSpeed:  9.7, sprints: 12, fatigue: 72, fatigueLevel: "HIGH"     },
  { id: 10, team: 0, avgSpeed: 5.4, maxSpeed:  8.9, sprints:  9, fatigue: 49, fatigueLevel: "MODERATE" },
  { id: 3,  team: 0, avgSpeed: 5.0, maxSpeed:  8.2, sprints:  7, fatigue: 61, fatigueLevel: "HIGH"     },
  { id: 5,  team: 0, avgSpeed: 4.8, maxSpeed:  7.6, sprints:  5, fatigue: 34, fatigueLevel: "LOW"      },
  { id: 1,  team: 0, avgSpeed: 2.1, maxSpeed:  5.3, sprints:  1, fatigue: 19, fatigueLevel: "LOW"      },
  { id: 9,  team: 1, avgSpeed: 7.1, maxSpeed: 11.0, sprints: 16, fatigue: 78, fatigueLevel: "HIGH"     },
  { id: 11, team: 1, avgSpeed: 6.4, maxSpeed: 10.1, sprints: 13, fatigue: 68, fatigueLevel: "HIGH"     },
  { id: 6,  team: 1, avgSpeed: 5.5, maxSpeed:  8.8, sprints:  8, fatigue: 54, fatigueLevel: "MODERATE" },
  { id: 2,  team: 1, avgSpeed: 5.1, maxSpeed:  8.0, sprints:  6, fatigue: 43, fatigueLevel: "MODERATE" },
  { id: 8,  team: 1, avgSpeed: 4.5, maxSpeed:  7.2, sprints:  4, fatigue: 27, fatigueLevel: "LOW"      },
];

/* ── Player time-series ── */
const spd = (base: number, peaks: [number, number][]): { frame: number; speed: number; accel: number }[] =>
  Array.from({ length: 21 }, (_, i) => {
    const frame = i * 10;
    let s = base + (peaks.find(([f]) => Math.abs(f - frame) < 15)?.[1] ?? 0) * Math.sin((frame / 10) * 0.8 + base);
    s = Math.max(0.5, Math.min(12, s + Math.sin(i * 1.3 + base) * 0.5));
    return { frame, speed: parseFloat(s.toFixed(2)), accel: parseFloat(((s - base) * 0.6).toFixed(2)) };
  });

export const PLAYER_SERIES: Record<number, { frame: number; speed: number; accel: number }[]> = {
  1:  spd(2.0, [[60, 1]]),
  2:  spd(5.1, [[40, 2.5], [140, 3]]),
  3:  spd(5.0, [[70, 3], [130, 2.5]]),
  4:  spd(6.8, [[50, 4], [80, 5], [150, 3.5]]),
  5:  spd(4.8, [[90, 2.5], [160, 2]]),
  6:  spd(5.5, [[30, 3], [110, 3.5]]),
  7:  spd(6.1, [[40, 3.5], [100, 4.5]]),
  8:  spd(4.5, [[70, 2], [150, 2.5]]),
  9:  spd(7.1, [[20, 5], [80, 6], [160, 4]]),
  10: spd(5.4, [[60, 3], [130, 3]]),
  11: spd(6.4, [[50, 4], [120, 5]]),
};

export const PLAYER_SPRINT_ZONES: Record<number, { zone: string; sprints: number }[]> = {
  4:  [{ zone: "0–20", sprints: 2 }, { zone: "20–40", sprints: 3 }, { zone: "40–60", sprints: 4 }, { zone: "60–80", sprints: 2 }, { zone: "80–100", sprints: 1 }, { zone: "100–120", sprints: 2 }],
  7:  [{ zone: "0–20", sprints: 1 }, { zone: "20–40", sprints: 2 }, { zone: "40–60", sprints: 3 }, { zone: "60–80", sprints: 3 }, { zone: "80–100", sprints: 2 }, { zone: "100–120", sprints: 1 }],
  9:  [{ zone: "0–20", sprints: 3 }, { zone: "20–40", sprints: 4 }, { zone: "40–60", sprints: 3 }, { zone: "60–80", sprints: 2 }, { zone: "80–100", sprints: 3 }, { zone: "100–120", sprints: 1 }],
  11: [{ zone: "0–20", sprints: 1 }, { zone: "20–40", sprints: 2 }, { zone: "40–60", sprints: 2 }, { zone: "60–80", sprints: 3 }, { zone: "80–100", sprints: 2 }, { zone: "100–120", sprints: 3 }],
  3:  [{ zone: "0–20", sprints: 1 }, { zone: "20–40", sprints: 2 }, { zone: "40–60", sprints: 1 }, { zone: "60–80", sprints: 2 }, { zone: "80–100", sprints: 1 }, { zone: "100–120", sprints: 0 }],
  6:  [{ zone: "0–20", sprints: 1 }, { zone: "20–40", sprints: 1 }, { zone: "40–60", sprints: 2 }, { zone: "60–80", sprints: 2 }, { zone: "80–100", sprints: 1 }, { zone: "100–120", sprints: 1 }],
  10: [{ zone: "0–20", sprints: 1 }, { zone: "20–40", sprints: 1 }, { zone: "40–60", sprints: 2 }, { zone: "60–80", sprints: 2 }, { zone: "80–100", sprints: 2 }, { zone: "100–120", sprints: 1 }],
  2:  [{ zone: "0–20", sprints: 0 }, { zone: "20–40", sprints: 1 }, { zone: "40–60", sprints: 2 }, { zone: "60–80", sprints: 2 }, { zone: "80–100", sprints: 1 }, { zone: "100–120", sprints: 0 }],
  5:  [{ zone: "0–20", sprints: 1 }, { zone: "20–40", sprints: 1 }, { zone: "40–60", sprints: 1 }, { zone: "60–80", sprints: 1 }, { zone: "80–100", sprints: 1 }, { zone: "100–120", sprints: 0 }],
  8:  [{ zone: "0–20", sprints: 0 }, { zone: "20–40", sprints: 1 }, { zone: "40–60", sprints: 1 }, { zone: "60–80", sprints: 1 }, { zone: "80–100", sprints: 1 }, { zone: "100–120", sprints: 0 }],
  1:  [{ zone: "0–20", sprints: 0 }, { zone: "20–40", sprints: 0 }, { zone: "40–60", sprints: 1 }, { zone: "60–80", sprints: 0 }, { zone: "80–100", sprints: 0 }, { zone: "100–120", sprints: 0 }],
};

export const MATCHES_LIST = [
  "Match_001 — Apr 01", "Match_002 — Apr 02", "Match_003 — Apr 04",
  "Match_004 — Apr 05", "Match_005 — Apr 06",
];

/* ── Team Analytics ── */
export const TEAM_RADAR = [
  { metric: "Possession", t0: 82, t1: 58 },
  { metric: "Shots",      t0: 75, t1: 55 },
  { metric: "Intensity",  t0: 62, t1: 74 },
  { metric: "Territory",  t0: 78, t1: 60 },
  { metric: "Momentum",   t0: 80, t1: 55 },
  { metric: "Pass Acc.",  t0: 88, t1: 72 },
];

export const TEAM_STATS_FULL = {
  t0: { possession: 58, shots: 9, shotsOnTarget: 5, avgFatigue: 53,
        territory: 55, momentum: 63, passes: 412, passAcc: 88, fouls: 7,  corners: 5, offsides: 2 },
  t1: { possession: 42, shots: 5, shotsOnTarget: 2, avgFatigue: 54,
        territory: 45, momentum: 37, passes: 298, passAcc: 72, fouls: 11, corners: 3, offsides: 4 },
};

export const POSSESSION_TIMELINE = [
  { minute:  0, t0: 52, t1: 48 }, { minute:  5, t0: 55, t1: 45 },
  { minute: 10, t0: 48, t1: 52 }, { minute: 15, t0: 44, t1: 56 },
  { minute: 20, t0: 51, t1: 49 }, { minute: 25, t0: 60, t1: 40 },
  { minute: 30, t0: 65, t1: 35 }, { minute: 35, t0: 62, t1: 38 },
  { minute: 40, t0: 58, t1: 42 }, { minute: 45, t0: 54, t1: 46 },
  { minute: 50, t0: 49, t1: 51 }, { minute: 55, t0: 45, t1: 55 },
  { minute: 60, t0: 50, t1: 50 }, { minute: 65, t0: 57, t1: 43 },
  { minute: 70, t0: 63, t1: 37 }, { minute: 75, t0: 61, t1: 39 },
  { minute: 80, t0: 58, t1: 42 }, { minute: 85, t0: 55, t1: 45 },
  { minute: 90, t0: 52, t1: 48 },
];

export const MOMENTUM_TIMELINE = [
  { minute:  0, t0: 50, t1: 50 }, { minute:  5, t0: 55, t1: 45 },
  { minute: 10, t0: 58, t1: 42 }, { minute: 15, t0: 45, t1: 55 },
  { minute: 20, t0: 40, t1: 60 }, { minute: 25, t0: 52, t1: 48 },
  { minute: 30, t0: 68, t1: 32 }, { minute: 35, t0: 72, t1: 28 },
  { minute: 40, t0: 65, t1: 35 }, { minute: 45, t0: 58, t1: 42 },
  { minute: 50, t0: 43, t1: 57 }, { minute: 55, t0: 38, t1: 62 },
  { minute: 60, t0: 50, t1: 50 }, { minute: 65, t0: 60, t1: 40 },
  { minute: 70, t0: 70, t1: 30 }, { minute: 75, t0: 68, t1: 32 },
  { minute: 80, t0: 63, t1: 37 }, { minute: 85, t0: 60, t1: 40 },
  { minute: 90, t0: 55, t1: 45 },
];

/* ── Team Performance Across Matches (Compare page v2) ── */
export const COMPARE_TEAM_MATCHES = [
  {
    id: "Match_001",
    label: "Match_001 — Apr 01",
    teams: [
      { id: 0, label: "Team 1 (Blue)", players: 11, frames: 750 },
      { id: 1, label: "Team 2 (Pink)", players: 11, frames: 750 },
    ],
  },
  {
    id: "Match_002",
    label: "Match_002 — Apr 02",
    teams: [
      { id: 0, label: "Team 1 (Blue)", players: 11, frames: 820 },
      { id: 1, label: "Team 2 (Pink)", players: 11, frames: 820 },
    ],
  },
  {
    id: "Match_003",
    label: "Match_003 — Apr 04",
    teams: [
      { id: 0, label: "Team 1 (Blue)", players: 11, frames: 700 },
      { id: 1, label: "Team 2 (Pink)", players: 10, frames: 700 },
    ],
  },
  {
    id: "Match_004",
    label: "Match_004 — Apr 05",
    teams: [
      { id: 0, label: "Team 1 (Blue)", players: 11, frames: 810 },
      { id: 1, label: "Team 2 (Pink)", players: 11, frames: 810 },
    ],
  },
  {
    id: "Match_005",
    label: "Match_005 — Apr 06",
    teams: [
      { id: 0, label: "Team 1 (Blue)", players: 11, frames: 790 },
      { id: 1, label: "Team 2 (Pink)", players: 11, frames: 790 },
    ],
  },
];

export type TeamStats = {
  possession: number;
  shots: number;
  territory: number;
  momentum: number;
  avg_goal_prob: number;
  avg_speed: number;
  total_sprints: number;
  avg_fatigue: number;
  player_fatigue: Record<number, number>;
  speed_timeline: number[];
  goal_prob_timeline: number[];
};

export const TEAM_MATCH_STATS: Record<string, Record<number, TeamStats>> = {
  Match_001: {
    0: {
      possession: 58, shots: 9, territory: 55, momentum: 63,
      avg_goal_prob: 0.31, avg_speed: 67, total_sprints: 234, avg_fatigue: 0.42,
      player_fatigue: { 1: 0.32, 3: 0.57, 6: 0.49, 7: 0.61, 9: 0.28, 11: 0.48, 14: 0.47 },
      speed_timeline: [45, 52, 61, 70, 68, 74, 71, 65, 58, 50],
      goal_prob_timeline: [0.18, 0.22, 0.31, 0.45, 0.38, 0.29, 0.41, 0.35, 0.28, 0.22],
    },
    1: {
      possession: 42, shots: 5, territory: 45, momentum: 37,
      avg_goal_prob: 0.19, avg_speed: 61, total_sprints: 198, avg_fatigue: 0.54,
      player_fatigue: { 1: 0.45, 3: 0.62, 6: 0.38, 7: 0.71, 9: 0.55, 11: 0.41, 14: 0.60 },
      speed_timeline: [42, 49, 57, 63, 59, 66, 62, 58, 53, 46],
      goal_prob_timeline: [0.12, 0.16, 0.21, 0.33, 0.28, 0.20, 0.31, 0.25, 0.19, 0.14],
    },
  },
  Match_002: {
    0: {
      possession: 43, shots: 4, territory: 38, momentum: 40,
      avg_goal_prob: 0.22, avg_speed: 54, total_sprints: 167, avg_fatigue: 0.61,
      player_fatigue: { 1: 0.61, 3: 0.72, 6: 0.55, 7: 0.48, 9: 0.39, 11: 0.58, 14: 0.63 },
      speed_timeline: [41, 48, 53, 58, 55, 51, 47, 44, 40, 38],
      goal_prob_timeline: [0.14, 0.19, 0.24, 0.31, 0.27, 0.22, 0.28, 0.25, 0.19, 0.16],
    },
    1: {
      possession: 57, shots: 8, territory: 62, momentum: 60,
      avg_goal_prob: 0.34, avg_speed: 71, total_sprints: 248, avg_fatigue: 0.38,
      player_fatigue: { 1: 0.29, 3: 0.41, 6: 0.52, 7: 0.35, 9: 0.44, 11: 0.31, 14: 0.39 },
      speed_timeline: [50, 58, 66, 74, 70, 77, 73, 68, 62, 55],
      goal_prob_timeline: [0.22, 0.28, 0.37, 0.50, 0.43, 0.35, 0.46, 0.40, 0.33, 0.26],
    },
  },
  Match_003: {
    0: {
      possession: 61, shots: 11, territory: 60, momentum: 72,
      avg_goal_prob: 0.38, avg_speed: 72, total_sprints: 261, avg_fatigue: 0.38,
      player_fatigue: { 1: 0.25, 3: 0.44, 6: 0.41, 7: 0.52, 9: 0.30, 11: 0.38, 14: 0.42 },
      speed_timeline: [50, 59, 68, 76, 73, 80, 77, 70, 64, 56],
      goal_prob_timeline: [0.22, 0.30, 0.40, 0.54, 0.46, 0.37, 0.50, 0.43, 0.34, 0.27],
    },
    1: {
      possession: 39, shots: 3, territory: 40, momentum: 28,
      avg_goal_prob: 0.14, avg_speed: 49, total_sprints: 142, avg_fatigue: 0.72,
      player_fatigue: { 1: 0.70, 3: 0.80, 6: 0.65, 7: 0.58, 9: 0.75, 11: 0.68, 14: 0.74 },
      speed_timeline: [38, 44, 49, 53, 50, 46, 43, 40, 36, 33],
      goal_prob_timeline: [0.10, 0.14, 0.18, 0.24, 0.20, 0.16, 0.21, 0.18, 0.13, 0.11],
    },
  },
  Match_004: {
    0: {
      possession: 50, shots: 6, territory: 50, momentum: 51,
      avg_goal_prob: 0.26, avg_speed: 62, total_sprints: 201, avg_fatigue: 0.50,
      player_fatigue: { 1: 0.40, 3: 0.58, 6: 0.47, 7: 0.55, 9: 0.43, 11: 0.50, 14: 0.52 },
      speed_timeline: [44, 51, 59, 66, 63, 68, 65, 61, 56, 49],
      goal_prob_timeline: [0.16, 0.21, 0.28, 0.38, 0.33, 0.26, 0.35, 0.30, 0.24, 0.19],
    },
    1: {
      possession: 50, shots: 6, territory: 50, momentum: 49,
      avg_goal_prob: 0.25, avg_speed: 61, total_sprints: 199, avg_fatigue: 0.51,
      player_fatigue: { 1: 0.41, 3: 0.57, 6: 0.48, 7: 0.54, 9: 0.44, 11: 0.49, 14: 0.53 },
      speed_timeline: [43, 50, 58, 65, 62, 67, 64, 60, 55, 48],
      goal_prob_timeline: [0.15, 0.20, 0.27, 0.37, 0.32, 0.25, 0.34, 0.29, 0.23, 0.18],
    },
  },
  Match_005: {
    0: {
      possession: 54, shots: 7, territory: 52, momentum: 58,
      avg_goal_prob: 0.28, avg_speed: 65, total_sprints: 218, avg_fatigue: 0.46,
      player_fatigue: { 1: 0.36, 3: 0.52, 6: 0.44, 7: 0.57, 9: 0.34, 11: 0.45, 14: 0.48 },
      speed_timeline: [44, 52, 60, 69, 66, 72, 69, 63, 57, 50],
      goal_prob_timeline: [0.17, 0.22, 0.30, 0.42, 0.36, 0.28, 0.39, 0.33, 0.26, 0.21],
    },
    1: {
      possession: 46, shots: 5, territory: 48, momentum: 42,
      avg_goal_prob: 0.21, avg_speed: 59, total_sprints: 184, avg_fatigue: 0.56,
      player_fatigue: { 1: 0.48, 3: 0.64, 6: 0.42, 7: 0.65, 9: 0.51, 11: 0.44, 14: 0.58 },
      speed_timeline: [41, 47, 55, 62, 58, 63, 60, 56, 51, 44],
      goal_prob_timeline: [0.13, 0.18, 0.24, 0.34, 0.29, 0.22, 0.31, 0.26, 0.20, 0.15],
    },
  },
};

/* ── Match Comparison data ── */
export const COMPARE_MATCHES = [
  {
    id: 1, name: "Match_001 — Apr 01",
    possession: { t0: 58, t1: 42 }, shots: { t0: 9, t1: 5 }, territory: { t0: 55, t1: 45 },
    momentum: { t0: 63, t1: 37 }, avgFatigue: { t0: 53, t1: 54 }, passAcc: { t0: 88, t1: 72 },
    fatigueSeries: [
      { minute: 0, t0: 20, t1: 18 }, { minute: 15, t0: 32, t1: 30 }, { minute: 30, t0: 45, t1: 42 },
      { minute: 45, t0: 53, t1: 51 }, { minute: 60, t0: 62, t1: 60 }, { minute: 75, t0: 70, t1: 68 },
      { minute: 90, t0: 78, t1: 76 },
    ],
  },
  {
    id: 2, name: "Match_002 — Apr 02",
    possession: { t0: 44, t1: 56 }, shots: { t0: 4, t1: 7 }, territory: { t0: 41, t1: 59 },
    momentum: { t0: 40, t1: 60 }, avgFatigue: { t0: 67, t1: 58 }, passAcc: { t0: 74, t1: 81 },
    fatigueSeries: [
      { minute: 0, t0: 22, t1: 19 }, { minute: 15, t0: 35, t1: 28 }, { minute: 30, t0: 50, t1: 40 },
      { minute: 45, t0: 60, t1: 49 }, { minute: 60, t0: 70, t1: 57 }, { minute: 75, t0: 78, t1: 64 },
      { minute: 90, t0: 85, t1: 71 },
    ],
  },
  {
    id: 3, name: "Match_003 — Apr 04",
    possession: { t0: 61, t1: 39 }, shots: { t0: 11, t1: 3 }, territory: { t0: 60, t1: 40 },
    momentum: { t0: 72, t1: 28 }, avgFatigue: { t0: 48, t1: 62 }, passAcc: { t0: 91, t1: 69 },
    fatigueSeries: [
      { minute: 0, t0: 15, t1: 20 }, { minute: 15, t0: 28, t1: 33 }, { minute: 30, t0: 38, t1: 45 },
      { minute: 45, t0: 46, t1: 54 }, { minute: 60, t0: 55, t1: 63 }, { minute: 75, t0: 62, t1: 71 },
      { minute: 90, t0: 70, t1: 80 },
    ],
  },
  {
    id: 4, name: "Match_004 — Apr 05",
    possession: { t0: 50, t1: 50 }, shots: { t0: 6, t1: 6 }, territory: { t0: 50, t1: 50 },
    momentum: { t0: 51, t1: 49 }, avgFatigue: { t0: 58, t1: 59 }, passAcc: { t0: 80, t1: 79 },
    fatigueSeries: [
      { minute: 0, t0: 18, t1: 17 }, { minute: 15, t0: 30, t1: 29 }, { minute: 30, t0: 42, t1: 41 },
      { minute: 45, t0: 52, t1: 51 }, { minute: 60, t0: 61, t1: 60 }, { minute: 75, t0: 69, t1: 68 },
      { minute: 90, t0: 76, t1: 75 },
    ],
  },
];
