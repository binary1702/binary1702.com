"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  onEnter: () => void;
};

export default function WelcomeModal({ onEnter }: Props) {
  const [phase, setPhase] = useState<"idle" | "fading" | "done">("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rainPausedRef = useRef(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (phase === "done") return;

    // Save current scroll position and lock body
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";

    return () => {
      // Restore scroll position when modal closes
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [phase]);

  // Matrix rain effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Matrix characters
    const matrix = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}";
    const chars = matrix.split("");

    const fontSize = 13;
    const columns = Math.floor(canvas.width / fontSize);

    // Initialize drops
    const drops: number[] = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }

    const draw = () => {
      // Translucent black background for trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Muted sand color
      ctx.fillStyle = "#6E6E6E";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        // Only move drops if not paused
        if (!rainPausedRef.current) {
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i] += 0.65;
        }
      }

    };

    const interval = setInterval(draw, 35);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Fade out and trigger onEnter
  useEffect(() => {
    if (phase !== "fading") return;

    // Wait for fade to complete, then trigger done
    const timer = setTimeout(() => {
      setPhase("done");
      onEnter();
    }, 2000); // Match CSS transition duration

    return () => clearTimeout(timer);
  }, [phase, onEnter]);

  const handleEnter = () => {
    if (phase !== "idle") return;

    // Freeze the rain and start fade
    rainPausedRef.current = true;
    setPhase("fading");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        overflow: "hidden",
        pointerEvents: phase === "done" ? "none" : "auto",
        opacity: phase === "fading" || phase === "done" ? 0 : 1,
        transition: "opacity 2s ease-out",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
    >
      {/* Matrix rain canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background: "black",
        }}
      />

      {/* Dark overlay on rain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background: "rgba(0, 0, 0, 0.5)",
        }}
      />

      {/* Content overlay */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 15,
          opacity: phase === "fading" || phase === "done" ? 0 : 1,
          transition: "opacity 0.8s ease-out",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 35,
            fontWeight: 700,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "#8C7EC4" }}>Binary</span>
          <span style={{ color: "var(--room-fg)" }}>1702</span>
        </div>

        {/* Binary code - colored */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 18,
            fontStyle: "italic",
            letterSpacing: "0.2em",
          }}
        >
          <span style={{ color: "#9E6B6B" }}>1101</span>
          <span style={{ color: "#6B8A9E" }}>0100</span>
          <span style={{ color: "#6B9E6B" }}>110</span>
        </div>

        {/* Enter button + Client Login */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 15, marginTop: 10 }}>
          <button
            onClick={handleEnter}
            style={{
              background: "none",
              border: "1px solid var(--room-muted)",
              color: "var(--room-fg)",
              fontSize: 18,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              padding: "15px 40px",
              cursor: "pointer",
              transition: "border-color 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--room-fg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--room-muted)";
            }}
          >
            Enter
          </button>
          <a
            href="https://portal.binary1702.com"
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              textDecoration: "none",
              padding: "10px 25px",
              transition: "border-color 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
              e.currentTarget.style.color = "rgba(255,255,255,0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
              e.currentTarget.style.color = "rgba(255,255,255,0.5)";
            }}
          >
            Client Login
          </a>
        </div>
      </div>
    </div>
  );
}
