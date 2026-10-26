import type { Metadata } from "next";
import GenerativeLab from "./GenerativeLab";

export const metadata: Metadata = {
  title: "Generative Lab — Binary 1702",
  description: "Three generative systems rendered as ASCII: a Lorenz attractor, an L-system canopy, and a Gray–Scott reaction–diffusion field.",
  robots: { index: false },
};

export default function Page() {
  return <GenerativeLab />;
}
