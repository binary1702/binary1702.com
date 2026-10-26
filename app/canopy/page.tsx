import type { Metadata } from "next";
import CanopyField from "@/components/home/CanopyField";

export const metadata: Metadata = {
  title: "Canopy — Binary 1702",
  robots: { index: false },
};

/* The canopy opening, in the app. Full-viewport canvas with the wordmark and the one line in the clearing. */
export default function CanopyPage() {
  return (
    <main style={{ position: "fixed", inset: 0, background: "#000", color: "#F2EFE7", overflow: "hidden" }}>
      <CanopyField />
      <div
        style={{
          position: "absolute", inset: 0, display: "grid", placeContent: "center", justifyItems: "center", gap: 22,
          textAlign: "center", padding: "0 24px", pointerEvents: "none",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: "50%", top: "50%", width: "min(92vw, 900px)", height: "58vh", transform: "translate(-50%, -50%)",
            background: "radial-gradient(ellipse at center, rgba(0,0,0,.92) 0%, rgba(0,0,0,.8) 35%, rgba(0,0,0,.45) 58%, rgba(0,0,0,0) 74%)",
          }}
        />
        <div
          style={{
            position: "relative", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontWeight: 500,
            fontSize: "clamp(13px, 1.3vw, 17px)", letterSpacing: ".5em", textTransform: "uppercase", textIndent: ".5em",
          }}
        >
          <span style={{ color: "#9D8FD6" }}>Binary</span> 1702
        </div>
        <p
          style={{
            position: "relative", margin: 0, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400,
            fontSize: "clamp(1.55rem, 3.1vw, 2.6rem)", lineHeight: 1.2, color: "rgba(242,239,231,.92)", maxWidth: "24ch", textWrap: "balance",
          }}
        >
          Your business has systems. Do they work together?
        </p>
      </div>
    </main>
  );
}
