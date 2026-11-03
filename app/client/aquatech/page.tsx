import type { Metadata } from "next";
import AquatechExperience from "@/components/aquatech/AquatechExperience";

export const metadata: Metadata = {
  title: "Aquatech — Binary 1702",
  description: "Aquatech: Inventory operations at scale. From warehouse to installation, every piece of equipment accounted for.",
};

/* /client/aquatech — case study opening: the introduction and the city. */
export default function AquatechPage() {
  return <AquatechExperience />;
}
