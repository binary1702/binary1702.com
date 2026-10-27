import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import s from "../work.module.css";
import SiteMark from "@/components/home/SiteMark";
import { projects, projectBySlug } from "@/lib/projects";
import ExhibitStage from "@/components/engineering/ExhibitStage";
import e from "@/components/engineering/engineering.module.css";

type Params = { slug: string };

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const p = projectBySlug(slug);
  return { title: p ? `${p.title} — Binary 1702` : "Work — Binary 1702", description: p?.description };
}

/* /work/[slug] — one application. Everything comes from the registry. */
export default async function ProjectPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) notFound();

  return (
    <main className={s.page}>
      <SiteMark />
      <p className={s.eyebrow}>{p.id} / {p.category}</p>
      <h1 className={s.h1}>{p.title}</h1>
      <p className={s.lede}>{p.description}</p>

      <div className={`${e.section} ${e.live} ${s.exhibit}`} style={{ minHeight: 0, background: "transparent", overflow: "visible" }}>
        <ExhibitStage project={p} leaving={false} />
      </div>

      <dl className={s.meta}>
        <div><dt className={s.k}>Category</dt><dd className={s.v}>{p.category}</dd></div>
        <div><dt className={s.k}>Status</dt><dd className={s.v}>{p.status}</dd></div>
        <div><dt className={s.k}>System</dt><dd className={s.v}>{p.system}</dd></div>
        <div><dt className={s.k}>Application</dt><dd className={s.v}>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">Enter System ↗</a> : <span className={s.placeholder}>Not yet published</span>}</dd></div>
      </dl>

      <Link href="/work" className={s.back}>← All work</Link>
    </main>
  );
}
