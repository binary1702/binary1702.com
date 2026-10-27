"use client";

import s from "./engineering.module.css";
import type { Project } from "@/lib/projects";

/* The numbered index. Arrow keys move the selection; Enter/Space are native button behaviour. */
export default function ProjectSelector({ projects, selected, onSelect }: { projects: Project[]; selected: number; onSelect: (i: number) => void }) {
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); onSelect(Math.min(projects.length - 1, selected + 1)); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); onSelect(Math.max(0, selected - 1)); }
  };
  return (
    <div className={s.selector} role="tablist" aria-label="Selected work" aria-orientation="vertical" onKeyDown={onKey}>
      {projects.map((p, i) => (
        <button key={p.id} role="tab" aria-selected={i === selected} tabIndex={i === selected ? 0 : -1} onClick={() => onSelect(i)}>
          <span>{p.id}</span>
          <span>{p.title}</span>
        </button>
      ))}
    </div>
  );
}
