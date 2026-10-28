import type { Metadata } from "next";
import Link from "next/link";
import s from "./work.module.css";
import { projects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Work — Binary 1702",
  description: "Applications and engineering projects built by Binary 1702.",
};

/* /work — the archive. One editorial list from the registry; more entries appear as they are added. */
export default function WorkPage() {
  return (
    <main className={s.page}>
      <p className={s.eyebrow}>Work</p>
      <h1 className={s.h1}>Selected applications.</h1>
      <p className={s.lede}>Real applications, each linked to where it runs. Status is stated as it is.</p>

      <section className={s.group} aria-label="Applications">
        <div className={s.groupHead}>
          Applications <span>{String(projects.length).padStart(2, "0")}</span>
        </div>
        {projects.map((p) => (
          <Link key={p.slug} href={`/work/${p.slug}`} className={s.row}>
            <span className={s.id}>{p.id}</span>
            <h2 className={s.title}>{p.title}</h2>
            <p className={s.desc}>{p.description}</p>
            <span className={s.arrow}>{p.system} · {p.status} →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
