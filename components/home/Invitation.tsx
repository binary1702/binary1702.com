"use client";

import { useEffect, useRef, useState } from "react";
import CanopyField from "./CanopyField";

/* ------------------------------------------------------------------
   03 — An invitation. The closing chapter: the headline, one
   paragraph, the terms of a first conversation, the button, and the
   ways to reach Binary 1702. On the right, a constellation of ideas
   converging on one bright point. Set BOOKING_URL to a scheduling
   link when one exists; until then the button opens email.
   ------------------------------------------------------------------ */

export const BOOKING_URL = "https://calendly.com/benbasuni";

const techFont = "var(--tech-font, 'VT323'), techFontspace";
const serif = "'Playfair Display', Georgia, serif";
const line = "1px solid rgba(242,239,231,.16)";
const gold = "#D4A574";

export default function Invitation() {
  const ref = useRef<HTMLElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: "15% 0px" });
    io.observe(el); return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="contact" aria-label="An invitation" style={{ position: "relative", minHeight: "100lvh", background: "#000", color: "#F2EFE7", overflow: "hidden", zIndex: 1, display: "grid", gridTemplateRows: "minmax(0, 1fr) auto calc(100lvh - 100svh)" }} className="inv-section">
      {/* the backdrop: sunrise over the planet, rendered as ASCII through the same engine as the opening, in the photo's own colours */}
      <div aria-hidden="true" className="inv-field" style={{ position: "absolute", inset: 0 }}><CanopyField src="/horizon.jpg" active={live} cycle={false} cell={7} saturation={1.05} /></div>
      {/* a soft pool behind the text only, so it stays legible without hiding the field */}
      <div aria-hidden="true" className="inv-pool" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "44%", background: "radial-gradient(ellipse 72% 50% at 28% 52%, rgba(0,0,0,.78) 0%, rgba(0,0,0,.45) 55%, rgba(0,0,0,0) 100%)", pointerEvents: "none" }} />
      <style>{`
        .inv-grid { position: relative; display: grid; grid-template-columns: minmax(280px, .9fr) minmax(0, 1.4fr); gap: clamp(24px, 4vw, 64px); align-items: center; padding: clamp(84px, 11vh, 120px) clamp(24px, 6vw, 96px) clamp(28px, 4vh, 48px); min-height: 0; }
        .inv-btn:hover { background: #F2EFE7 !important; }
        .inv-foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px clamp(24px, 6vw, 96px); border-top: 1px solid rgba(242,239,231,.12); font-family: ${techFont}; font-size: 10px; letter-spacing: .28em; text-transform: uppercase; color: rgba(242,239,231,.38); }
        .inv-mark { width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(242,239,231,.35); display: grid; place-content: center; font-family: ${techFont}; font-size: 12px; color: #F2EFE7; }
        @media (max-width: 900px) {
          .inv-grid { grid-template-columns: 1fr; padding-top: 72px; }
          .inv-col { justify-items: center; text-align: center; }
          .inv-btn { justify-self: center !important; }
          .inv-dl { justify-self: center; width: 100%; }
          .inv-dl dd { justify-content: center; }
          .inv-foot { display: none; }
          .inv-section { grid-template-rows: 100svh calc(100lvh - 100svh) !important; }
          /* the sunrise is behind the text here, so dim the whole field and pool the middle */
          .inv-field { opacity: .5; }
          .inv-pool { width: 100% !important; background: radial-gradient(ellipse 90% 60% at 50% 50%, rgba(0,0,0,.95) 0%, rgba(0,0,0,.75) 55%, rgba(0,0,0,0) 100%) !important; }
          /* text at full strength on phones: the sunrise sits right behind it */
          .inv-eyebrow { color: #fff !important; text-shadow: 0 1px 6px rgba(0,0,0,.9); }
          .inv-dl dt { color: #fff !important; font-size: 10.5px !important; text-shadow: 0 1px 6px rgba(0,0,0,.9); }
          .inv-dl dd { color: #fff !important; font-size: 14px !important; text-shadow: 0 1px 6px rgba(0,0,0,.9); }
          .inv-dl, .inv-dl > div { border-color: rgba(242,239,231,.35) !important; }
          .inv-foot { color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,.9); }
        }
        @media (max-width: 560px) { .inv-dl { grid-template-columns: 1fr !important; } }
      `}</style>

      <div className="inv-grid">
        <div className="inv-col" style={{ display: "grid", gap: 26, alignContent: "center" }}>
          <h2 style={{ margin: "0 0 8px", fontFamily: techFont, fontWeight: 400, fontSize: "clamp(1.4rem, 2.8vw, 2.2rem)", lineHeight: 1.2, letterSpacing: ".06em", textTransform: "uppercase", color: "#F2EFE7", whiteSpace: "nowrap" }}>
            An Invitation
          </h2>
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="inv-btn" style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 14, background: gold, color: "#0A0A0A", padding: "18px 28px", fontFamily: techFont, fontSize: 13, fontWeight: 600, letterSpacing: ".2em", textTransform: "uppercase", transition: "background 150ms linear" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="12" rx="1" /><path d="M1.5 6.5h13M5 1v3M11 1v3" /></svg>
            Book a conversation →
          </a>
          <dl className="inv-dl" style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr", gap: 18, maxWidth: 340, borderTop: line, paddingTop: 22 }}>
            {[["Email", "ben@binary1702.com", "mailto:ben@binary1702.com", false], ["WhatsApp", "+1 916 595 7155", "https://wa.me/19165957155", true], ["Based in", "Sacramento, California", null, false]].map(([k, v, href, wa]) => (
              <div key={k as string} style={{ borderBottom: line, paddingBottom: 12 }}>
                <dt style={{ fontFamily: techFont, fontSize: 12, letterSpacing: ".28em", textTransform: "uppercase", color: "rgba(242,239,231,.5)" }}>{k}</dt>
                <dd style={{ margin: "8px 0 0", fontFamily: techFont, fontSize: 16, letterSpacing: ".06em", color: "#F2EFE7", display: "flex", alignItems: "center", gap: 10 }}>
                  {wa && (
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="#25D366"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
                  )}
                  {href ? <a href={href as string} target={wa ? "_blank" : undefined} rel={wa ? "noopener noreferrer" : undefined} style={{ color: "inherit" }}>{v}</a> : v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

      </div>

      <div className="inv-foot" style={{ position: "relative" }}>
        <span />
        <span>Binary 1702 <span style={{ margin: "0 10px", color: "rgba(242,239,231,.25)" }}>/</span> New York <span style={{ margin: "0 10px", color: "rgba(242,239,231,.25)" }}>·</span> Manila</span>
      </div>
    </section>
  );
}
