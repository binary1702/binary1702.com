"use client";

import { useState } from "react";
import s from "../engineering.module.css";
import FIELDS from "@/lib/kk-fields.json";

/* ------------------------------------------------------------------
   001 — Kuya Kaltas · the job as it moves through the system.
   The spine is the real sequence a job takes in the application:
     Customer → Quotation → Handover → Completion report → Invoice → Payment
   with the records that feed each stage above and below it. Hover any
   node to see what it holds (its actual fields) and what it produces.
   Fields come from the codebase's TypeScript interfaces; every edge
   is a reference that exists in them.
   ------------------------------------------------------------------ */

type N = { id: string; label: string; x: number; y: number; produces: string; feeds: string[] };
const F = FIELDS as Record<string, string[]>;

const Y0 = 330;
const NODES: N[] = [
  { id: "Customer",         label: "Customer",          x: 70,  y: Y0,       produces: "The account a job is quoted and billed to.",                feeds: ["Quotation", "Invoice"] },
  { id: "Quotation",        label: "Quotation",         x: 215, y: Y0,       produces: "Priced lines for a project; accepted revision becomes the work order.", feeds: ["Handover"] },
  { id: "Handover",         label: "Handover",          x: 360, y: Y0,       produces: "Equipment counted out to a named technician, line by line.",    feeds: ["CompletionReport"] },
  { id: "CompletionReport", label: "Completion report", x: 505, y: Y0,       produces: "Signatures, photos and problems from site — the proof the job is done.", feeds: ["Invoice"] },
  { id: "Invoice",          label: "Invoice",           x: 650, y: Y0,       produces: "Items with tax treatment; issue and due dates.",              feeds: ["Payment", "TaxReturn"] },
  { id: "Payment",          label: "Payment",           x: 760, y: Y0,       produces: "Amount, method and reference against an invoice.",            feeds: [] },
  { id: "CatalogItem",      label: "Catalog item",      x: 288, y: Y0 - 150, produces: "SKU, unit, prices and reorder level — what quotations and handovers draw from.", feeds: ["Quotation", "Handover"] },
  { id: "Employee",         label: "Employee",          x: 432, y: Y0 - 150, produces: "Manager and technician on a handover; payroll and contributions.", feeds: ["Handover", "PayrollRun"] },
  { id: "PayrollRun",       label: "Payroll run",       x: 560, y: Y0 - 230, produces: "A pay period's lines per employee.",                          feeds: [] },
  { id: "Supplier",         label: "Supplier",          x: 215, y: Y0 + 150, produces: "VAT registration and withholding class for purchases.",       feeds: ["Purchase"] },
  { id: "Purchase",         label: "Purchase",          x: 360, y: Y0 + 150, produces: "Supplier bills with input-VAT eligibility.",                  feeds: ["TaxReturn"] },
  { id: "Expense",          label: "Expense",           x: 505, y: Y0 + 150, produces: "Operating costs by category, payee or employee.",             feeds: ["TaxReturn"] },
  { id: "TaxReturn",        label: "Tax return",        x: 650, y: Y0 + 150, produces: "BIR 2550Q sections computed from sales, purchases and expenses.", feeds: [] },
  { id: "Period",           label: "Period",            x: 760, y: Y0 + 150, produces: "Year and quarter a return covers.",                           feeds: ["TaxReturn"] },
];
const byId = (id: string) => NODES.find((n) => n.id === id)!;
const EDGES = NODES.flatMap((n) => n.feeds.map((t) => [n.id, t] as const));

export default function KuyaKaltasExhibit() {
  const [sel, setSel] = useState("Quotation");
  const n = byId(sel);
  const out = EDGES.filter(([a]) => a === sel).map(([, b]) => b);
  const inn = EDGES.filter(([, b]) => b === sel).map(([a]) => a);
  const near = new Set([...out, ...inn]);
  const fields = F[sel] ?? [];

  const path = (a: N, b: N) => {
    const dx = b.x - a.x;
    if (Math.abs(a.y - b.y) < 1) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    return `M ${a.x} ${a.y} C ${a.x + dx * 0.5} ${a.y}, ${b.x - dx * 0.5} ${b.y}, ${b.x} ${b.y}`;
  };

  return (
    <div className={s.stageBody}>
      <svg className={s.svg} viewBox="0 0 820 620" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Kuya Kaltas: how a job moves through the system">
        {/* spine */}
        <line x1={70} y1={Y0} x2={760} y2={Y0} className={s.edge} style={{ opacity: .5 }} />
        {EDGES.map(([a, b]) => {
          const on = a === sel || b === sel;
          const A = byId(a), B = byId(b);
          return (
            <g key={a + b}>
              <path d={path(A, B)} className={`${s.edge} ${s.draw} ${on ? s.edgeOn : s.edgeDim}`} />
              {on && <path d={path(A, B)} className={s.signal} />}
            </g>
          );
        })}
        {NODES.map((nd) => {
          const on = nd.id === sel, nr = near.has(nd.id), spine = nd.y === Y0;
          const r = spine ? 6 : 4;
          return (
            <g key={nd.id} className={s.node} role="button" tabIndex={0} aria-pressed={on} aria-label={nd.label}
               onPointerEnter={() => setSel(nd.id)} onFocus={() => setSel(nd.id)} onClick={() => setSel(nd.id)}
               onKeyDown={(k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); setSel(nd.id); } }}>
              <circle cx={nd.x} cy={nd.y} r={r + 10} fill="transparent" />
              <circle cx={nd.x} cy={nd.y} r={r + 6} className={`${s.ring} ${on ? s.ringOn : ""}`} style={{ opacity: on ? 1 : 0 }} />
              <circle cx={nd.x} cy={nd.y} r={on ? r + 1.5 : r} className={`${s.core} ${on ? s.coreOn : nr ? s.coreNear : spine ? "" : s.coreDim}`} />
              <text x={nd.x} y={nd.y < Y0 ? nd.y - 16 : nd.y + 24} textAnchor="middle" className={`${s.lbl} ${on || nr || spine ? s.lblOn : s.lblDim}`} style={{ fontSize: spine ? 10 : 8.5 }}>{nd.label}</text>
            </g>
          );
        })}

        {/* the reading: what it holds, what it produces */}
        <g className={s.enter_} key={sel}>
          <text x={70} y={548} className={s.tiny} style={{ fill: "#C98A3C" }}>{n.label.toUpperCase()} · {fields.length} FIELDS</text>
          <text x={70} y={566} className={s.tiny} style={{ fill: "rgba(242,239,231,.7)" }}>{fields.slice(0, 11).join(" · ")}{fields.length > 11 ? " · …" : ""}</text>
          <text x={70} y={592} className={s.tiny} style={{ fill: "#F2EFE7", fontSize: 10 }}>→ {n.produces}</text>
          {out.length > 0 && <text x={70} y={610} className={s.tiny}>FEEDS {out.map((o) => byId(o).label.toUpperCase()).join(" · ")}</text>}
        </g>
      </svg>
    </div>
  );
}
