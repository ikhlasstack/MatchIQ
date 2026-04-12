import type { Metadata } from "next";
import GalleryClient from "@/components/gallery/GalleryClient";
export const metadata: Metadata = { title: "Gallery — MatchIQ", description: "Browse all processed match videos and view analytics reports." };
export default function GalleryPage() { return <GalleryClient />; }
