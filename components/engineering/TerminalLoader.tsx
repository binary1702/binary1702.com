"use client";

/* TerminalLoader — three green dots, pulsing in sequence. Nothing else. */
export default function TerminalLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", pointerEvents: "none" }}>
      <style>{`
        .tl-dots { display: flex; gap: 9px; }
        .tl-dots i { width: 6px; height: 6px; border-radius: 50%; background: #3BF27A; opacity: .25; animation: tlPulse 1.2s ease-in-out infinite; }
        .tl-dots i:nth-child(2) { animation-delay: .2s; }
        .tl-dots i:nth-child(3) { animation-delay: .4s; }
        @keyframes tlPulse { 0%, 100% { opacity: .2; transform: scale(.85); } 40% { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .tl-dots i { animation: none; opacity: .7; } }
      `}</style>
      <div className="tl-dots" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}
