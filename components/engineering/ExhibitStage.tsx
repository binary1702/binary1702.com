"use client";

import dynamic from "next/dynamic";
import s from "./engineering.module.css";
import type { ExhibitKey, Project } from "@/lib/projects";

/* ------------------------------------------------------------------
   The stage: resolves a project's exhibit (lazy-loaded) and keys it
   so a change of project remounts the exhibit and plays its entrance
   (fade up, lines draw). Add a new exhibit here and in lib/projects.
   ------------------------------------------------------------------ */
const EXHIBITS: Record<ExhibitKey, React.ComponentType> = {
  "kuya-kaltas": dynamic(() => import("./exhibits/KuyaKaltasExhibit"), { ssr: false }),
  "anatomy": dynamic(() => import("./exhibits/AnatomyExhibit"), { ssr: false }),
  "shavat": dynamic(() => import("./exhibits/ShavatExhibit"), { ssr: false }),
  "gaia": dynamic(() => import("./exhibits/GaiaExhibit"), { ssr: false }),
};

export default function ExhibitStage({ project, leaving }: { project: Project; leaving: boolean }) {
  const Exhibit = EXHIBITS[project.exhibit];
  return (
    <div className={s.stage}>
      <div key={project.slug} className={`${s.stageInner} ${leaving ? s.leaving : s.enter_}`}>
        <Exhibit />
      </div>
    </div>
  );
}
