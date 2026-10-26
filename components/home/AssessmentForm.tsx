"use client";

import { useState, type FormEvent } from "react";
import s from "@/app/home.module.css";

type Status = "idle" | "sending" | "sent" | "error";

export default function AssessmentForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const f = e.currentTarget;
    const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement).value.trim();

    const data = {
      kind: "assessment",
      name: v("name"),
      business: v("company"),
      role: v("role"),
      email: v("email"),
      concern: v("problem"),
      systems: v("systems"),
      outcome: v("outcome"),
    };

    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className={s.done} role="status">
        <h3>Received.</h3>
        <p>
          You&apos;ll hear from one of us within two working days. If the problem isn&apos;t a fit for
          an assessment, we&apos;ll say so and tell you what we&apos;d do instead.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={s.done} role="alert">
        <h3>Something went wrong.</h3>
        <p>
          Please email us directly at{" "}
          <a href="mailto:ben@binary1702.com" style={{ color: "var(--accent)" }}>
            ben@binary1702.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={s.formGrid} noValidate={false}>
      <label className={s.field}>
        <span className={s.fieldLabel}>Name</span>
        <input className={s.input} name="name" type="text" autoComplete="name" required />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>Company</span>
        <input className={s.input} name="company" type="text" autoComplete="organization" required />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>Role</span>
        <input className={s.input} name="role" type="text" autoComplete="organization-title" placeholder="COO, VP Operations, Director of…" required />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>Work email</span>
        <input className={s.input} name="email" type="email" autoComplete="email" required />
      </label>

      <label className={`${s.field} ${s.full}`}>
        <span className={s.fieldLabel}>What&apos;s the operational problem?</span>
        <textarea
          className={s.input}
          name="problem"
          rows={4}
          required
          placeholder="Describe it the way you'd describe it to a colleague. Where does work get stuck, and what does it cost you?"
        />
      </label>

      <label className={s.field}>
        <span className={s.fieldLabel}>
          Systems or departments involved <small>— optional</small>
        </span>
        <input className={s.input} name="systems" type="text" placeholder="ERP, warehouse, field teams, QuickBooks…" />
      </label>
      <label className={s.field}>
        <span className={s.fieldLabel}>
          What would &ldquo;fixed&rdquo; look like? <small>— optional</small>
        </span>
        <input className={s.input} name="outcome" type="text" placeholder="Fewer repeat visits, same-day invoicing…" />
      </label>

      <div className={s.full} style={{ marginTop: 8 }}>
        <button type="submit" className={s.btn} disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Request an Enterprise Workflow Assessment"}
        </button>
      </div>
    </form>
  );
}
