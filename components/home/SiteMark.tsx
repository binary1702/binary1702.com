"use client";

import Link from "next/link";

/* The only chrome: BINARY 1702, top right. */
const mono = "ui-monospace, 'SF Mono', Menlo, monospace";

export default function SiteMark() {
  return (
    <Link
      href="/"
      aria-label="Binary 1702 home"
      style={{ position: "fixed", top: 24, right: 28, zIndex: 80, fontFamily: mono, fontSize: 11, letterSpacing: ".34em", textTransform: "uppercase", color: "#F2EFE7", mixBlendMode: "difference" }}
    >
      <span style={{ color: "#B9AEE6" }}>Binary</span> 1702
    </Link>
  );
}
