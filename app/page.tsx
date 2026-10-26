import type { Metadata } from "next";
import s from "./home.module.css";
import CanopyOpening from "@/components/home/CanopyOpening";
import Slide from "@/components/home/Slide";

/* ------------------------------------------------------------------
   Binary 1702 — homepage.

   Four chapters, each one full-viewport ASCII composition with the
   least possible type set into it:
     01 Identity      the canopy (fixed opening, draws away on scroll)
     02 Systems       an enterprise is a system of systems
     03 Engineering   what we build
     04 Engagements   how to begin
   ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Binary 1702 — Enterprise Technology Transformation",
  description:
    "Binary 1702 transforms fragmented enterprise operations into connected digital systems. Workflow transformation, systems integration, and operational intelligence for operations-intensive organizations.",
};

const mono = "ui-monospace, 'SF Mono', Menlo, monospace";

export default function HomePage() {
  return (
    <div className={s.page}>
      <CanopyOpening />
      <div className={s.opening} aria-hidden="true" />

      {/* 02 — Systems */}
      <Slide
        id="systems"
        index="02"
        label="Systems"
        src="/network.jpg"
        line={<>An enterprise is a system of systems.</>}
        sub={<>People. Processes. Information. Decisions.</>}
      />

      {/* 03 — Engineering */}
      <Slide
        id="engineering"
        index="03"
        label="Engineering"
        src="/architecture.jpg"
        line={<>Built, not described.</>}
        sub={
          <>
            Workflow systems · Integrations · Operational intelligence · AI inside the process
            <br />
            Flagship demonstration: warehouse-to-field equipment accountability.
          </>
        }
      />

      {/* 04 — Engagements */}
      <Slide
        id="engagements"
        index="04"
        label="Engagements"
        src="/horizon.jpg"
        line={<>A defined path, one step at a time.</>}
        sub={
          <>
            Diagnose &nbsp;·&nbsp; Enterprise Workflow Assessment &nbsp;·&nbsp; $10K–$25K
            <br />
            Prove &nbsp;·&nbsp; Department Modernization Pilot &nbsp;·&nbsp; $25K–$75K
            <br />
            Transform &nbsp;·&nbsp; Multi-System Transformation &nbsp;·&nbsp; $100K–$300K+
            <br />
            Evolve &nbsp;·&nbsp; Ongoing Engineering &amp; Support &nbsp;·&nbsp; $5K–$20K+ / month
          </>
        }
      >
        <a
          href="/lets-talk"
          style={{
            marginTop: 18, fontFamily: mono, fontSize: 12, letterSpacing: ".22em", textTransform: "uppercase", color: "#F2EFE7",
            borderBottom: "1px solid rgba(242,239,231,.4)", paddingBottom: 6,
          }}
        >
          Request an Enterprise Workflow Assessment →
        </a>
      </Slide>

      <footer
        style={{
          position: "relative", zIndex: 1, background: "#000", padding: "28px clamp(24px, 6vw, 96px)",
          display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16,
          fontFamily: mono, fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(242,239,231,.4)",
        }}
      >
        <span>Binary 1702 · Sacramento, CA</span>
        <span style={{ display: "flex", gap: 28 }}>
          <a href="/showcase">Philosophy</a>
          <a href="/lab/generative">Lab</a>
          <a href="https://portal.binary1702.com">Client login</a>
        </span>
      </footer>
    </div>
  );
}
