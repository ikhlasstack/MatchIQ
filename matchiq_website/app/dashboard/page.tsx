import type { Metadata } from "next";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Player Dashboard — MatchIQ",
  description: "Individual player performance analytics — speed, fatigue, sprints and acceleration charts.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
