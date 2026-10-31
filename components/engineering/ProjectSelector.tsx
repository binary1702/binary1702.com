"use client";

import s from "./engineering.module.css";
import type { Project } from "@/lib/projects";

/* The numbered index. Clicking switches the exhibit. */
export default function ProjectSelector({ projects, selected, onSelect }: { projects: Project[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <div className={s.selector} role="listbox" aria-label="Selected work">
      {projects.map((p, i) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={i === selected}
          className={i === selected ? s.selectorActive : undefined}
          onClick={() => onSelect(i)}
        >
          <span>{p.id}</span>
          <span>{p.title}</span>
        </button>
      ))}
    </div>
  );
}
