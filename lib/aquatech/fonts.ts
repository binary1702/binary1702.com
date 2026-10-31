import { Orbitron, Share_Tech_Mono } from "next/font/google";

/* Aquatech type: Orbitron for sci-fi/digital display titles,
   Share Tech Mono for instrument/data text. Proper techy aesthetic.
   next/font self-hosts both at build time — no runtime request to Google. */
export const aqDisplay = Orbitron({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--aq-display", display: "swap" });
export const aqMono = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--aq-mono", display: "swap" });
