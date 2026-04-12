import type { Metadata } from "next";
import DemoClient from "@/components/demo/DemoClient";

export const metadata: Metadata = {
  title: "Demo — MatchIQ",
  description: "Upload match footage and get instant AI analytics — player tracking, fatigue, goal probability and match outcome.",
};

export default function DemoPage() {
  return <DemoClient />;
}
