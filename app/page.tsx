import type { Metadata } from "next";
import Link from "next/link";
import s from "./home.module.css";
import HomeNav from "@/components/home/HomeNav";
import WorkflowVisual from "@/components/home/WorkflowVisual";
import AssessmentForm from "@/components/home/AssessmentForm";
import AsciiField from "@/components/home/AsciiField";
import CanopyOpening from "@/components/home/CanopyOpening";

/* ------------------------------------------------------------------
   Binary 1702 — enterprise homepage.

   Six sections, in the order an operations executive decides:
   recognition → possibility → capability → evidence → investment → action.
   Server component; the three interactive pieces are client components.
   The previous homepage lives on at /threshold.
   ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Binary 1702 — Enterprise Technology Transformation",
  description:
    "Binary 1702 transforms fragmented enterprise operations into connected digital systems. Workflow transformation, systems integration, and operational intelligence for operations-intensive organizations.",
};

const capabilities = [
  {
    title: "Workflow transformation",
    body: "Connected processes with approvals, routing, and automation across departments.",
  },
  {
    title: "Systems integration",
    body: "Your existing applications and data working together — without replacing the ERP.",
  },
  {
    title: "Enterprise applications",
    body: "Purpose-built software for the operations your off-the-shelf tools don't handle.",
  },
  {
    title: "Operational intelligence",
    body: "Dashboards and reporting tied to the metrics leadership actually manages.",
  },
  {
    title: "AI in the workflow",
    body: "Practical AI placed inside the process: classification, extraction, drafting, exception handling.",
  },
];

const work = [
  {
    flagship: true,
    tag: "Flagship demonstration",
    kind: "demo",
    title: "Warehouse-to-field equipment accountability",
    problem: "Equipment leaves the warehouse and no one can prove where it went.",
    solution:
      "Order → warehouse verification → handover → technician confirmation → installation evidence → manager approval.",
    href: "#demo",
    cta: "See the demo",
  },
  {
    flagship: false,
    tag: "Working application",
    kind: "app",
    title: "Operational workflow system",
    problem: "Multi-step operational processes tracked by hand across roles.",
    solution: "Role-based workflows with approvals, status, and a full history of who did what, when.",
    href: "https://kuyakaltas.com",
    cta: "View",
  },
  {
    flagship: false,
    tag: "Working application",
    kind: "app",
    title: "Financial visibility",
    problem: "Finance learns about operations after the fact.",
    solution: "Operational data surfaced as financial reporting leadership can act on.",
    href: "https://financials.binary1702.com",
    cta: "View",
  },
];

const stairs = [
  {
    stage: "Diagnose",
    name: "Enterprise Workflow Assessment",
    price: "$10K–$25K",
    unit: "fixed scope",
    body:
      "Process map, solution architecture, transformation roadmap, and a bounded working prototype of the fix — built on sample data, configured to your workflow.",
  },
  {
    stage: "Prove",
    name: "Department Modernization Pilot",
    price: "$25K–$75K",
    unit: "one department",
    body: "One production-bounded workflow in one department, with success criteria agreed before we start.",
  },
  {
    stage: "Transform",
    name: "Multi-System Transformation",
    price: "$100K–$300K+",
    unit: "quoted after assessment",
    body: "Integration and modernization across teams, systems, and departments, delivered in phases with governance.",
  },
  {
    stage: "Evolve",
    name: "Ongoing Engineering & Support",
    price: "$5K–$20K+",
    unit: "per month",
    body: "Monitoring, improvements, integrations, and a team that already knows your systems.",
  },
];

export default function HomePage() {
  return (
    <div className={s.page}>
      <HomeNav />

      {/* 01 — Hero */}
      <AsciiField />
      <section className={s.hero} id="problem" aria-labelledby="hero-title">
        <div className={s.heroGlow} aria-hidden="true" />
        <div className={s.wrap}>
          <div className={s.heroGrid}>
            <div>
              <p className={s.eyebrow}>Enterprise Technology Transformation</p>
              <h1 className={s.h1} id="hero-title">
                Your business has systems. <em>Do they work together?</em>
              </h1>
              <p className={s.lede}>
                Sales, warehouse, field teams, and finance each run on their own tools. Work moves
                between them through email, spreadsheets, and memory — and that&apos;s where delays,
                errors, and blind spots live.
              </p>
              <p className={s.heroStatement}>
                We transform fragmented operations into connected digital systems.
              </p>
              <div className={s.btnRow}>
                <a href="#assessment" className={s.btn}>
                  Request an Enterprise Workflow Assessment
                </a>
                <a href="#transformation" className={`${s.btn} ${s.btnGhost}`}>
                  See the transformation ↓
                </a>
              </div>
            </div>

            <div aria-hidden="true">
              <div className={s.nodes}>
                {[
                  ["Sales", "Quotes in a CRM. Approvals in email."],
                  ["Warehouse", "Inventory in one system. Handovers on paper."],
                  ["Field", "Completion evidence on a technician's phone."],
                  ["Finance", "Invoices wait for someone to confirm the job."],
                ].map(([label, sub]) => (
                  <div className={s.node} key={label}>
                    <span className={s.nodeDot} />
                    <p className={s.nodeLabel}>{label}</p>
                    <p className={s.nodeSub}>{sub}</p>
                  </div>
                ))}
              </div>
              <p className={s.nodesCaption}>Four systems. No shared record of the work between them.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 02 — Transformation */}
      <section className={`${s.section} ${s.sectionAlt}`} id="transformation" aria-labelledby="transformation-title">
        <div className={s.wrap}>
          <div className={s.twoCol}>
            <div>
              <p className={s.eyebrow}>The problem, made visible</p>
              <h2 className={s.h2} id="transformation-title">
                Disconnected systems create invisible costs.
              </h2>
              <p className={s.lede}>
                None of your systems are broken. The cost lives in the handoffs between them.
              </p>

              <table className={s.compare}>
                <thead>
                  <tr>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Requests move through email, chat, and spreadsheets</td>
                    <td>One shared workflow routes work between your existing systems</td>
                  </tr>
                  <tr>
                    <td>Approvals are unclear; exceptions surface late</td>
                    <td>Status, ownership, and exceptions are visible as they happen</td>
                  </tr>
                  <tr>
                    <td>Field completion evidence is hard to find</td>
                    <td>Photos, signatures, and timestamps attach to the job</td>
                  </tr>
                  <tr>
                    <td>Management hears about delays from customers</td>
                    <td>Management sees bottlenecks and intervenes early</td>
                  </tr>
                </tbody>
              </table>

              <blockquote className={s.flagship}>
                Who had the equipment, when did they receive it, and where did it go?
                <small>When the answer takes a phone call, the system isn&apos;t connected.</small>
              </blockquote>
            </div>

            <WorkflowVisual />
          </div>
        </div>
      </section>

      {/* 03 — Capabilities */}
      <section className={s.section} id="capabilities" aria-labelledby="capabilities-title">
        <div className={s.wrap}>
          <p className={s.eyebrow}>Capabilities</p>
          <h2 className={s.h2} id="capabilities-title">What we deliver.</h2>
          <p className={s.lede}>
            Custom software, systems integration, automation, and operational intelligence — in service
            of one connected operation.
          </p>
          <ul className={s.caps}>
            {capabilities.map((c, i) => (
              <li className={s.cap} key={c.title}>
                <p className={s.capNum}>0{i + 1}</p>
                <h3 className={s.capTitle}>{c.title}</h3>
                <p className={s.capBody}>{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 04 — Selected work */}
      <section className={`${s.section} ${s.sectionAlt}`} id="work" aria-labelledby="work-title">
        <div className={s.wrap}>
          <p className={s.eyebrow}>Selected work</p>
          <h2 className={s.h2} id="work-title">Working demonstrations, clearly labeled.</h2>
          <p className={s.lede}>
            We show what we&apos;ve built. Prototypes are marked as prototypes; client work appears only
            with permission.
          </p>
          <div className={s.work}>
            {work.map((w) => (
              <article className={s.workItem} key={w.title} data-flagship={w.flagship}>
                <div>
                  <span className={s.workTag} data-kind={w.kind}>{w.tag}</span>
                  <h3 className={s.workTitle}>{w.title}</h3>
                </div>
                <div>
                  <p className={s.workLabel}>Problem</p>
                  <p className={s.workBody}>{w.problem}</p>
                </div>
                <div>
                  <p className={s.workLabel}>Solution</p>
                  <p className={s.workBody}>{w.solution}</p>
                </div>
                <a
                  className={s.workLink}
                  href={w.href}
                  {...(w.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {w.cta} →
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 05 — Engagements */}
      <section className={s.section} id="engagements" aria-labelledby="engagements-title">
        <div className={s.wrap}>
          <p className={s.eyebrow}>Engagements</p>
          <h2 className={s.h2} id="engagements-title">A defined path, one step at a time.</h2>
          <p className={s.lede}>
            Every engagement begins with an assessment. Each stage earns the next — no six-figure
            commitment before the problem is understood.
          </p>

          <div className={s.stairs}>
            {stairs.map((st, i) => (
              <div className={s.stair} key={st.stage}>
                <div className={s.stairNum}>0{i + 1}</div>
                <div>
                  <h3 className={s.stairStage}>{st.stage}</h3>
                  <p className={s.stairName}>{st.name}</p>
                </div>
                <p className={s.stairBody}>{st.body}</p>
                <div className={s.stairPrice}>
                  {st.price}
                  <small>{st.unit}</small>
                </div>
              </div>
            ))}
          </div>
          <p className={s.stairsNote}>
            Indicative ranges, subject to scope. Multi-system work is quoted only after an assessment.
          </p>

          <div className={s.journey} aria-label="Delivery journey">
            <span>Diagnose</span><span data-arrow>→</span>
            <span>Demo</span><span data-arrow>→</span>
            <span>Build</span><span data-arrow>→</span>
            <span>Care</span>
          </div>

          <div className={s.btnRow}>
            <a href="#assessment" className={s.btn}>Start with an assessment</a>
          </div>
        </div>
      </section>

      {/* 06 — Assessment */}
      <section className={`${s.section} ${s.sectionAlt}`} id="assessment" aria-labelledby="assessment-title">
        <div className={s.wrap}>
          <div className={s.twoCol}>
            <div>
              <p className={s.eyebrow}>Request an assessment</p>
              <h2 className={s.h2} id="assessment-title">
                Show us the workflow that&apos;s slowing your business down.
              </h2>
              <p className={s.lede}>
                Tell us what&apos;s breaking. We&apos;ll tell you whether it&apos;s worth fixing — and what
                fixing it would take.
              </p>
              <div style={{ marginTop: 40 }}>
                <p className={s.eyebrow}>We work best when</p>
                <ul className={s.principles}>
                  <li>The decision-maker is in the conversation.</li>
                  <li>We can see how the business actually operates.</li>
                  <li>Evidence matters more than defending past decisions.</li>
                </ul>
              </div>
            </div>
            <AssessmentForm />
          </div>
        </div>
      </section>

      <footer className={s.footer}>
        <div className={s.wrap}>
          <div className={s.footerRow}>
            <div>Binary 1702 · Sacramento, CA</div>
            <nav className={s.footerLinks} aria-label="Footer">
              <Link href="/showcase">Philosophy</Link>
              <Link href="/experiments">Labs</Link>
              <a href="https://portal.binary1702.com">Client login</a>
            </nav>
            <div className={s.footerTag}>Complex decisions deserve clear thinking.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
