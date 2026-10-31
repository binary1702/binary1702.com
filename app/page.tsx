import type { Metadata } from "next";
import s from "./home.module.css";
import CanopyOpening from "@/components/home/CanopyOpening";
import EnterpriseTransformations from "@/components/home/EnterpriseTransformations";
import EngineeringShowcase from "@/components/engineering/EngineeringShowcase";
import Invitation from "@/components/home/Invitation";
import { featuredProjects } from "@/lib/projects";

/* ------------------------------------------------------------------
   Binary 1702 — homepage.

   Four chapters:
     01 Identity                 the canopy (fixed opening, draws away on scroll)
     02 Enterprise Transformations  client case studies
     03 Selected Works           the work, as interactive exhibits
     04 Invitation               a conversation
   ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Binary 1702",
  description:
    "Binary 1702 transforms fragmented enterprise operations into connected digital systems. Workflow transformation, systems integration, and operational intelligence for operations-intensive organizations.",
};

const mono = "ui-monospace, 'SF Mono', Menlo, monospace";

export default function HomePage() {
  return (
    <div className={s.page}>
      <CanopyOpening />
      <div className={s.opening} aria-hidden="true" />

      {/* 02 — Enterprise Transformations */}
      <EnterpriseTransformations />

      {/* 03 — Selected Works */}
      <EngineeringShowcase projects={featuredProjects()} src="/city.jpg" />

      {/* 04 — An invitation */}
      <Invitation />
    </div>
  );
}
