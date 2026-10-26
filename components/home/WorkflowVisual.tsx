"use client";

import { useState } from "react";
import s from "@/app/home.module.css";

/* ------------------------------------------------------------------
   Workflow visual.

   One SVG, two states. "Before": four nodes, no connections, each
   with its own failure mode. "After": the nodes are linked through a
   shared workflow bar with status surfaced. Pure CSS transitions on
   opacity / stroke-dashoffset — no animation library. The step list
   below the SVG carries the same meaning in text for visitors who
   skip the visual or have reduced motion on.
   ------------------------------------------------------------------ */

const nodes = [
  { x: 40,  label: "Sales",     fail: "Manual handoffs" },
  { x: 220, label: "Warehouse", fail: "Separate tracking" },
  { x: 400, label: "Field",     fail: "Evidence by phone" },
  { x: 580, label: "Finance",   fail: "Delayed billing" },
];

const steps = [
  "Customer order",
  "Warehouse verification",
  "Equipment handover",
  "Technician confirmation",
  "Installation evidence",
  "Manager approval",
];

export default function WorkflowVisual() {
  const [on, setOn] = useState(false);

  const ease = "600ms cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <div className={s.flow} id="demo">
      <div className={s.flowHead}>
        <div className={s.flowState}>
          State: <b>{on ? "Connected" : "Disconnected"}</b>
        </div>
        <button
          type="button"
          className={`${s.btn} ${on ? s.btnGhost : ""}`}
          aria-pressed={on}
          onClick={() => setOn((v) => !v)}
        >
          {on ? "Reset" : "Connect the workflow"}
        </button>
      </div>

      <svg
        className={s.flowSvg}
        viewBox="0 0 700 260"
        role="img"
        aria-label={
          on
            ? "Sales, warehouse, field and finance connected through one shared workflow with visible status."
            : "Sales, warehouse, field and finance as four disconnected systems."
        }
      >
        <defs>
          <style>{`
            .wf-node { fill: rgba(255,255,255,0.015); stroke: rgba(242,239,231,0.28); stroke-width: 1; }
            .wf-node-on { stroke: #8C7EC4; }
            .wf-label { font: 600 11px 'Archivo Narrow', system-ui, sans-serif; letter-spacing: .22em; text-transform: uppercase; fill: #F2EFE7; }
            .wf-fail { font: 12px 'Archivo Narrow', system-ui, sans-serif; fill: rgba(242,239,231,0.48); }
            .wf-link { stroke: #8C7EC4; stroke-width: 1.5; fill: none; stroke-dasharray: 200; }
            .wf-bar { fill: rgba(140,126,196,0.10); stroke: #8C7EC4; stroke-width: 1; }
            .wf-bar-text { font: 600 11px 'Archivo Narrow', system-ui, sans-serif; letter-spacing: .24em; text-transform: uppercase; fill: #F2EFE7; }
            .wf-chip { font: 11px 'Archivo Narrow', system-ui, sans-serif; fill: #B7B1A6; }
            .wf-dot { fill: #C98A3C; }
            .wf-dot-on { fill: #8C7EC4; }
          `}</style>
        </defs>

        {/* nodes */}
        {nodes.map((n, i) => (
          <g key={n.label} transform={`translate(${n.x} 30)`}>
            <rect
              width="120"
              height="64"
              className={`wf-node ${on ? "wf-node-on" : ""}`}
              style={{ transition: `stroke ${ease}` }}
            />
            <circle
              cx="106"
              cy="14"
              r="3.5"
              className={on ? "wf-dot-on" : "wf-dot"}
              style={{ transition: `fill ${ease}` }}
            />
            <text x="16" y="30" className="wf-label">{n.label}</text>
            <text
              x="16"
              y="50"
              className="wf-fail"
              style={{ opacity: on ? 0 : 1, transition: `opacity ${ease}` }}
            >
              {n.fail}
            </text>
            <text
              x="16"
              y="50"
              className="wf-fail"
              style={{ opacity: on ? 1 : 0, transition: `opacity ${ease} 200ms`, fill: "#B7B1A6" }}
            >
              {["Order in", "Verified", "Confirmed", "Invoice-ready"][i]}
            </text>
          </g>
        ))}

        {/* drops from each node to the bar */}
        {nodes.map((n, i) => (
          <path
            key={`drop-${n.label}`}
            d={`M ${n.x + 60} 94 V 150`}
            className="wf-link"
            style={{
              strokeDashoffset: on ? 0 : 200,
              opacity: on ? 1 : 0,
              transition: `stroke-dashoffset ${ease} ${120 + i * 90}ms, opacity 200ms linear ${120 + i * 90}ms`,
            }}
          />
        ))}

        {/* the shared workflow bar */}
        <g style={{ opacity: on ? 1 : 0, transition: `opacity ${ease} 480ms` }}>
          <rect x="40" y="150" width="660" height="44" className="wf-bar" />
          <text x="60" y="177" className="wf-bar-text">Connected workflow</text>
          <text x="420" y="177" className="wf-chip">status · ownership · approvals · exceptions</text>
        </g>

        {/* visibility line */}
        <g style={{ opacity: on ? 1 : 0, transition: `opacity ${ease} 760ms` }}>
          <path d="M 370 194 V 226" className="wf-link" style={{ strokeDasharray: "none" }} />
          <text x="370" y="248" textAnchor="middle" className="wf-bar-text" style={{ fill: "#C98A3C" }}>
            Operational visibility
          </text>
        </g>

        {/* "before" caption, fades out */}
        <text
          x="370"
          y="180"
          textAnchor="middle"
          className="wf-fail"
          style={{ opacity: on ? 0 : 1, transition: `opacity 200ms linear` }}
        >
          Work moves between these through email, spreadsheets, and memory.
        </text>
      </svg>

      <div className={s.flowSteps}>
        {steps.map((step, i) => (
          <div key={step} className={s.flowStep} data-on={on}>
            <i>{String(i + 1).padStart(2, "0")}</i>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <p className={s.flowNote}>
        Flagship demonstration: warehouse-to-field equipment accountability. Prototype, sample data.
      </p>
    </div>
  );
}
