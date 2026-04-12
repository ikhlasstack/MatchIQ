import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MatchIQ — AI Football Analytics",
  description:
    "See the Game Differently. AI-powered football match analytics: player tracking, fatigue analysis, goal probability and match outcome prediction.",
  keywords: ["football", "AI", "analytics", "player tracking", "sports"],
  authors: [{ name: "MatchIQ Team" }],
  openGraph: {
    title: "MatchIQ — AI Football Analytics",
    description: "See the Game Differently. Upload match footage, get instant analytics.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
