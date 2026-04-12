import type { Metadata } from "next";
import AboutClient from "@/components/about/AboutClient";
export const metadata: Metadata = { title: "About — MatchIQ", description: "Learn about the MatchIQ team, our mission and the technology stack behind the platform." };
export default function AboutPage() { return <AboutClient />; }
