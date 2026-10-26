"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TypeWriter from "@/components/TypeWriter";
import VideoBackground from "@/components/VideoBackground";
import GlobalMuteButton from "@/components/GlobalMuteButton";
import { useAudioContext } from "@/components/AudioProvider";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useSectionNavigation } from "@/hooks/useSectionNavigation";

/* ------------------------------------------------------------------
   Style primitives — the invariant structures every section reuses.
   Spacing multiplies against --pace (globals.css) so the whole page's
   vertical rhythm can be retuned from one variable.
   ------------------------------------------------------------------ */
const serif = "'Playfair Display',Georgia,serif";

const sectionGrid = (padTop: number, padBottom: number): CSSProperties => ({
  maxWidth: 1320,
  margin: "0 auto",
  padding: `calc(${padTop}px * var(--pace)) clamp(24px,5.5vw,96px) calc(${padBottom}px * var(--pace))`,
  display: "grid",
  gridTemplateColumns: "minmax(0,10ch) minmax(0,1fr)",
  gap: "clamp(16px,4vw,48px)",
  minHeight: "100vh",
  boxSizing: "border-box",
});

const numeral = (paddingTop: string, color = "var(--sig-text)"): CSSProperties => ({
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: "0.12em",
  color,
  paddingTop,
});

/* Body copy, large → small */
const bodyLg: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.1rem,1.32vw,1.3rem)",
  lineHeight: 1.72,
  letterSpacing: "0.004em",
  color: "var(--graphite)",
  textWrap: "pretty",
};

const bodyMd: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.06rem,1.24vw,1.2rem)",
  lineHeight: 1.72,
  letterSpacing: "0.004em",
  color: "var(--graphite)",
  textWrap: "pretty",
};

/* "The Sequence" secondary rows (Build / Care) */
const seqRowLink: CSSProperties = {
  justifySelf: "start",
  fontFamily: serif,
  fontSize: "clamp(1.3rem,1.7vw,1.55rem)",
  lineHeight: 1.1,
  letterSpacing: "-0.012em",
};

const seqRowText: CSSProperties = {
  margin: 0,
  maxWidth: "36ch",
  fontSize: "clamp(0.98rem,1.1vw,1.06rem)",
  lineHeight: 1.7,
  letterSpacing: "0.004em",
  color: "var(--graphite)",
  textWrap: "pretty",
};

/* "Where You Fit" checklist rows */
const fitItem: CSSProperties = {
  margin: 0,
  padding: "26px 0",
  borderBottom: "1px solid var(--rule)",
  fontSize: "clamp(1.1rem,1.32vw,1.3rem)",
  lineHeight: 1.54,
  letterSpacing: "0.004em",
  textWrap: "pretty",
  color: "#F5F2EA",
};

// Network speed detection for preload decisions
function getNetworkSpeed(): "slow" | "medium" | "fast" {
  if (typeof navigator === "undefined") return "fast";
  const conn = (navigator as any).connection;
  if (!conn) return "fast";
  if (conn.saveData) return "slow";
  const type = conn.effectiveType;
  if (type === "slow-2g" || type === "2g") return "slow";
  if (type === "3g") return "medium";
  return "fast";
}

export default function Home() {
  const [introComplete, setIntroComplete] = useState(false);
  const [introStarted, setIntroStarted] = useState(false);
  const [typewriterVisible, setTypewriterVisible] = useState(false);
  const activeSection = useActiveSection();
  const { skippedModal, enter, playTypewriter, stopTypewriterAndPlayMusic } = useAudioContext();

  // Preload state: which sections should load their videos
  const [preloadSections, setPreloadSections] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if a section's video should start loading
  const shouldPreload = useCallback((sectionId: string) => {
    return preloadSections.has(sectionId);
  }, [preloadSections]);

  // Force scroll to top on initial load
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Lock scroll during intro sequence
  useEffect(() => {
    document.documentElement.classList.toggle("intro-locked", !introComplete);
    return () => {
      document.documentElement.classList.remove("intro-locked");
    };
  }, [introComplete]);

  // The gate lives at "/" now, so the intro starts on mount.
  // Fresh arrivals: fade the typewriter in, then type. Preload by network speed.
  // Returning visitors (session already entered): preload everything immediately.
  useEffect(() => {
    if (introStarted) return;

    enter();
    setTypewriterVisible(true);
    const timer = setTimeout(() => {
      setIntroStarted(true);
      playTypewriter();
    }, 800);

    if (skippedModal) {
      setPreloadSections(new Set(["01 Threshold", "02 The Named Thing", "03 The Sequence", "04 The Door"]));
    } else {
      const speed = getNetworkSpeed();
      const sectionsToPreload = ["01 Threshold"];
      if (speed === "medium" || speed === "fast") {
        sectionsToPreload.push("02 The Named Thing");
      }
      if (speed === "fast") {
        sectionsToPreload.push("03 The Sequence");
      }
      setPreloadSections(new Set(sectionsToPreload));
    }

    return () => clearTimeout(timer);
  }, [introStarted, skippedModal, enter, playTypewriter]);

  const handleIntroComplete = () => {
    setIntroComplete(true);
    setTimeout(() => {
      stopTypewriterAndPlayMusic();
    }, 750);
  };

  // Rolling prefetch: when user approaches a section, preload the next one
  useEffect(() => {
    if (!introComplete || !containerRef.current) return;

    // Clean up old observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const sections = containerRef.current.querySelectorAll("section[data-screen-label]");
    const sectionOrder = ["01 Threshold", "02 The Named Thing", "03 The Sequence", "04 The Door"];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const currentId = entry.target.getAttribute("data-screen-label");
            if (!currentId) return;

            const currentIndex = sectionOrder.indexOf(currentId);
            if (currentIndex === -1) return;

            // Preload next section
            const nextIndex = currentIndex + 1;
            if (nextIndex < sectionOrder.length) {
              setPreloadSections((prev) => {
                const next = new Set(prev);
                next.add(sectionOrder[nextIndex]);
                return next;
              });
            }
          }
        });
      },
      { rootMargin: "100% 0px" } // Start loading ~1 viewport ahead
    );

    sections.forEach((section) => observerRef.current?.observe(section));

    return () => observerRef.current?.disconnect();
  }, [introComplete]);

  // Arrow key navigation between sections
  useSectionNavigation();

  return (
    <div
      ref={containerRef}
      style={{
        background: introComplete ? "var(--paper)" : "#000",
        fontFamily: "'Archivo Narrow',system-ui,sans-serif",
        fontWeight: 400,
        color: "var(--ink)",
        overflowX: "hidden",
        minHeight: "100vh",
        scrollSnapType: "y mandatory",
        overflowY: introComplete ? "scroll" : "hidden",
        height: "100vh",
        transition: "background 2.5s ease-out",
      }}
    >
      <SiteHeader introComplete={introComplete} />

      {/* 01 — Threshold */}
      <section
        data-screen-label="01 Threshold"
        data-theme="dark"
                style={{
          position: "relative",
          scrollSnapAlign: "start",
          height: "100dvh",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Video background */}
        <VideoBackground
          src="/movies/homepage/desktop/01-cityscapes.webm"
          mobileSrc="/movies/homepage/mobile/01-cityscapes.webm"
          poster="/poster/cityscape.webp"
          preload={shouldPreload("01 Threshold") ? "auto" : "none"}
          paused={!introComplete || activeSection !== "01 Threshold"}
        />

        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: introComplete ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,1)",
            zIndex: 1,
            transition: "background 2.5s ease-out",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 1320,
            margin: "0 auto",
            padding: "calc(190px * var(--pace)) clamp(24px,5.5vw,96px) clamp(80px, 12vh, 120px)",
            display: "grid",
            gridTemplateColumns: "minmax(0,10ch) minmax(0,1fr)",
            gap: "clamp(16px,4vw,48px)",
            height: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              ...numeral("1.1em", "rgba(255,255,255,0.6)"),
              opacity: introComplete ? 1 : 0,
              transition: "opacity 2.5s ease-out 0.5s",
            }}
          >
            01
          </div>
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: serif,
                fontWeight: 400,
                fontSize: "clamp(3rem,9.6vw,9.4rem)",
                lineHeight: 0.98,
                letterSpacing: "-0.022em",
                whiteSpace: "nowrap",
                color: "#F5F2EA",
                opacity: typewriterVisible ? 1 : 0,
                transition: "opacity 1.5s ease-out",
              }}
            >
              <TypeWriter
                segments={[
                  { text: "Let's begin", pauseBlinks: 3.5 },
                  { text: "\nwith clarity.", pauseBlinks: 0 },
                ]}
                speed={70}
                delay={1800}
                start={introStarted}
                onComplete={handleIntroComplete}
              />
            </h1>
            <p
              style={{
                ...bodyLg,
                maxWidth: "42ch",
                fontSize: "clamp(1.5rem,1.4vw,1.38rem)",
                marginTop: "clamp(48px, 8vh, 120px)",
                color: "rgba(255,255,255,0.8)",
                opacity: introComplete ? 1 : 0,
                transition: "opacity 2.5s ease-out 0.5s",
              }}
            >
            Complex decisions deserve clear thinking.
            Everything else follows.
            </p>
          </div>
        </div>
      </section>

      {/* 02 — The Named Thing */}
      <section
        data-screen-label="02 The Named Thing"
        data-theme="dark"
                style={{
          position: "relative",
          scrollSnapAlign: "start",
          minHeight: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Video background */}
        <VideoBackground
          src="/movies/homepage/desktop/02-architectural.webm"
          mobileSrc="/movies/homepage/mobile/02-architectural.webm"
          poster="/poster/architecture.webp"
          preload={shouldPreload("02 The Named Thing") ? "auto" : "none"}
          paused={activeSection !== "02 The Named Thing"}
        />

        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            zIndex: 1,
          }}
        />

        {/* Content */}
        <div
          style={{
            ...sectionGrid(96, 110),
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={numeral("0.9em", "rgba(255,255,255,0.6)")}>02</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(32px,5vw,80px)", alignItems: "center" }}>
            <h2
              style={{
                margin: 0,
                fontFamily: serif,
                fontWeight: 400,
                fontSize: "clamp(1.95rem,4.4vw,3.8rem)",
                lineHeight: 1.06,
                letterSpacing: "-0.018em",
                maxWidth: "16ch",
                textWrap: "balance",
                color: "#F5F2EA",
              }}
            >
              Most work fails before it begins.
            </h2>
            <div>
              <p style={{ ...bodyLg, margin: 0, color: "rgba(255,255,255,0.8)" }}>
                Technology rarely fails. Decisions do.
              </p>
              <p style={{ ...bodyLg, margin: "1.5em 0 0", color: "rgba(255,255,255,0.8)" }}>
                Most technology is built to answer the wrong question.<br></br>
                Perfectly executed.
                Beautifully designed.<br></br>
                But entirely unnecessary.
              </p>
              <p style={{ ...bodyLg, margin: "1.5em 0 0", color: "#F5F2EA" }}>
                We think the decision deserves more attention than the implementation.
              </p>
              <p style={{ ...bodyLg, margin: "1.5em 0 0", color: "#F5F2EA" }}>
                And that&apos;s where we come in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 03 — The Sequence */}
      <section
        data-screen-label="03 The Sequence"
        data-theme="dark"
                style={{
          position: "relative",
          scrollSnapAlign: "start",
          minHeight: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Video background */}
        <VideoBackground
          src="/movies/homepage/desktop/03-diagnosis.webm"
          mobileSrc="/movies/homepage/mobile/03-diagnosis.webm"
          poster="/poster/diagnosis.webp"
          preload={shouldPreload("03 The Sequence") ? "auto" : "none"}
          paused={activeSection !== "03 The Sequence"}
        />

        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            zIndex: 1,
          }}
        />

        {/* Content */}
        <div
          style={{
            ...sectionGrid(120, 150),
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={numeral("0.6em", "rgba(255,255,255,0.6)")}>03</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(80px,10vw,160px)", alignItems: "center" }}>
            <div>
              <Link
                href="/services/diagnose"
                className="rule-link"
                style={{
                  display: "inline-block",
                  fontFamily: serif,
                  fontSize: "clamp(3.2rem,9vw,8.2rem)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.024em",
                  whiteSpace: "nowrap",
                  color: "#F5F2EA",
                }}
              >
                Diagnose
              </Link>

              <p
                style={{
                  margin: "calc(20px * var(--pace)) 0 0",
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#C4B08A",
                }}
              >
                From $5,000
              </p>

              <p
                style={{
                  margin: "calc(32px * var(--pace)) 0 0",
                  maxWidth: "20ch",
                  fontFamily: serif,
                  fontSize: "clamp(1.7rem,3.4vw,2.9rem)",
                  lineHeight: 1.16,
                  letterSpacing: "-0.016em",
                  textWrap: "balance",
                  color: "#F5F2EA",
                }}
              >
                Every engagement starts here.
              </p>

              <p style={{ ...bodyMd, margin: "calc(40px * var(--pace)) 0 0", maxWidth: "42ch", color: "rgba(255,255,255,0.8)" }}>
              Before we change the business, we understand it.
              </p>

              <p
                data-principle=""
                style={{
                  margin: "calc(50px * var(--pace)) 0 0",
                  maxWidth: "28ch",
                  fontFamily: serif,
                  fontStyle: "italic",
                  fontSize: "clamp(1.4rem,2.3vw,1.95rem)",
                  lineHeight: 1.34,
                  letterSpacing: "-0.008em",
                  textWrap: "pretty",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                Sometimes the answer is that nothing should be built.
              </p>
            </div>

            <div className="hide-on-mobile" style={{ display: "flex", flexDirection: "column", gap: "calc(36px * var(--pace))" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 400,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                Core Services
              </p>
              <div style={{ paddingTop: "calc(10px * var(--pace))" }}>
                <span style={{ ...seqRowLink, color: "#D88888" }}>
                  01. Build
                </span>
                <p style={{ margin: "0.8em 0 0", color: "rgba(255,255,255,0.8)" }}>
                When something needs to be made.
                </p>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "calc(34px * var(--pace))" }}>
                <span style={{ ...seqRowLink, color: "#8AB8D0" }}>
                  02. Care
                </span>
                <p style={{ margin: "0.8em 0 0", color: "rgba(255,255,255,0.8)" }}>
                When something needs to be maintained.
                </p>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "calc(34px * var(--pace))" }}>
                <span style={{ ...seqRowLink, color: "#8AC98A" }}>
                  03. Grow
                </span>
                <p style={{ margin: "0.8em 0 0", color: "rgba(255,255,255,0.8)" }}>
                  When something needs to reach more people.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 04 — The Door */}
      <section
        data-screen-label="04 The Door"
        data-theme="dark"
        style={{
          position: "relative",
          scrollSnapAlign: "start",
          height: "100vh",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Video background */}
        <VideoBackground
          src="/movies/homepage/desktop/04-conversation.webm"
          mobileSrc="/movies/homepage/mobile/04-conversation.webm"
          poster="/poster/coffee.webp"
          preload={shouldPreload("04 The Door") ? "auto" : "none"}
          paused={activeSection !== "04 The Door"}
        />

        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            zIndex: 1,
          }}
        />

        {/* Content */}
        <div
          style={{
            ...sectionGrid(140, 80),
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={numeral("1.4em", "rgba(255,255,255,0.6)")}>04</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(48px,6vw,96px)", alignItems: "start" }}>
            <div>
              <h2
                style={{
                  margin: "0 0 calc(20px * var(--pace))",
                  fontFamily: serif,
                  fontWeight: 400,
                  fontSize: "clamp(1.7rem,3.2vw,2.8rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.016em",
                  maxWidth: "20ch",
                  textWrap: "balance",
                  color: "#F5F2EA",
                }}
              >
              Before we begin...
              </h2>
              <p
                style={{
                  ...bodyMd,
                  margin: "0 0 calc(24px * var(--pace))",
                  color: "rgba(255,255,255,0.8)",
                  fontStyle: "italic",
                }}
              >
                There are a few things the best partnerships have in common.
              </p>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}>
                <p style={{ ...fitItem, borderBottomColor: "rgba(255,255,255,0.2)" }}><span style={{ marginRight: "0.5em" }}>›</span>The decision-maker is in the room.</p>
                <p style={{ ...fitItem, borderBottomColor: "rgba(255,255,255,0.2)" }}><span style={{ marginRight: "0.5em" }}>›</span>We&apos;re allowed to understand your business and processes.</p>
                <p style={{ ...fitItem, borderBottomColor: "rgba(255,255,255,0.2)" }}><span style={{ marginRight: "0.5em" }}>›</span>Assumptions can be challenged.</p>
                <p style={{ ...fitItem, borderBottomColor: "rgba(255,255,255,0.2)" }}><span style={{ marginRight: "0.5em" }}>›</span>Evidence matters more than ego.</p>
              </div>
            </div>
            <div className="hide-on-mobile">
              <h2
                style={{
                  margin: 0,
                  fontFamily: serif,
                  fontWeight: 400,
                  fontSize: "clamp(2rem,4.5vw,4.2rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.018em",
                  maxWidth: "13ch",
                  textWrap: "balance",
                  color: "#F5F2EA",
                }}
              >
              Enough browsing.
              </h2>
              <p
                style={{
                  ...bodyLg,
                  margin: "calc(60px * var(--pace)) 0 0",
                  maxWidth: "48ch",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                You tell us what&apos;s happening.<br></br>
                We&apos;ll ask the questions.<br></br>
                And we&apos;ll tell you what we think.<br></br>
                If we&apos;re not a good fit, we&apos;ll say so.
              </p>
              <Link
                href="/lets-talk"
                className="cta-link"
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: "0.8em",
                  marginTop: "calc(60px * var(--pace))",
                  paddingBottom: 14,
                  borderBottom: "1px solid rgba(255,255,255,0.3)",
                  fontFamily: "'Archivo Narrow',sans-serif",
                  fontWeight: 500,
                  fontSize: "clamp(1.15rem,1.5vw,1.4rem)",
                  letterSpacing: "0.02em",
                  color: "#F5F2EA",
                }}
              >
                <span>Let's Talk</span>
                <span
                  style={{
                    fontFamily: "'Archivo Narrow',sans-serif",
                    fontSize: "0.55em",
                    display: "inline-block",
                  }}
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter introComplete={introComplete} />

      <GlobalMuteButton introComplete={introComplete} />
    </div>
  );
}
