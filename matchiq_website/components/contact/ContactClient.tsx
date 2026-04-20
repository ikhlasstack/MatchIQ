"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Globe, Code2, Send, CheckCircle, MapPin } from "lucide-react";

/* ── types ─────────────────────────────────────────────────── */
type FormState = { name: string; email: string; subject: string; message: string };
type Errors    = Partial<FormState>;

/* ── static data ────────────────────────────────────────────── */
const CONTACT_INFO = [
  { icon: Mail,   label: "Email",    value: "matchiq.iba@gmail.com",        href: "mailto:matchiq.iba@gmail.com", color: "#D4AF37" },
  { icon: Globe,  label: "LinkedIn", value: "linkedin.com/company/matchiq", href: "#",                            color: "#D4AF37" },
  { icon: Code2,  label: "GitHub",   value: "github.com/matchiq-iba",       href: "#",                            color: "#D4AF37" },
  { icon: MapPin, label: "Location", value: "IBA Karachi — FYP 2026",       href: "#",                            color: "#D4AF37" },
];

/* ── validation ─────────────────────────────────────────────── */
function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.name.trim())                      e.name    = "Name is required";
  if (!f.email.trim())                     e.email   = "Email is required";
  else if (!/\S+@\S+\.\S+/.test(f.email)) e.email   = "Invalid email address";
  if (!f.subject.trim())                   e.subject = "Subject is required";
  if (f.message.trim().length < 10)        e.message = "Message must be at least 10 characters";
  return e;
}

/* ── shared input styles ────────────────────────────────────── */
function inputStyle(err?: string): CSSProperties {
  return {
    width: "100%",
    background: "#0a0a0a",
    border: `1px solid ${err ? "#ef4444" : "#2a2a2a"}`,
    borderRadius: "0.75rem",
    padding: "0.75rem 1rem",
    color: "#fff",
    fontSize: "0.9rem",
    outline: 0,
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
    display: "block",
  };
}

function textareaStyle(err?: string): CSSProperties {
  return {
    ...inputStyle(err),
    resize: "vertical",
    minHeight: "140px",
  };
}

/* ── component ──────────────────────────────────────────────── */
export default function ContactClient() {
  const [form,    setForm]    = useState<FormState>({ name: "", email: "", subject: "", message: "" });
  const [errors,  setErrors]  = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleChange =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f  => ({ ...f,   [k]: e.target.value }));
      setErrors(er => ({ ...er, [k]: undefined      }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSending(true);
    await new Promise<void>(resolve => setTimeout(resolve, 1800));
    setSending(false);
    setSent(true);
  };

  const resetForm = () => {
    setSent(false);
    setForm({ name: "", email: "", subject: "", message: "" });
    setErrors({});
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "64px" }}>

      {/* Background orbs */}
      <div
        role="presentation"
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      >
        <div style={{ position: "absolute", top: "10%", right: "-5%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle,rgba(212,175,55,0.06) 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "-5%",  width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,0.05) 0%,transparent 70%)"  }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Page header ── */}
        <div style={{ background: "#111111", borderBottom: "1px solid #1a1a1a" }}>
          <div className="wrap" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
            <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "#D4AF37", fontWeight: 600, marginBottom: "0.4rem" }}>
              Get In Touch
            </p>
            <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
              Contact <span style={{ color: "#D4AF37" }}>Us</span>
            </h1>
            <p style={{ color: "#888", fontSize: "0.9rem" }}>
              Have a question, want to collaborate, or just say hello? We&apos;d love to hear from you.
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="wrap" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>

            {/* Form card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ background: "#111111", border: "1px solid #2a2a2a", borderRadius: "1.25rem", padding: "2rem" }}
            >
              <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#D4AF37", fontWeight: 600, marginBottom: "1.5rem" }}>
                Send a Message
              </p>

              <AnimatePresence mode="wait">
                {sent ? (
                  /* Success state */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ textAlign: "center", padding: "3rem 1rem" }}
                  >
                    <div style={{ width: "5rem", height: "5rem", borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
                      <CheckCircle size={36} style={{ color: "#22c55e" }} />
                    </div>
                    <h3 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>Message Sent!</h3>
                    <p style={{ color: "#888", marginBottom: "2rem" }}>We&apos;ll get back to you within 24 hours.</p>
                    <button
                      type="button"
                      onClick={resetForm}
                      style={{ padding: "0.7rem 1.75rem", borderRadius: "0.75rem", background: "transparent", border: "1px solid rgba(212,175,55,0.4)", color: "#D4AF37", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      Send Another
                    </button>
                  </motion.div>
                ) : (
                  /* Form state */
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
                  >
                    {/* Name + Email row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: "0.4rem" }}>Name *</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={handleChange("name")}
                          placeholder="Your full name"
                          style={inputStyle(errors.name)}
                        />
                        {errors.name && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: "0.3rem" }}>{errors.name}</p>}
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: "0.4rem" }}>Email *</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={handleChange("email")}
                          placeholder="you@example.com"
                          style={inputStyle(errors.email)}
                        />
                        {errors.email && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: "0.3rem" }}>{errors.email}</p>}
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: "0.4rem" }}>Subject *</label>
                      <input
                        type="text"
                        value={form.subject}
                        onChange={handleChange("subject")}
                        placeholder="What&apos;s this about?"
                        style={inputStyle(errors.subject)}
                      />
                      {errors.subject && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: "0.3rem" }}>{errors.subject}</p>}
                    </div>

                    {/* Message */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                        <label style={{ fontSize: "0.78rem", color: "#888" }}>Message *</label>
                        <span style={{ fontSize: "0.72rem", color: form.message.length < 10 ? "#555" : "#22c55e" }}>
                          {form.message.length} chars
                        </span>
                      </div>
                      <textarea
                        value={form.message}
                        onChange={handleChange("message")}
                        placeholder="Tell us more about your project, question, or idea…"
                        rows={6}
                        style={textareaStyle(errors.message)}
                      />
                      {errors.message && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: "0.3rem" }}>{errors.message}</p>}
                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={sending}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                        padding: "0.9rem 1.5rem", borderRadius: "0.875rem",
                        background: sending ? "rgba(212,175,55,0.45)" : "#D4AF37",
                        color: "#000", fontSize: "0.95rem", fontWeight: 800,
                        border: "none", cursor: sending ? "not-allowed" : "pointer",
                        transition: "background 0.2s",
                        width: "100%",
                      }}
                    >
                      {sending ? (
                        <>
                          <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Send Message
                        </>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Contact info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1rem" }}>
              {CONTACT_INFO.map(({ icon: Icon, label, value, href, color }, i) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.45 }}
                  className="card-hover"
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    background: "#111111", border: "1px solid #2a2a2a",
                    borderRadius: "1rem", padding: "1.25rem",
                    textDecoration: "none", color: "inherit",
                  }}
                >
                  <div style={{
                    width: "2.75rem", height: "2.75rem", borderRadius: "0.75rem", flexShrink: 0,
                    background: `${color}18`, border: `1px solid ${color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>{label}</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color, wordBreak: "break-word" }}>{value}</div>
                  </div>
                </motion.a>
              ))}
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
