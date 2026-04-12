"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Home",      href: "/" },
  { label: "Demo",      href: "/demo" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Analytics", href: "/analytics" },
  { label: "Compare",   href: "/compare" },
  { label: "Gallery",   href: "/gallery" },
  { label: "About",     href: "/about" },
  { label: "Contact",   href: "/contact" },
];

export default function Navbar() {
  const pathname              = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Close mobile menu on route change */
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: scrolled ? "rgba(10,10,10,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid #2a2a2a" : "none",
        transition: "all 0.3s",
      }}
    >
      <nav style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.02em", textDecoration: "none" }}>
          <span style={{ color: "#fff" }}>Match</span>
          <span style={{ color: "#D4AF37" }}>IQ</span>
        </Link>

        {/* Desktop links */}
        <ul style={{ display: "flex", alignItems: "center", gap: "2px", listStyle: "none", margin: 0, padding: 0 }}
          className="desktop-nav">
          {NAV_LINKS.map(({ label, href }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  style={{
                    display: "block",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#D4AF37" : "#888",
                    textDecoration: "none",
                    transition: "color 0.2s",
                    position: "relative",
                  }}
                >
                  {label}
                  {/* Active underline dot */}
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      style={{
                        position: "absolute",
                        bottom: "2px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: "#D4AF37",
                        display: "block",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* CTA */}
        <div className="desktop-nav">
          <Link
            href="/demo"
            style={{
              padding: "0.5rem 1.1rem",
              borderRadius: "0.625rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              border: "1px solid #D4AF37",
              color: isActive("/demo") ? "#000" : "#D4AF37",
              background: isActive("/demo") ? "#D4AF37" : "transparent",
              textDecoration: "none",
              transition: "all 0.2s",
            }}
          >
            Try Demo
          </Link>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
          className="mobile-nav-btn"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: "0.5rem" }}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden", background: "#111", borderBottom: "1px solid #2a2a2a" }}
          >
            <div style={{ padding: "0.75rem 1.5rem 1.25rem" }}>
              {NAV_LINKS.map(({ label, href }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: "block",
                      padding: "0.75rem 0",
                      borderBottom: "1px solid #1a1a1a",
                      fontSize: "0.9rem",
                      fontWeight: active ? 700 : 400,
                      color: active ? "#D4AF37" : "#888",
                      textDecoration: "none",
                    }}
                  >
                    {active && <span style={{ marginRight: "0.5rem" }}>▸</span>}
                    {label}
                  </Link>
                );
              })}
              <Link
                href="/demo"
                style={{
                  display: "block",
                  marginTop: "1rem",
                  textAlign: "center",
                  padding: "0.65rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #D4AF37",
                  color: "#D4AF37",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                }}
              >
                Try Demo
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .desktop-nav { display: flex; }
        .mobile-nav-btn { display: none; }
        @media (max-width: 1023px) {
          .desktop-nav { display: none !important; }
          .mobile-nav-btn { display: block !important; }
        }
      `}</style>
    </header>
  );
}
