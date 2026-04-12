import type { Metadata } from "next";
import CompareClient from "@/components/compare/CompareClient";
export const metadata: Metadata = { title: "Compare — MatchIQ", description: "Compare two processed matches side by side with stats, fatigue and possession charts." };
export default function ComparePage() { return <CompareClient />; }
