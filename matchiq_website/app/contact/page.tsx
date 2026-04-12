import type { Metadata } from "next";
import ContactClient from "@/components/contact/ContactClient";
export const metadata: Metadata = { title: "Contact — MatchIQ", description: "Get in touch with the MatchIQ team at IBA Karachi." };
export default function ContactPage() { return <ContactClient />; }
