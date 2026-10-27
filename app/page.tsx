import type { Metadata } from "next";
import s from "./home.module.css";
import CanopyOpening from "@/components/home/CanopyOpening";
import EngineeringShowcase from "@/components/engineering/EngineeringShowcase";
import SiteMark from "@/components/home/SiteMark";
import Invitation from "@/components/home/Invitation";
import { featuredProjects } from "@/lib/projects";

/* ------------------------------------------------------------------
   Binary 1702 — homepage.

   Three chapters:
     01 Identity        the canopy (fixed opening, draws away on scroll)
     02 Selected Works  the work, as interactive exhibits
     03 Invitation      a conversation
   ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Binary 1702 — Enterprise Technology Transformation",
  description:
    "Binary 1702 transforms fragmented enterprise operations into connected digital systems. Workflow transformation, systems integration, and operational intelligence for operations-intensive organizations.",
};

const mono = "ui-monospace, 'SF Mono', Menlo, monospace";

export default function HomePage() {
  return (
    <div className={s.page}>
      <SiteMark />
      <CanopyOpening />
      <div className={s.opening} aria-hidden="true" />

      {/* 02 — Selected Works */}
      <EngineeringShowcase projects={featuredProjects()} src="/city.jpg" />

      {/* 03 — An invitation */}
      <Invitation />
    </div>
  );
}
