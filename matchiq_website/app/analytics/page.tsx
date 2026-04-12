import type { Metadata } from "next";
import AnalyticsClient from "@/components/analytics/AnalyticsClient";

export const metadata: Metadata = {
  title: "Team Analytics — MatchIQ",
  description: "Side-by-side team performance comparison with radar chart, possession timeline and full stats breakdown.",
};

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
