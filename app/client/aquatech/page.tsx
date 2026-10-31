import type { Metadata } from "next";
import AquatechExperience from "@/components/aquatech/AquatechExperience";

export const metadata: Metadata = {
  title: "Aquatech — Binary 1702",
  description: "Aquatech: 700+ connections, one connected operation across Metro Manila.",
};

/* /client/aquatech — case study opening: the introduction and the city. */
export default function AquatechPage() {
  return <AquatechExperience />;
}
