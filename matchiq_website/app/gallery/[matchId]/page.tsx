import type { Metadata } from "next";
import MatchResultsClient from "./MatchResultsClient";

export const metadata: Metadata = {
  title: "Match Analysis — MatchIQ",
  description: "View tracked video and analytics for a saved match.",
};

export default async function MatchResultsPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <MatchResultsClient matchId={matchId} />;
}
