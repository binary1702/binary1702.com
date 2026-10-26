"use client";

import type { CSSProperties } from "react";
import SiteHeader from "@/components/SiteHeader";
import { experiments, experimentHost, experimentUrl } from "@/lib/experiments";

const serif = "'Playfair Display',Georgia,serif";

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0,1fr))",
  gap: "1px",
  background: "var(--faint)",
  border: "1px solid var(--faint)",
};

const cell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "28px 24px",
  background: "var(--paper)",
  textDecoration: "none",
  color: "inherit",
  minWidth: 0,
};

const numeral: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.12em",
  color: "var(--sig-text)",
};

const name: CSSProperties = {
  fontFamily: serif,
  fontSize: "clamp(1.4rem,2.2vw,2rem)",
  lineHeight: 1.1,
  letterSpacing: "-0.012em",
};

const host: CSSProperties = {
  fontFamily: "monospace",
  fontSize: 13,
  letterSpacing: "0.04em",
  color: "var(--graphite)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function ExperimentsPage() {
  return (
    <div
      style={{
        background: "var(--paper)",
        fontFamily: "'Archivo Narrow',system-ui,sans-serif",
        fontWeight: 400,
        color: "var(--ink)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SiteHeader />

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          padding: "140px clamp(24px,5.5vw,96px) 120px",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: "0 0 0.5em",
            fontFamily: serif,
            fontWeight: 400,
            fontSize: "clamp(2rem,5vw,3.5rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          Experiments
        </h1>
        <p
          style={{
            margin: "0 0 3em",
            fontSize: "clamp(1rem,1.3vw,1.2rem)",
            color: "var(--graphite)",
            lineHeight: 1.6,
            whiteSpace: "nowrap",
          }}
        >
          Things built to find out. Each one lives on its own subdomain.
        </p>

        <div style={grid}>
          {experiments.map((e, i) => (
            <a
              key={e.slug}
              href={experimentUrl(e)}
              target="_blank"
              rel="noopener noreferrer"
              style={cell}
              onMouseEnter={(ev) => {
                ev.currentTarget.style.color = "var(--sig-text)";
              }}
              onMouseLeave={(ev) => {
                ev.currentTarget.style.color = "inherit";
              }}
            >
              <span style={numeral}>{String(i + 1).padStart(2, "0")}</span>
              <span style={name}>{e.label}</span>
              <span style={host}>{experimentHost(e)}</span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
