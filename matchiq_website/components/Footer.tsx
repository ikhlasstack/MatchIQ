import Link from "next/link";
import { Code2, Link2, Mail, MessageSquare } from "lucide-react";

const LINKS = {
  Product:  [
    { label: "Demo",      href: "/demo" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Analytics", href: "/analytics" },
    { label: "Compare",   href: "/compare" },
    { label: "Gallery",   href: "/gallery" },
  ],
  Company:  [
    { label: "About",   href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Use",   href: "#" },
  ],
};

const SOCIALS = [
  { icon: Code2,        href: "https://github.com",        label: "GitHub" },
  { icon: Link2,        href: "https://linkedin.com",       label: "LinkedIn" },
  { icon: MessageSquare,href: "https://twitter.com",        label: "Twitter" },
  { icon: Mail,         href: "mailto:matchiq@iba.edu.pk",  label: "Email" },
];

export default function Footer() {
  return (
    <footer className="bg-[#111111] border-t border-[#2a2a2a] mt-20">
      <div className="wrap" style={{ paddingTop: "3.5rem", paddingBottom: "3.5rem" }}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="text-2xl font-black tracking-tight">
              <span className="text-white">Match</span>
              <span style={{ color: "#D4AF37" }}>IQ</span>
            </Link>
            <p className="mt-3 text-sm text-[#888] leading-relaxed max-w-xs">
              AI-powered football analytics. See the game differently — player tracking, fatigue
              estimation, goal probability and match outcome prediction.
            </p>
            <div className="flex gap-3 mt-5">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg border border-[#2a2a2a] flex items-center justify-center text-[#888] hover:text-[#D4AF37] hover:border-[#D4AF37] transition-all duration-200"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {Object.entries(LINKS).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37] mb-4">
                {group}
              </h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-[#888] hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[#2a2a2a] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#555]">
          <span>© 2026 MatchIQ. Final Year Project — IBA Karachi.</span>
          <span>Built with Next.js · Tailwind · Framer Motion · Recharts</span>
        </div>
      </div>
    </footer>
  );
}
